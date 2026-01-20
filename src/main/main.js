const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const pty = require('node-pty');
const logger = require('./logger');

// Handle EPIPE errors on stdout/stderr (happens when pipe closes during shutdown)
process.stdout?.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});
process.stderr?.on('error', (err) => {
  if (err.code === 'EPIPE') return;
  throw err;
});

// Global uncaught exception handler - log but don't crash for non-critical errors
process.on('uncaughtException', (err) => {
  // Ignore EPIPE errors (broken pipe when window closes during logging)
  if (err.code === 'EPIPE') return;
  logger.error('Uncaught exception:', err);
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  console.error('Unhandled rejection:', reason);
});

let mainWindow;
let terminalProcesses = new Map();

// Safe send to renderer - won't throw if window is destroyed
function safeSend(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      if (channel.startsWith('ai-stream')) {
        console.log(`[Main] Sending ${channel}:`, data?.requestId || 'no-id');
      }
      mainWindow.webContents.send(channel, data);
    } else {
      console.warn(`[Main] Cannot send ${channel}: window not available`);
    }
  } catch (err) {
    console.error(`[Main] Error sending ${channel}:`, err.message);
  }
}

// Output logging to renderer's Output panel
function sendOutputLog(channel, level, message) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('output-log', { channel, level, message });
    }
  } catch (err) {
    // Ignore
  }
}

// Extension storage directory
const extensionsDir = path.join(app.getPath('userData'), 'extensions');
const extensionsMetaPath = path.join(app.getPath('userData'), 'extensions.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Ensure extensions directory exists
function ensureExtensionsDir() {
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }
}

// Load settings from disk
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return null;
}

// Save settings to disk
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
}

// Load extensions metadata
function loadExtensionsMeta() {
  try {
    if (fs.existsSync(extensionsMetaPath)) {
      return JSON.parse(fs.readFileSync(extensionsMetaPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading extensions meta:', error);
  }
  return { installed: [] };
}

// Save extensions metadata
function saveExtensionsMeta(meta) {
  fs.writeFileSync(extensionsMetaPath, JSON.stringify(meta, null, 2));
}

function createWindow() {
  logger.info('Creating main window');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 14 },
    backgroundColor: '#09090b',
    show: false
  });

  // Only open devtools in development
  // mainWindow.webContents.openDevTools();

  if (process.env.NODE_ENV === 'development') {
    logger.info('Development mode - loading from localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    logger.info('Production mode - loading from dist');
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  
  // Always open DevTools
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load window', { errorCode, errorDescription });
  });

  // Catch renderer crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Renderer process gone:', details);
    console.error('[CRASH] Renderer process gone:', details);
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    logger.error('Renderer crashed, killed:', killed);
    console.error('[CRASH] Renderer crashed, killed:', killed);
  });

  mainWindow.webContents.on('unresponsive', () => {
    logger.error('Renderer became unresponsive');
    console.error('[CRASH] Renderer unresponsive');
  });

  mainWindow.once('ready-to-show', () => {
    logger.info('Window ready to show');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
    terminalProcesses.forEach(proc => proc.kill());
    terminalProcesses.clear();
  });
}

app.whenReady().then(() => {
  logger.info('App ready');
  logger.info('Log file path:', { logPath: logger.getLogPath() });
  logger.clearOldLogs();
  createWindow();
  
  // Send startup logs to output panel after window is ready
  setTimeout(() => {
    sendOutputLog('IDEC', 'info', 'IDEC Application started');
    sendOutputLog('IDEC', 'info', `Version: ${app.getVersion()}`);
    sendOutputLog('IDEC', 'info', `Platform: ${process.platform} ${process.arch}`);
    sendOutputLog('IDEC', 'info', `Node: ${process.version}`);
    sendOutputLog('IDEC', 'info', `Electron: ${process.versions.electron}`);
  }, 2000); // Increase delay to ensure renderer is ready
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  logger.info('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// File System Operations
ipcMain.handle('read-directory', async (event, dirPath) => {
  console.log('[Main] read-directory called for:', dirPath);
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const entries = items.map(item => ({
      name: item.name,
      path: path.join(dirPath, item.name),
      isDirectory: item.isDirectory(),
      isFile: item.isFile()
    }));
    console.log('[Main] read-directory success:', entries.length, 'entries');
    return { success: true, entries };
  } catch (error) {
    console.error('[Main] Error reading directory:', error);
    return { success: false, error: error.message };
  }
});

// File system watcher for live updates
let fsWatcher = null;

ipcMain.handle('watch-directory', async (event, dirPath) => {
  // Clean up existing watcher
  if (fsWatcher) {
    fsWatcher.close();
    fsWatcher = null;
  }
  
  if (!dirPath) return { success: false };
  
  try {
    fsWatcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      // Notify renderer of file system changes
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fs-change', { eventType, filename, dirPath });
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error watching directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unwatch-directory', async () => {
  if (fsWatcher) {
    fsWatcher.close();
    fsWatcher = null;
  }
  return { success: true };
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    logger.info('read-file request', { filePath });
    const content = await fs.promises.readFile(filePath, 'utf-8');
    logger.info('read-file success', { filePath, size: content.length });
    return { success: true, content };
  } catch (error) {
    logger.error('read-file error', { filePath, error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  console.log('[Main] write-file called for:', filePath, 'content length:', content?.length);
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    console.log('[Main] write-file success');
    return { success: true };
  } catch (error) {
    console.error('[Main] write-file error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-file', async (event, filePath) => {
  try {
    await fs.promises.writeFile(filePath, '', 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Project-specific data storage in .IDEC folder
ipcMain.handle('project-data-read', async (event, workspacePath, filename) => {
  try {
    const idecPath = path.join(workspacePath, '.IDEC', filename);
    const content = await fs.promises.readFile(idecPath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error) {
    // File doesn't exist is not an error, just return empty
    if (error.code === 'ENOENT') {
      return { success: true, data: null };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-data-write', async (event, workspacePath, filename, data) => {
  try {
    const idecDir = path.join(workspacePath, '.IDEC');
    // Ensure .IDEC directory exists
    await fs.promises.mkdir(idecDir, { recursive: true });
    const idecPath = path.join(idecDir, filename);
    await fs.promises.writeFile(idecPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-path', async (event, targetPath) => {
  try {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// List all files recursively in a directory
ipcMain.handle('list-files-recursive', async (event, dirPath, maxDepth = 10) => {
  try {
    const files = [];
    const walkDir = async (dir, depth = 0) => {
      if (depth > maxDepth) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip common non-code directories
          if (!['node_modules', '.git', '.IDEC', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', 'coverage'].includes(entry.name)) {
            await walkDir(fullPath, depth + 1);
          }
        } else {
          // Only include code-like files
          const ext = path.extname(entry.name).toLowerCase();
          const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte', '.html', '.css', '.scss', '.sass', '.less', '.json', '.yaml', '.yml', '.toml', '.xml', '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.dockerfile', '.env', '.gitignore', '.eslintrc', '.prettierrc'];
          if (codeExts.includes(ext) || entry.name.startsWith('.') === false && ext === '') {
            files.push(fullPath);
          }
        }
      }
    };
    await walkDir(dirPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-path', async (event, sourcePath, destPath) => {
  try {
    const stat = await fs.promises.stat(sourcePath);
    if (stat.isDirectory()) {
      await fs.promises.cp(sourcePath, destPath, { recursive: true });
    } else {
      await fs.promises.copyFile(sourcePath, destPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-path', async (event, sourcePath, destPath) => {
  try {
    await fs.promises.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    // If rename fails (cross-device), fall back to copy + delete
    try {
      const stat = await fs.promises.stat(sourcePath);
      if (stat.isDirectory()) {
        await fs.promises.cp(sourcePath, destPath, { recursive: true });
        await fs.promises.rm(sourcePath, { recursive: true });
      } else {
        await fs.promises.copyFile(sourcePath, destPath);
        await fs.promises.unlink(sourcePath);
      }
      return { success: true };
    } catch (fallbackError) {
      return { success: false, error: fallbackError.message };
    }
  }
});

ipcMain.handle('rename-path', async (event, oldPath, newPath) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// Codebase indexing for AI context
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'coverage', '.nyc_output', 'vendor', 'target', '.idea', '.vscode']);
const IGNORE_FILES = new Set(['.DS_Store', 'package-lock.json', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml', '.env', '.env.local']);
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte', '.css', '.scss', '.less', '.html', '.json', '.yaml', '.yml', '.md', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.r', '.R', '.lua', '.dart', '.ex', '.exs', '.erl', '.hs', '.ml', '.clj', '.elm']);

async function scanDirectory(dirPath, basePath, fileList = [], depth = 0) {
  if (depth > 10) return fileList; // Max depth to prevent infinite recursion
  
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      if (IGNORE_DIRS.has(item.name) || item.name.startsWith('.')) continue;
      if (IGNORE_FILES.has(item.name)) continue;
      
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(basePath, fullPath);
      
      if (item.isDirectory()) {
        await scanDirectory(fullPath, basePath, fileList, depth + 1);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.size < 500000) { // Skip files larger than 500KB
              fileList.push({ path: relativePath, fullPath, size: stats.size, ext });
            }
          } catch (e) { /* skip */ }
        }
      }
    }
  } catch (e) { /* skip inaccessible dirs */ }
  
  return fileList;
}

function detectProjectType(files, packageJson) {
  const types = [];
  const hasFile = (name) => files.some(f => f.path === name || f.path.endsWith('/' + name));
  const hasExt = (ext) => files.some(f => f.ext === ext);
  
  if (packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps.react || deps['react-dom']) types.push('React');
    if (deps.vue) types.push('Vue');
    if (deps.svelte) types.push('Svelte');
    if (deps.angular || deps['@angular/core']) types.push('Angular');
    if (deps.next) types.push('Next.js');
    if (deps.electron) types.push('Electron');
    if (deps.express) types.push('Express');
    if (deps.fastify) types.push('Fastify');
    if (deps.nest || deps['@nestjs/core']) types.push('NestJS');
  }
  
  if (hasFile('requirements.txt') || hasFile('setup.py') || hasFile('pyproject.toml')) types.push('Python');
  if (hasFile('Cargo.toml')) types.push('Rust');
  if (hasFile('go.mod')) types.push('Go');
  if (hasFile('pom.xml') || hasFile('build.gradle')) types.push('Java');
  if (hasFile('Gemfile')) types.push('Ruby');
  if (hasFile('composer.json')) types.push('PHP');
  if (hasExt('.swift')) types.push('Swift');
  
  return types.length > 0 ? types : ['Unknown'];
}

function generateFileTree(files, maxDepth = 3) {
  const tree = {};
  
  for (const file of files) {
    const parts = file.path.split(path.sep);
    if (parts.length > maxDepth + 1) continue;
    
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = null; // file marker
  }
  
  function treeToString(obj, indent = '') {
    let result = '';
    const entries = Object.entries(obj).sort(([a], [b]) => {
      const aIsDir = obj[a] !== null;
      const bIsDir = obj[b] !== null;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });
    
    for (const [name, value] of entries) {
      if (value === null) {
        result += `${indent}${name}\n`;
      } else {
        result += `${indent}${name}/\n`;
        result += treeToString(value, indent + '  ');
      }
    }
    return result;
  }
  
  return treeToString(tree);
}

async function analyzeFileStructure(files) {
  const byExt = {};
  const byDir = {};
  
  for (const file of files) {
    byExt[file.ext] = (byExt[file.ext] || 0) + 1;
    const dir = path.dirname(file.path).split(path.sep)[0] || '.';
    byDir[dir] = (byDir[dir] || 0) + 1;
  }
  
  return { byExt, byDir };
}

ipcMain.handle('index-codebase', async (event, workspacePath) => {
  try {
    console.log('[Indexer] Starting codebase indexing for:', workspacePath);
    const startTime = Date.now();
    
    // Scan directory
    const files = await scanDirectory(workspacePath, workspacePath);
    console.log(`[Indexer] Found ${files.length} code files`);
    
    // Read package.json if exists
    let packageJson = null;
    const pkgPath = path.join(workspacePath, 'package.json');
    try {
      if (fs.existsSync(pkgPath)) {
        packageJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
      }
    } catch (e) { /* no package.json */ }
    
    // Detect project type
    const projectTypes = detectProjectType(files, packageJson);
    
    // Analyze structure
    const structure = await analyzeFileStructure(files);
    
    // Generate file tree
    const fileTree = generateFileTree(files);
    
    // Read existing README if present
    let readmeContent = '';
    const readmePath = path.join(workspacePath, 'README.md');
    try {
      if (fs.existsSync(readmePath)) {
        const readme = await fs.promises.readFile(readmePath, 'utf-8');
        readmeContent = readme.slice(0, 2000); // First 2000 chars
      }
    } catch (e) { /* no readme */ }
    
    // Create analysis document
    const projectName = path.basename(workspacePath);
    const analysis = `# ${projectName} - Codebase Analysis

> Auto-generated by IDEC on ${new Date().toISOString().split('T')[0]}

## Project Type
${projectTypes.join(', ')}

## Statistics
- **Total Files:** ${files.length}
- **Languages:** ${Object.entries(structure.byExt).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ext, count]) => `${ext} (${count})`).join(', ')}

## Directory Structure
\`\`\`
${fileTree.slice(0, 3000)}
\`\`\`

## Main Directories
${Object.entries(structure.byDir).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([dir, count]) => `- **${dir}/** - ${count} files`).join('\n')}

${packageJson ? `## Dependencies
**Main:** ${Object.keys(packageJson.dependencies || {}).slice(0, 15).join(', ')}
**Dev:** ${Object.keys(packageJson.devDependencies || {}).slice(0, 10).join(', ')}
` : ''}

${readmeContent ? `## README Summary
${readmeContent.slice(0, 1500)}
` : ''}

## Key Files
${files.filter(f => ['index', 'main', 'app', 'server', 'config'].some(k => f.path.toLowerCase().includes(k))).slice(0, 20).map(f => `- ${f.path}`).join('\n')}
`;

    // Ensure .IDEC directory exists
    const idecDir = path.join(workspacePath, '.IDEC');
    if (!fs.existsSync(idecDir)) {
      await fs.promises.mkdir(idecDir, { recursive: true });
    }
    
    // Write CODEBASE.md
    const codebasePath = path.join(idecDir, 'CODEBASE.md');
    await fs.promises.writeFile(codebasePath, analysis, 'utf-8');
    
    const duration = Date.now() - startTime;
    console.log(`[Indexer] Completed in ${duration}ms, saved to .IDEC/CODEBASE.md`);
    
    return { 
      success: true, 
      analysis,
      fileCount: files.length,
      projectTypes,
      duration
    };
  } catch (error) {
    console.error('[Indexer] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-codebase-index', async (event, workspacePath) => {
  try {
    const codebasePath = path.join(workspacePath, '.IDEC', 'CODEBASE.md');
    if (fs.existsSync(codebasePath)) {
      const content = await fs.promises.readFile(codebasePath, 'utf-8');
      return { success: true, content };
    }
    return { success: false, error: 'No index found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =====================================================
// RAG (Retrieval Augmented Generation) System
// =====================================================

// In-memory vector store for code chunks
let ragIndex = new Map(); // workspacePath -> { chunks: [], embeddings: [] }

// Simple TF-IDF based text similarity (no external dependencies)
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function computeTF(tokens) {
  const tf = {};
  tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
  const max = Math.max(...Object.values(tf));
  Object.keys(tf).forEach(t => { tf[t] /= max; });
  return tf;
}

function cosineSimilarity(vec1, vec2, allTerms) {
  let dotProduct = 0, norm1 = 0, norm2 = 0;
  for (const term of allTerms) {
    const v1 = vec1[term] || 0;
    const v2 = vec2[term] || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  return norm1 && norm2 ? dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) : 0;
}

// Chunk code files into smaller pieces for better retrieval
function chunkCode(content, filePath, chunkSize = 1500, overlap = 200) {
  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = [];
  let currentSize = 0;
  let startLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunk.push(line);
    currentSize += line.length + 1;
    
    if (currentSize >= chunkSize) {
      chunks.push({
        content: currentChunk.join('\n'),
        filePath,
        startLine,
        endLine: i,
        tokens: tokenize(currentChunk.join('\n'))
      });
      
      // Overlap: keep last few lines
      const overlapLines = Math.floor(overlap / 50);
      currentChunk = currentChunk.slice(-overlapLines);
      currentSize = currentChunk.join('\n').length;
      startLine = i - overlapLines + 1;
    }
  }
  
  // Don't forget remaining content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      filePath,
      startLine,
      endLine: lines.length - 1,
      tokens: tokenize(currentChunk.join('\n'))
    });
  }
  
  return chunks;
}

// Build RAG index for a workspace
ipcMain.handle('rag-build-index', async (event, workspacePath) => {
  try {
    console.log('[RAG] Building index for:', workspacePath);
    const startTime = Date.now();
    
    const files = await scanDirectory(workspacePath, workspacePath);
    const allChunks = [];
    
    for (const file of files.slice(0, 500)) { // Limit to 500 files
      try {
        const content = await fs.promises.readFile(file.fullPath, 'utf-8');
        const chunks = chunkCode(content, file.path);
        allChunks.push(...chunks);
      } catch (e) { /* skip unreadable files */ }
    }
    
    // Compute IDF for all terms
    const docFreq = {};
    allChunks.forEach(chunk => {
      const uniqueTokens = new Set(chunk.tokens);
      uniqueTokens.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });
    });
    
    const idf = {};
    const numDocs = allChunks.length;
    Object.keys(docFreq).forEach(t => {
      idf[t] = Math.log(numDocs / (docFreq[t] + 1));
    });
    
    // Compute TF-IDF for each chunk
    allChunks.forEach(chunk => {
      const tf = computeTF(chunk.tokens);
      chunk.tfidf = {};
      Object.keys(tf).forEach(t => {
        chunk.tfidf[t] = tf[t] * (idf[t] || 0);
      });
    });
    
    ragIndex.set(workspacePath, { chunks: allChunks, idf });
    
    // Save index to .IDEC/RAG_INDEX.json
    const idecDir = path.join(workspacePath, '.IDEC');
    if (!fs.existsSync(idecDir)) {
      await fs.promises.mkdir(idecDir, { recursive: true });
    }
    
    // Save lightweight version (without full content to save space)
    const lightIndex = allChunks.map(c => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      preview: c.content.slice(0, 200)
    }));
    await fs.promises.writeFile(
      path.join(idecDir, 'RAG_INDEX.json'),
      JSON.stringify({ files: files.length, chunks: lightIndex.length, updatedAt: Date.now() }, null, 2)
    );
    
    const duration = Date.now() - startTime;
    console.log(`[RAG] Indexed ${allChunks.length} chunks from ${files.length} files in ${duration}ms`);
    
    return { success: true, chunks: allChunks.length, files: files.length, duration };
  } catch (error) {
    console.error('[RAG] Error building index:', error);
    return { success: false, error: error.message };
  }
});

// Search RAG index
ipcMain.handle('rag-search', async (event, workspacePath, query, topK = 10) => {
  try {
    let indexData = ragIndex.get(workspacePath);
    
    // If not in memory, try to rebuild
    if (!indexData) {
      const result = await new Promise(resolve => {
        ipcMain.emit('rag-build-index', event, workspacePath);
        setTimeout(() => resolve(ragIndex.get(workspacePath)), 100);
      });
      indexData = ragIndex.get(workspacePath);
    }
    
    if (!indexData || !indexData.chunks.length) {
      return { success: false, error: 'No index available' };
    }
    
    const { chunks, idf } = indexData;
    
    // Compute query TF-IDF
    const queryTokens = tokenize(query);
    const queryTf = computeTF(queryTokens);
    const queryTfidf = {};
    Object.keys(queryTf).forEach(t => {
      queryTfidf[t] = queryTf[t] * (idf[t] || 0);
    });
    
    // Get all terms for similarity computation
    const allTerms = new Set([...Object.keys(queryTfidf), ...chunks.flatMap(c => Object.keys(c.tfidf || {}))]);
    
    // Score and rank chunks
    const scored = chunks.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryTfidf, chunk.tfidf || {}, allTerms)
    })).filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return {
      success: true,
      results: scored.map(c => ({
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
        content: c.content,
        score: c.score
      }))
    };
  } catch (error) {
    console.error('[RAG] Search error:', error);
    return { success: false, error: error.message };
  }
});

// Smart file analysis - extract relevant chunks from a file based on query
ipcMain.handle('rag-analyze-file', async (event, content, query, fileName, maxChars = 8000) => {
  try {
    // For small files, return as-is
    if (content.length <= maxChars) {
      return { success: true, content, isFullFile: true };
    }
    
    // Chunk the file content
    const chunks = chunkCode(content, fileName, 1500, 200);
    
    // Compute IDF for this file's chunks
    const docFreq = {};
    chunks.forEach(chunk => {
      const uniqueTokens = new Set(chunk.tokens);
      uniqueTokens.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });
    });
    
    const idf = {};
    const N = chunks.length;
    Object.keys(docFreq).forEach(t => {
      idf[t] = Math.log(N / docFreq[t]);
    });
    
    // Compute TF-IDF for each chunk
    chunks.forEach(chunk => {
      const tf = computeTF(chunk.tokens);
      chunk.tfidf = {};
      Object.keys(tf).forEach(t => {
        chunk.tfidf[t] = tf[t] * (idf[t] || 0);
      });
    });
    
    // Compute query TF-IDF
    const queryTokens = tokenize(query);
    const queryTf = computeTF(queryTokens);
    const queryTfidf = {};
    Object.keys(queryTf).forEach(t => {
      queryTfidf[t] = queryTf[t] * (idf[t] || 0);
    });
    
    // Get all terms for similarity computation
    const allTerms = new Set([...Object.keys(queryTfidf), ...chunks.flatMap(c => Object.keys(c.tfidf || {}))]);
    
    // Score chunks
    const scored = chunks.map((chunk, idx) => ({
      ...chunk,
      idx,
      score: cosineSimilarity(queryTfidf, chunk.tfidf || {}, allTerms)
    })).sort((a, b) => b.score - a.score);
    
    // Select top chunks that fit within maxChars, preserving some order context
    const selected = [];
    let totalSize = 0;
    
    for (const chunk of scored) {
      if (totalSize + chunk.content.length > maxChars) break;
      selected.push(chunk);
      totalSize += chunk.content.length;
    }
    
    // Sort by original position to maintain code flow
    selected.sort((a, b) => a.idx - b.idx);
    
    // Build result with context markers
    let result = '';
    let lastEndLine = -1;
    
    for (const chunk of selected) {
      if (lastEndLine >= 0 && chunk.startLine > lastEndLine + 1) {
        result += `\n... [lines ${lastEndLine + 1}-${chunk.startLine - 1} omitted] ...\n\n`;
      }
      result += `// Lines ${chunk.startLine + 1}-${chunk.endLine + 1}\n${chunk.content}\n`;
      lastEndLine = chunk.endLine;
    }
    
    const totalLines = content.split('\n').length;
    if (lastEndLine < totalLines - 1) {
      result += `\n... [lines ${lastEndLine + 2}-${totalLines} omitted] ...`;
    }
    
    console.log(`[RAG] Analyzed ${fileName}: ${content.length} chars -> ${result.length} chars (${selected.length}/${chunks.length} chunks)`);
    
    return { 
      success: true, 
      content: result, 
      isFullFile: false,
      stats: {
        originalSize: content.length,
        resultSize: result.length,
        chunksSelected: selected.length,
        totalChunks: chunks.length
      }
    };
  } catch (error) {
    console.error('[RAG] Analyze file error:', error);
    // Fallback to truncation
    return { 
      success: true, 
      content: content.slice(0, maxChars) + '\n... [truncated]',
      isFullFile: false 
    };
  }
});

// Agent mode: Execute file operations
ipcMain.handle('agent-read-file', async (event, workspacePath, filePath) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return { success: true, content, path: fullPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent-write-file', async (event, workspacePath, filePath, content) => {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspacePath, filePath);
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    return { success: true, path: fullPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent-list-files', async (event, workspacePath, dirPath = '') => {
  try {
    const fullPath = dirPath ? path.join(workspacePath, dirPath) : workspacePath;
    const items = await fs.promises.readdir(fullPath, { withFileTypes: true });
    return {
      success: true,
      files: items.map(item => ({
        name: item.name,
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory()
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent-search-files', async (event, workspacePath, pattern) => {
  try {
    const files = await scanDirectory(workspacePath, workspacePath);
    const regex = new RegExp(pattern, 'i');
    const matches = files.filter(f => regex.test(f.path)).slice(0, 50);
    return { success: true, files: matches.map(f => f.path) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agent-grep', async (event, workspacePath, searchPattern, filePattern = '*') => {
  try {
    const files = await scanDirectory(workspacePath, workspacePath);
    const fileRegex = filePattern !== '*' ? new RegExp(filePattern.replace(/\*/g, '.*'), 'i') : null;
    const searchRegex = new RegExp(searchPattern, 'gi');
    
    const results = [];
    for (const file of files.slice(0, 200)) {
      if (fileRegex && !fileRegex.test(file.path)) continue;
      
      try {
        const content = await fs.promises.readFile(file.fullPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, idx) => {
          if (searchRegex.test(line)) {
            results.push({
              file: file.path,
              line: idx + 1,
              content: line.trim().slice(0, 200)
            });
          }
        });
        
        if (results.length >= 100) break; // Limit results
      } catch (e) { /* skip */ }
    }
    
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file-dialog', async (event, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath
  });
  return result.canceled ? null : result.filePath;
});

// Terminal Operations
ipcMain.handle('terminal-create', async (event, id, cwd) => {
  console.log('[Main] terminal-create called with id:', id, 'cwd:', cwd);
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
    console.log('[Main] Using shell:', shell);
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    terminalProcesses.set(id, proc);
    console.log('[Main] Terminal process created, pid:', proc.pid);

    proc.onData((data) => {
      mainWindow?.webContents.send('terminal-data', id, data);
    });

    proc.onExit(({ exitCode }) => {
      console.log('[Main] Terminal exited with code:', exitCode);
      mainWindow?.webContents.send('terminal-exit', id, exitCode);
      terminalProcesses.delete(id);
    });

    return { success: true };
  } catch (error) {
    console.error('[Main] terminal-create error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-write', async (event, id, data) => {
  console.log('[Main] terminal-write called for id:', id, 'data:', JSON.stringify(data));
  const proc = terminalProcesses.get(id);
  if (proc) {
    proc.write(data);
    return { success: true };
  }
  console.error('[Main] terminal-write: Terminal not found:', id);
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal-kill', async (event, id) => {
  const proc = terminalProcesses.get(id);
  if (proc) {
    proc.kill();
    terminalProcesses.delete(id);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal-resize', async (event, id, cols, rows) => {
  const proc = terminalProcesses.get(id);
  if (proc) {
    proc.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// Settings persistence
ipcMain.handle('load-settings', async () => {
  const settings = loadSettings();
  return { success: true, settings };
});

ipcMain.handle('save-settings', async (event, settings) => {
  return saveSettings(settings);
});

// Path utilities for preload script
ipcMain.handle('path-join', async (event, ...args) => {
  return path.join(...args);
});

ipcMain.handle('path-basename', async (event, p) => {
  return path.basename(p);
});

ipcMain.handle('path-dirname', async (event, p) => {
  return path.dirname(p);
});

ipcMain.handle('get-home-dir', async () => {
  return os.homedir();
});

// Fetch remote JSON schema for Monaco editor
ipcMain.handle('fetch-json-schema', async (event, url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const schema = await response.text();
    return { success: true, schema };
  } catch (error) {
    console.error(`[Schema] Failed to fetch ${url}:`, error.message);
    return { success: false, error: error.message };
  }
});

// Shell operations
ipcMain.handle('shell-open-external', async (event, url) => {
  const { shell } = require('electron');
  return shell.openExternal(url);
});

// Web search for AI agent
ipcMain.handle('web-search', async (event, query, options = {}) => {
  try {
    const maxResults = options.maxResults || 5;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    console.log(`[WebSearch] Searching for: ${query}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Parse DuckDuckGo HTML results
    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    
    // Alternative parsing for DuckDuckGo
    const linkMatches = html.match(/<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>/g) || [];
    const snippetMatches = html.match(/<a class="result__snippet"[^>]*>([^<]+(?:<[^>]*>[^<]*)*)<\/a>/g) || [];
    
    for (let i = 0; i < Math.min(linkMatches.length, maxResults); i++) {
      const linkMatch = linkMatches[i];
      const snippetMatch = snippetMatches[i] || '';
      
      // Extract URL and title from link
      const urlMatch = linkMatch.match(/href="([^"]+)"/);
      const titleMatch = linkMatch.match(/>([^<]+)<\/a>/);
      
      // Clean snippet HTML
      const snippet = snippetMatch
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
      
      if (urlMatch && titleMatch) {
        let url = urlMatch[1];
        // DuckDuckGo wraps URLs in their redirect
        if (url.includes('uddg=')) {
          const actualUrl = decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url);
          url = actualUrl;
        }
        
        results.push({
          title: titleMatch[1].trim(),
          url: url,
          snippet: snippet.substring(0, 300)
        });
      }
    }
    
    console.log(`[WebSearch] Found ${results.length} results`);
    return { success: true, results, query };
  } catch (error) {
    console.error(`[WebSearch] Failed:`, error.message);
    return { success: false, error: error.message, results: [] };
  }
});

// Fetch webpage content for AI agent
ipcMain.handle('web-fetch', async (event, url, options = {}) => {
  try {
    const maxLength = options.maxLength || 10000;
    
    console.log(`[WebFetch] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { success: false, error: `Unsupported content type: ${contentType}` };
    }
    
    const html = await response.text();
    
    // Simple HTML to text conversion
    let text = html
      // Remove scripts and styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Truncate to max length
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...[truncated]';
    }
    
    console.log(`[WebFetch] Extracted ${text.length} chars of text`);
    return { success: true, content: text, url };
  } catch (error) {
    console.error(`[WebFetch] Failed:`, error.message);
    return { success: false, error: error.message };
  }
});

// Fetch available models from providers
ipcMain.handle('fetch-models', async (event, provider, config) => {
  try {
    if (provider === 'ollama') {
      const baseUrl = config.ollamaUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Ollama not running');
      const data = await response.json();
      return { 
        success: true, 
        models: (data.models || []).map(m => ({
          id: m.name,
          name: m.name,
          provider: 'ollama',
          size: m.size
        }))
      };
    } else if (provider === 'ollama-cloud') {
      if (!config.ollamaCloudApiKey) return { success: false, error: 'No Ollama Cloud API key' };
      const baseUrl = config.ollamaCloudUrl || 'https://api.ollama.com';
      const response = await fetch(`${baseUrl}/api/tags`, {
        headers: { 'Authorization': `Bearer ${config.ollamaCloudApiKey}` }
      });
      if (!response.ok) throw new Error('Failed to fetch Ollama Cloud models');
      const data = await response.json();
      return { 
        success: true, 
        models: (data.models || []).map(m => ({
          id: m.name,
          name: m.name,
          provider: 'ollama-cloud',
          size: m.size
        }))
      };
    } else if (provider === 'claude') {
      // Claude models are fixed
      return {
        success: true,
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude' },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'claude' },
        ]
      };
    } else if (provider === 'openai') {
      if (!config.openaiApiKey) return { success: false, error: 'No API key' };
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${config.openaiApiKey}` }
      });
      if (!response.ok) throw new Error('Failed to fetch OpenAI models');
      const data = await response.json();
      const chatModels = data.data.filter(m => m.id.includes('gpt')).slice(0, 10);
      return {
        success: true,
        models: chatModels.map(m => ({ id: m.id, name: m.id, provider: 'openai' }))
      };
    } else if (provider === 'openrouter') {
      if (!config.openrouterApiKey) return { success: false, error: 'No OpenRouter API key' };
      // Use curated list of popular, reliable models instead of dynamic fetch
      // These are known to work well with standard OpenAI-compatible streaming
      const popularModels = [
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
        { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
        { id: 'mistralai/mistral-large', name: 'Mistral Large' },
        { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B' },
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
      ];
      return {
        success: true,
        models: popularModels.map(m => ({ 
          id: m.id, 
          name: m.name, 
          provider: 'openrouter' 
        }))
      };
    } else if (provider === 'groq') {
      return {
        success: true,
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq' },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq' },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq' },
          { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq' },
        ]
      };
    }
    return { success: false, error: 'Unknown provider' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Pull Ollama model
ipcMain.handle('ollama-pull', async (event, model, baseUrl = 'http://localhost:11434') => {
  try {
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false })
    });
    if (!response.ok) throw new Error('Failed to pull model');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// AI Operations
// AI request timeout (60 seconds)
const AI_REQUEST_TIMEOUT = 60000;

// Helper for logging AI requests
const logAIRequest = (provider, model, endpoint, body) => {
  console.log(`[AI Request] Provider: ${provider}, Model: ${model}`);
  console.log(`[AI Request] Endpoint: ${endpoint}`);
  console.log(`[AI Request] Payload:`, JSON.stringify(body, null, 2).slice(0, 500) + '...');
};

const logAIResponse = (provider, success, data, duration) => {
  console.log(`[AI Response] Provider: ${provider}, Success: ${success}, Duration: ${duration}ms`);
  if (success) {
    console.log(`[AI Response] Content preview:`, (data?.content || data?.choices?.[0]?.message?.content || '').slice(0, 200) + '...');
  } else {
    console.log(`[AI Response] Error:`, data?.error || data);
  }
};

// Fetch with timeout helper
const fetchWithTimeout = async (url, options, timeout = AI_REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw error;
  }
};

ipcMain.handle('ai-request', async (event, provider, model, messages, config) => {
  const startTime = Date.now();
  try {
    if (provider === 'claude') {
      if (!config.claudeApiKey) return { success: false, error: 'No Claude API key' };
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const body = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const duration = Date.now() - startTime;
      if (data.error) {
        logAIResponse(provider, false, data, duration);
        return { success: false, error: data.error.message };
      }
      logAIResponse(provider, true, { content: data.content[0].text }, duration);
      return { success: true, content: data.content[0].text };
    } 
    
    else if (provider === 'ollama') {
      const baseUrl = config.ollamaUrl || 'http://localhost:11434';
      const endpoint = `${baseUrl}/api/chat`;
      const body = {
        model: model || 'llama3.2',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const duration = Date.now() - startTime;
        logAIResponse(provider, false, { error: 'Ollama request failed' }, duration);
        throw new Error('Ollama request failed');
      }
      const data = await response.json();
      const duration = Date.now() - startTime;
      logAIResponse(provider, true, { content: data.message.content }, duration);
      return { success: true, content: data.message.content };
    }
    
    else if (provider === 'ollama-cloud') {
      if (!config.ollamaCloudApiKey) return { success: false, error: 'No Ollama Cloud API key' };
      const baseUrl = config.ollamaCloudUrl || 'https://api.ollama.com';
      const endpoint = `${baseUrl}/api/chat`;
      const body = {
        model: model || 'llama3.2',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ollamaCloudApiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const duration = Date.now() - startTime;
        logAIResponse(provider, false, { error: 'Ollama Cloud request failed' }, duration);
        throw new Error('Ollama Cloud request failed');
      }
      const data = await response.json();
      const duration = Date.now() - startTime;
      logAIResponse(provider, true, { content: data.message.content }, duration);
      return { success: true, content: data.message.content };
    }
    
    else if (provider === 'openai') {
      if (!config.openaiApiKey) return { success: false, error: 'No OpenAI API key' };
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const body = {
        model: model || 'gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openaiApiKey}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const duration = Date.now() - startTime;
      if (data.error) {
        logAIResponse(provider, false, data, duration);
        return { success: false, error: data.error.message };
      }
      logAIResponse(provider, true, data, duration);
      return { success: true, content: data.choices[0].message.content };
    }
    
    else if (provider === 'openrouter') {
      if (!config.openrouterApiKey) return { success: false, error: 'No OpenRouter API key' };
      const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      const body = {
        model: model || 'openai/gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'https://idec.app',
          'X-Title': 'IDEC'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const duration = Date.now() - startTime;
      if (data.error) {
        logAIResponse(provider, false, data, duration);
        return { success: false, error: data.error.message };
      }
      logAIResponse(provider, true, data, duration);
      return { success: true, content: data.choices[0].message.content };
    }
    
    else if (provider === 'groq') {
      if (!config.groqApiKey) return { success: false, error: 'No Groq API key' };
      const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      const body = {
        model: model || 'llama-3.3-70b-versatile',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096
      };
      logAIRequest(provider, model, endpoint, body);
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.groqApiKey}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      const duration = Date.now() - startTime;
      if (data.error) {
        logAIResponse(provider, false, data, duration);
        return { success: false, error: data.error.message };
      }
      logAIResponse(provider, true, data, duration);
      return { success: true, content: data.choices[0].message.content };
    }
    
    return { success: false, error: 'Unknown provider' };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AI Error] Provider: ${provider}, Duration: ${duration}ms, Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Track active stream controllers for cancellation
const activeStreams = new Map();

// Stop streaming request
ipcMain.handle('ai-stream-stop', async (event, requestId) => {
  console.log(`[AI Stream] Stop requested for: ${requestId}`);
  const controller = activeStreams.get(requestId);
  if (controller) {
    controller.abort();
    activeStreams.delete(requestId);
    return { success: true };
  }
  return { success: false, error: 'No active stream found' };
});

// AI Inline Completion (for editor ghost text like Cursor)
ipcMain.handle('ai-inline-completion', async (event, { prefix, suffix, language, fileName }) => {
  console.log(`[AI Inline] Requesting completion for ${fileName} (${language})`);
  sendOutputLog('AI Completion', 'info', `Requesting completion for ${fileName} (${language})`);
  
  // Load settings to get API key
  const settings = loadSettings();
  const config = settings?.ai || {};
  const provider = config.provider || 'claude';
  
  try {
    let completion = '';
    
    // Build prompt for code completion
    const systemPrompt = `You are an intelligent code completion assistant. Complete the code naturally at the cursor position.
RULES:
- Return ONLY the completion text, no explanation
- Complete the current line/statement naturally
- Match the existing code style
- Keep completions short and focused (1-3 lines max)
- If unsure, return empty string`;
    
    const userPrompt = `Language: ${language}
File: ${fileName}

Code before cursor:
\`\`\`
${prefix.slice(-500)}
\`\`\`

Code after cursor:
\`\`\`
${suffix.slice(0, 200)}
\`\`\`

Complete the code at the cursor position. Return ONLY the completion text:`;

    if (provider === 'claude' && config.claudeApiKey) {
      const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.claudeModel || 'claude-sonnet-4-20250514',
          max_tokens: 150,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      }, 5000); // 5 second timeout for inline completions
      
      const data = await response.json();
      if (data.content?.[0]?.text) {
        completion = data.content[0].text.trim();
      }
    } else if (provider === 'openrouter' && config.openrouterApiKey) {
      const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'https://idec.dev',
          'X-Title': 'IDEC'
        },
        body: JSON.stringify({
          model: config.openrouterModel || 'anthropic/claude-3.5-sonnet',
          max_tokens: 150,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      }, 5000);
      
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        completion = data.choices[0].message.content.trim();
      }
    } else if (provider === 'ollama') {
      const baseUrl = config.ollamaUrl || 'http://localhost:11434';
      const response = await fetchWithTimeout(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'codellama',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: { num_predict: 100 }
        })
      }, 5000);
      
      const data = await response.json();
      if (data.message?.content) {
        completion = data.message.content.trim();
      }
    }
    
    // Clean up completion - remove markdown code blocks if present
    completion = completion.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    
    console.log(`[AI Inline] Got completion: "${completion.substring(0, 50)}..."`);
    sendOutputLog('AI Completion', 'info', `Got completion (${completion.length} chars)`);
    return { success: true, completion };
  } catch (error) {
    console.error('[AI Inline] Error:', error.message);
    sendOutputLog('AI Completion', 'error', `Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Streaming AI request handler
ipcMain.handle('ai-request-stream', async (event, provider, model, messages, config, options = {}) => {
  // Debug: log what we received
  console.log(`[AI Stream] Handler received - options type: ${typeof options}, options: ${JSON.stringify(options)}`);
  // Use requestId from renderer if provided (to avoid race condition), otherwise generate one
  const requestId = options?.requestId || `stream_${Date.now()}`;
  const isThinkingModel = options?.enableThinking;
  console.log(`[AI Stream] Handler called - using requestId: ${requestId}, from options: ${!!options?.requestId}`);
  sendOutputLog('AI Chat', 'info', `Starting ${provider} request with model: ${model}`);
  
  try {
    let endpoint, headers, body;
    
    if (provider === 'claude') {
      if (!config.claudeApiKey) return { success: false, error: 'No Claude API key' };
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01'
      };
      body = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: isThinkingModel ? 16000 : 4096,
        stream: true,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      };
      
      // Enable extended thinking for thinking models
      if (isThinkingModel) {
        body.thinking = { type: 'enabled', budget_tokens: 10000 };
      }
    } else if (provider === 'openai') {
      if (!config.openaiApiKey) return { success: false, error: 'No OpenAI API key' };
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      };
      body = {
        model: model || 'gpt-4o',
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      };
    } else if (provider === 'ollama') {
      const baseUrl = config.ollamaUrl || 'http://localhost:11434';
      endpoint = `${baseUrl}/api/chat`;
      headers = { 'Content-Type': 'application/json' };
      body = {
        model: model || 'llama3.2',
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      };
    } else if (provider === 'groq') {
      if (!config.groqApiKey) return { success: false, error: 'No Groq API key' };
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groqApiKey}`
      };
      body = {
        model: model || 'llama-3.3-70b-versatile',
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      };
    } else if (provider === 'openrouter') {
      if (!config.openrouterApiKey) return { success: false, error: 'No OpenRouter API key' };
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': 'https://idec.app',
        'X-Title': 'IDEC'
      };
      body = {
        model: model || 'openai/gpt-4o',
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      };
    } else {
      return { success: false, error: 'Unknown provider' };
    }
    
    console.log(`[AI Stream] Starting stream request to ${provider} with model ${model}`);
    
    // Create AbortController for this request
    const abortController = new AbortController();
    activeStreams.set(requestId, abortController);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortController.signal
    });
    
    if (!response.ok) {
      activeStreams.delete(requestId);
      const errorData = await response.text();
      console.error(`[AI Stream] Error response:`, errorData);
      return { success: false, error: `Request failed: ${response.status}` };
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let thinkingContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            let text = '';
            let isThinking = false;
            
            // Handle different provider formats
            if (provider === 'claude') {
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'thinking_delta') {
                  text = parsed.delta.thinking || '';
                  isThinking = true;
                  thinkingContent += text;
                } else if (parsed.delta?.type === 'text_delta') {
                  text = parsed.delta.text || '';
                  fullContent += text;
                }
              }
            } else if (provider === 'ollama') {
              text = parsed.message?.content || '';
              fullContent += text;
            } else {
              // OpenAI, Groq, OpenRouter format
              text = parsed.choices?.[0]?.delta?.content || '';
              fullContent += text;
            }
            
            if (text) {
              safeSend('ai-stream-chunk', {
                requestId,
                text,
                isThinking,
                fullContent,
                thinkingContent
              });
            }
          } catch (e) {
            // Skip malformed JSON
          }
        } else if (provider === 'ollama' && line.trim()) {
          // Ollama uses newline-delimited JSON without 'data:' prefix
          try {
            const parsed = JSON.parse(line);
            const text = parsed.message?.content || '';
            if (text) {
              fullContent += text;
              safeSend('ai-stream-chunk', {
                requestId,
                text,
                isThinking: false,
                fullContent,
                thinkingContent: ''
              });
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    } finally {
      activeStreams.delete(requestId);
    }
    
    safeSend('ai-stream-done', { requestId, fullContent, thinkingContent });
    console.log(`[AI Stream] Completed - ${fullContent.length} chars`);
    return { success: true, requestId };
    
  } catch (error) {
    activeStreams.delete(requestId);
    // Don't report abort as error
    if (error.name === 'AbortError') {
      console.log(`[AI Stream] Aborted by user: ${requestId}`);
      safeSend('ai-stream-done', { requestId, fullContent: '', thinkingContent: '', aborted: true });
      return { success: true, requestId, aborted: true };
    }
    console.error(`[AI Stream] Error:`, error);
    safeSend('ai-stream-error', { requestId, error: error.message });
    return { success: false, error: error.message };
  }
});

// VS Code Settings Import
ipcMain.handle('import-vscode-settings', async () => {
  try {
    const homedir = os.homedir();
    let vscodeSettingsPath;
    
    // Find VS Code settings based on platform
    if (process.platform === 'darwin') {
      vscodeSettingsPath = path.join(homedir, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    } else if (process.platform === 'win32') {
      vscodeSettingsPath = path.join(homedir, 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
    } else {
      vscodeSettingsPath = path.join(homedir, '.config', 'Code', 'User', 'settings.json');
    }
    
    if (!fs.existsSync(vscodeSettingsPath)) {
      return { success: false, error: 'VS Code settings not found' };
    }
    
    const vscodeSettings = JSON.parse(fs.readFileSync(vscodeSettingsPath, 'utf-8'));
    
    // Map VS Code settings to IDEC settings
    const mappedSettings = {
      theme: mapVSCodeTheme(vscodeSettings['workbench.colorTheme']),
      editor: {
        fontSize: vscodeSettings['editor.fontSize'] || 14,
        fontFamily: vscodeSettings['editor.fontFamily'],
        tabSize: vscodeSettings['editor.tabSize'] || 2,
        insertSpaces: vscodeSettings['editor.insertSpaces'] !== false,
        wordWrap: vscodeSettings['editor.wordWrap'] || 'off',
        minimap: vscodeSettings['editor.minimap.enabled'] !== false,
        lineNumbers: vscodeSettings['editor.lineNumbers'] || 'on',
        renderWhitespace: vscodeSettings['editor.renderWhitespace'] || 'none',
        bracketPairColorization: vscodeSettings['editor.bracketPairColorization.enabled'] !== false,
        cursorBlinking: vscodeSettings['editor.cursorBlinking'] || 'smooth',
        cursorStyle: vscodeSettings['editor.cursorStyle'] || 'line',
        formatOnSave: vscodeSettings['editor.formatOnSave'] || false,
      },
      terminal: {
        fontSize: vscodeSettings['terminal.integrated.fontSize'] || 13,
        fontFamily: vscodeSettings['terminal.integrated.fontFamily'],
      },
      files: {
        autoSave: vscodeSettings['files.autoSave'] || 'off',
        trimTrailingWhitespace: vscodeSettings['files.trimTrailingWhitespace'] || false,
        insertFinalNewline: vscodeSettings['files.insertFinalNewline'] || false,
      },
    };
    
    return { success: true, settings: mappedSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function mapVSCodeTheme(vsTheme) {
  if (!vsTheme) return 'idec-dark';
  const vsThemeLower = vsTheme.toLowerCase();
  if (vsThemeLower.includes('monokai')) return 'monokai';
  if (vsThemeLower.includes('dracula')) return 'dracula';
  if (vsThemeLower.includes('github') && vsThemeLower.includes('dark')) return 'github-dark';
  if (vsThemeLower.includes('one dark')) return 'one-dark';
  if (vsThemeLower.includes('solarized') && vsThemeLower.includes('dark')) return 'solarized-dark';
  if (vsThemeLower.includes('nord')) return 'nord';
  if (vsThemeLower.includes('light')) return 'idec-light';
  return 'idec-dark';
}

// Extension Management
ipcMain.handle('extensions-list', async () => {
  try {
    ensureExtensionsDir();
    const meta = loadExtensionsMeta();
    const count = (meta.installed || []).length;
    if (count > 0) {
      sendOutputLog('Extensions', 'info', `Loaded ${count} installed extension(s)`);
    }
    return { success: true, extensions: meta.installed || [] };
  } catch (error) {
    sendOutputLog('Extensions', 'error', `Failed to load extensions: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('extensions-search', async (event, query) => {
  try {
    // Search Open VSX registry
    const response = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    
    const extensions = (data.extensions || []).map(ext => ({
      id: `${ext.namespace}.${ext.name}`,
      name: ext.displayName || ext.name,
      publisher: ext.namespace,
      description: ext.description,
      version: ext.version,
      downloads: ext.downloadCount ? formatDownloads(ext.downloadCount) : undefined,
      rating: ext.averageRating,
      icon: '📦',
    }));
    
    return { success: true, extensions };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function formatDownloads(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

ipcMain.handle('extensions-install', async (event, extensionId) => {
  try {
    ensureExtensionsDir();
    sendOutputLog('Extensions', 'info', `Installing extension: ${extensionId}...`);
    
    // Parse extension ID
    const [namespace, name] = extensionId.split('.');
    if (!namespace || !name) throw new Error('Invalid extension ID');
    
    // Get extension info from Open VSX
    sendOutputLog('Extensions', 'info', `Fetching extension info from Open VSX...`);
    const infoResponse = await fetch(`https://open-vsx.org/api/${namespace}/${name}`);
    if (!infoResponse.ok) throw new Error('Extension not found');
    const info = await infoResponse.json();
    
    // Download VSIX
    const downloadUrl = info.files?.download;
    if (!downloadUrl) throw new Error('Download URL not found');
    
    sendOutputLog('Extensions', 'info', `Downloading ${info.displayName || info.name} v${info.version}...`);
    const vsixResponse = await fetch(downloadUrl);
    if (!vsixResponse.ok) throw new Error('Failed to download extension');
    
    const vsixBuffer = Buffer.from(await vsixResponse.arrayBuffer());
    const vsixPath = path.join(extensionsDir, `${extensionId}-${info.version}.vsix`);
    fs.writeFileSync(vsixPath, vsixBuffer);
    sendOutputLog('Extensions', 'info', `Downloaded ${(vsixBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Extract VSIX (it's a zip file)
    const extDir = path.join(extensionsDir, extensionId);
    if (fs.existsSync(extDir)) {
      fs.rmSync(extDir, { recursive: true });
    }
    fs.mkdirSync(extDir, { recursive: true });
    
    // Use unzip command
    sendOutputLog('Extensions', 'info', `Extracting extension files...`);
    const { execSync } = require('child_process');
    execSync(`unzip -q "${vsixPath}" -d "${extDir}"`);
    
    // Clean up vsix file
    fs.unlinkSync(vsixPath);
    
    // Update metadata
    const meta = loadExtensionsMeta();
    const extMeta = {
      id: extensionId,
      name: info.displayName || info.name,
      publisher: namespace,
      description: info.description,
      version: info.version,
      installedAt: new Date().toISOString(),
      path: extDir,
    };
    
    meta.installed = meta.installed.filter(e => e.id !== extensionId);
    meta.installed.push(extMeta);
    saveExtensionsMeta(meta);
    
    sendOutputLog('Extensions', 'info', `Successfully installed ${info.displayName || info.name} v${info.version}`);
    return { success: true };
  } catch (error) {
    sendOutputLog('Extensions', 'error', `Failed to install ${extensionId}: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('extensions-uninstall', async (event, extensionId) => {
  try {
    ensureExtensionsDir();
    sendOutputLog('Extensions', 'info', `Uninstalling extension: ${extensionId}...`);
    
    const extDir = path.join(extensionsDir, extensionId);
    if (fs.existsSync(extDir)) {
      fs.rmSync(extDir, { recursive: true });
    }
    
    const meta = loadExtensionsMeta();
    const extInfo = meta.installed.find(e => e.id === extensionId);
    meta.installed = meta.installed.filter(e => e.id !== extensionId);
    saveExtensionsMeta(meta);
    
    sendOutputLog('Extensions', 'info', `Successfully uninstalled ${extInfo?.name || extensionId}`);
    return { success: true };
  } catch (error) {
    sendOutputLog('Extensions', 'error', `Failed to uninstall ${extensionId}: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('extensions-install-vsix', async () => {
  try {
    ensureExtensionsDir();
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select VSIX file',
      filters: [{ name: 'VS Code Extension', extensions: ['vsix'] }],
      properties: ['openFile'],
    });
    
    if (result.canceled || !result.filePaths[0]) {
      return { success: false, error: 'Cancelled' };
    }
    
    const vsixPath = result.filePaths[0];
    const fileName = path.basename(vsixPath, '.vsix');
    sendOutputLog('Extensions', 'info', `Installing VSIX file: ${fileName}...`);
    
    const extDir = path.join(extensionsDir, fileName);
    
    if (fs.existsSync(extDir)) {
      fs.rmSync(extDir, { recursive: true });
    }
    fs.mkdirSync(extDir, { recursive: true });
    
    // Extract VSIX
    sendOutputLog('Extensions', 'info', `Extracting extension files...`);
    const { execSync } = require('child_process');
    execSync(`unzip -q "${vsixPath}" -d "${extDir}"`);
    
    // Read package.json from extension
    const packageJsonPath = path.join(extDir, 'extension', 'package.json');
    let extInfo = { name: fileName, displayName: fileName, description: '', version: '1.0.0' };
    if (fs.existsSync(packageJsonPath)) {
      extInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }
    
    // Update metadata
    const meta = loadExtensionsMeta();
    const extMeta = {
      id: fileName,
      name: extInfo.displayName || extInfo.name || fileName,
      publisher: extInfo.publisher || 'Local',
      description: extInfo.description || '',
      version: extInfo.version || '1.0.0',
      installedAt: new Date().toISOString(),
      path: extDir,
    };
    
    meta.installed = meta.installed.filter(e => e.id !== fileName);
    meta.installed.push(extMeta);
    saveExtensionsMeta(meta);
    
    sendOutputLog('Extensions', 'info', `Successfully installed ${extMeta.name} v${extMeta.version} from VSIX`);
    return { success: true };
  } catch (error) {
    sendOutputLog('Extensions', 'error', `Failed to install VSIX: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Git Operations
const { exec } = require('child_process');

function runGitCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

ipcMain.handle('git-status', async (event, workspacePath) => {
  try {
    const status = await runGitCommand('git status --porcelain', workspacePath);
    const branch = await runGitCommand('git branch --show-current', workspacePath);
    const files = status.split('\n').filter(line => line).map(line => ({
      status: line.substring(0, 2).trim(),
      path: line.substring(3)
    }));
    return { success: true, branch, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-init', async (event, workspacePath) => {
  try {
    await runGitCommand('git init', workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-stage', async (event, workspacePath, filePath) => {
  try {
    await runGitCommand(`git add "${filePath}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-stage-all', async (event, workspacePath) => {
  try {
    await runGitCommand('git add -A', workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-unstage', async (event, workspacePath, filePath) => {
  try {
    await runGitCommand(`git restore --staged "${filePath}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-commit', async (event, workspacePath, message) => {
  try {
    await runGitCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-log', async (event, workspacePath, limit = 50) => {
  try {
    const format = '%H|%h|%s|%an|%ae|%ad|%ar';
    const log = await runGitCommand(`git log --pretty=format:"${format}" -n ${limit}`, workspacePath);
    const commits = log.split('\n').filter(line => line).map(line => {
      const [hash, shortHash, message, author, email, date, relative] = line.split('|');
      return { hash, shortHash, message, author, email, date, relative };
    });
    return { success: true, commits };
  } catch (error) {
    return { success: false, error: error.message, commits: [] };
  }
});

ipcMain.handle('git-diff', async (event, workspacePath, filePath) => {
  try {
    const diff = await runGitCommand(`git diff "${filePath}"`, workspacePath);
    return { success: true, diff };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-discard', async (event, workspacePath, filePath) => {
  try {
    await runGitCommand(`git checkout -- "${filePath}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-branches', async (event, workspacePath) => {
  try {
    const branches = await runGitCommand('git branch -a', workspacePath);
    const current = await runGitCommand('git branch --show-current', workspacePath);
    const list = branches.split('\n').filter(b => b).map(b => ({
      name: b.replace(/^\*?\s*/, '').trim(),
      current: b.startsWith('*')
    }));
    return { success: true, branches: list, current };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-checkout', async (event, workspacePath, branch) => {
  try {
    await runGitCommand(`git checkout "${branch}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-create-branch', async (event, workspacePath, branchName) => {
  try {
    await runGitCommand(`git checkout -b "${branchName}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-push', async (event, workspacePath, remote = 'origin', branch) => {
  try {
    const currentBranch = branch || await runGitCommand('git branch --show-current', workspacePath);
    await runGitCommand(`git push ${remote} ${currentBranch}`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-pull', async (event, workspacePath) => {
  try {
    await runGitCommand('git pull', workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-clone', async (event, repoUrl, targetPath) => {
  try {
    await runGitCommand(`git clone "${repoUrl}" "${targetPath}"`, path.dirname(targetPath));
    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git-is-repo', async (event, workspacePath) => {
  try {
    await runGitCommand('git rev-parse --git-dir', workspacePath);
    return { success: true, isRepo: true };
  } catch (error) {
    return { success: true, isRepo: false };
  }
});

ipcMain.handle('git-remotes', async (event, workspacePath) => {
  try {
    const remotes = await runGitCommand('git remote -v', workspacePath);
    const list = remotes.split('\n').filter(r => r && r.includes('(fetch)')).map(r => {
      const parts = r.split(/\s+/);
      return { name: parts[0], url: parts[1] };
    });
    return { success: true, remotes: list };
  } catch (error) {
    return { success: false, error: error.message, remotes: [] };
  }
});

ipcMain.handle('git-add-remote', async (event, workspacePath, name, url) => {
  try {
    await runGitCommand(`git remote add ${name} "${url}"`, workspacePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Project Creation
ipcMain.handle('create-project', async (event, projectPath, projectType) => {
  try {
    await fs.promises.mkdir(projectPath, { recursive: true });
    await runGitCommand('git init', projectPath);
    
    if (projectType === 'javascript' || projectType === 'node') {
      const packageJson = {
        name: path.basename(projectPath),
        version: '1.0.0',
        description: '',
        main: 'index.js',
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
        keywords: [],
        author: '',
        license: 'MIT'
      };
      await fs.promises.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
      await fs.promises.writeFile(path.join(projectPath, 'index.js'), '// Entry point\nconsole.log("Hello, World!");\n');
    } else if (projectType === 'react') {
      const packageJson = {
        name: path.basename(projectPath),
        version: '1.0.0',
        main: 'src/index.js',
        scripts: { start: 'react-scripts start', build: 'react-scripts build', test: 'react-scripts test' },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }
      };
      await fs.promises.mkdir(path.join(projectPath, 'src'), { recursive: true });
      await fs.promises.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
      await fs.promises.writeFile(path.join(projectPath, 'src/index.js'), `import React from 'react';\nimport ReactDOM from 'react-dom/client';\n\nfunction App() {\n  return <h1>Hello, React!</h1>;\n}\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n`);
    } else if (projectType === 'python') {
      await fs.promises.writeFile(path.join(projectPath, 'main.py'), '# Main entry point\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n');
      await fs.promises.writeFile(path.join(projectPath, 'requirements.txt'), '# Python dependencies\n');
    } else {
      await fs.promises.writeFile(path.join(projectPath, 'README.md'), `# ${path.basename(projectPath)}\n\nA new project.\n`);
    }
    
    await fs.promises.writeFile(path.join(projectPath, '.gitignore'), 'node_modules/\n.DS_Store\n*.log\ndist/\nbuild/\n.env\n__pycache__/\n*.pyc\n');
    return { success: true, path: projectPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Location'
  });
  return result.canceled ? null : result.filePaths[0];
});

// GitHub Integration
const { safeStorage, shell, net } = require('electron');
const crypto = require('crypto');

const githubTokenPath = path.join(app.getPath('userData'), 'github-token.enc');
const githubUserPath = path.join(app.getPath('userData'), 'github-user.json');

// GitHub OAuth Configuration - Users should create their own GitHub OAuth App
// Go to: GitHub Settings > Developer settings > OAuth Apps > New OAuth App
// Set callback URL to: idec://oauth/callback
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

// Store GitHub token securely
async function saveGitHubToken(token) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      await fs.promises.writeFile(githubTokenPath, encrypted);
    } else {
      // Fallback to base64 encoding (less secure)
      await fs.promises.writeFile(githubTokenPath, Buffer.from(token).toString('base64'));
    }
    return true;
  } catch (error) {
    console.error('Error saving GitHub token:', error);
    return false;
  }
}

// Load GitHub token
async function loadGitHubToken() {
  try {
    if (!fs.existsSync(githubTokenPath)) return null;
    const data = await fs.promises.readFile(githubTokenPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data);
    } else {
      return Buffer.from(data.toString(), 'base64').toString();
    }
  } catch (error) {
    console.error('Error loading GitHub token:', error);
    return null;
  }
}

// Save GitHub user info
async function saveGitHubUser(user) {
  try {
    await fs.promises.writeFile(githubUserPath, JSON.stringify(user, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

// Load GitHub user info
async function loadGitHubUser() {
  try {
    if (!fs.existsSync(githubUserPath)) return null;
    const data = await fs.promises.readFile(githubUserPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// GitHub API helper
async function githubAPI(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'IDEC-App',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

// OAuth state for security
let oauthState = null;

// Start GitHub OAuth flow
ipcMain.handle('github-login', async () => {
  try {
    if (!GITHUB_CLIENT_ID) {
      // Use device flow for apps without client secret
      return await startDeviceFlow();
    }
    
    oauthState = crypto.randomBytes(16).toString('hex');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo,user,read:org&state=${oauthState}`;
    
    shell.openExternal(authUrl);
    return { success: true, method: 'oauth' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Device flow for authentication (no client secret needed)
async function startDeviceFlow() {
  try {
    const clientId = GITHUB_CLIENT_ID || 'Iv1.your_client_id'; // Users need to set this
    
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'repo user read:org'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start device flow');
    }
    
    const data = await response.json();
    return {
      success: true,
      method: 'device',
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      deviceCode: data.device_code,
      expiresIn: data.expires_in,
      interval: data.interval
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Poll for device flow token
ipcMain.handle('github-device-poll', async (event, deviceCode, clientId) => {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId || GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });
    
    const data = await response.json();
    
    if (data.error === 'authorization_pending') {
      return { success: false, pending: true };
    }
    
    if (data.error) {
      return { success: false, error: data.error_description || data.error };
    }
    
    if (data.access_token) {
      await saveGitHubToken(data.access_token);
      
      // Fetch user info
      const user = await githubAPI('/user', data.access_token);
      await saveGitHubUser(user);
      
      return { success: true, user };
    }
    
    return { success: false, error: 'No token received' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Login with Personal Access Token
ipcMain.handle('github-login-token', async (event, token) => {
  try {
    // Validate token by fetching user
    const user = await githubAPI('/user', token);
    
    await saveGitHubToken(token);
    await saveGitHubUser(user);
    
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if logged in
ipcMain.handle('github-get-user', async () => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    // Try to get cached user first
    let user = await loadGitHubUser();
    
    // Verify token is still valid
    try {
      user = await githubAPI('/user', token);
      await saveGitHubUser(user);
    } catch (error) {
      // Token might be invalid
      return { success: false, error: 'Token expired' };
    }
    
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Logout
ipcMain.handle('github-logout', async () => {
  try {
    if (fs.existsSync(githubTokenPath)) {
      await fs.promises.unlink(githubTokenPath);
    }
    if (fs.existsSync(githubUserPath)) {
      await fs.promises.unlink(githubUserPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get user's repositories
ipcMain.handle('github-repos', async (event, page = 1, perPage = 30) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const repos = await githubAPI(`/user/repos?sort=updated&per_page=${perPage}&page=${page}`, token);
    return { success: true, repos };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Search repositories
ipcMain.handle('github-search-repos', async (event, query, page = 1) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const result = await githubAPI(`/search/repositories?q=${encodeURIComponent(query)}&per_page=20&page=${page}`, token);
    return { success: true, repos: result.items, total: result.total_count };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get repository details
ipcMain.handle('github-repo', async (event, owner, repo) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const repository = await githubAPI(`/repos/${owner}/${repo}`, token);
    return { success: true, repo: repository };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create new repository
ipcMain.handle('github-create-repo', async (event, name, description, isPrivate = false) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const repo = await githubAPI('/user/repos', token, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: false
      })
    });
    
    return { success: true, repo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get issues for a repo
ipcMain.handle('github-issues', async (event, owner, repo, state = 'open', page = 1) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const issues = await githubAPI(`/repos/${owner}/${repo}/issues?state=${state}&per_page=20&page=${page}`, token);
    return { success: true, issues };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get pull requests for a repo
ipcMain.handle('github-pulls', async (event, owner, repo, state = 'open', page = 1) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const pulls = await githubAPI(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=20&page=${page}`, token);
    return { success: true, pulls };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create issue
ipcMain.handle('github-create-issue', async (event, owner, repo, title, body) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const issue = await githubAPI(`/repos/${owner}/${repo}/issues`, token, {
      method: 'POST',
      body: JSON.stringify({ title, body })
    });
    
    return { success: true, issue };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get notifications
ipcMain.handle('github-notifications', async (event, all = false) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const notifications = await githubAPI(`/notifications?all=${all}`, token);
    return { success: true, notifications };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get user's gists
ipcMain.handle('github-gists', async (event, page = 1) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const gists = await githubAPI(`/gists?per_page=20&page=${page}`, token);
    return { success: true, gists };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create gist
ipcMain.handle('github-create-gist', async (event, description, files, isPublic = false) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const gist = await githubAPI('/gists', token, {
      method: 'POST',
      body: JSON.stringify({
        description,
        public: isPublic,
        files
      })
    });
    
    return { success: true, gist };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fork repository
ipcMain.handle('github-fork', async (event, owner, repo) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const fork = await githubAPI(`/repos/${owner}/${repo}/forks`, token, {
      method: 'POST'
    });
    
    return { success: true, fork };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Star/unstar repository
ipcMain.handle('github-star', async (event, owner, repo, star = true) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
      method: star ? 'PUT' : 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Length': '0'
      }
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if repo is starred
ipcMain.handle('github-is-starred', async (event, owner, repo) => {
  try {
    const token = await loadGitHubToken();
    if (!token) return { success: false, error: 'Not logged in' };
    
    const response = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return { success: true, starred: response.status === 204 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
