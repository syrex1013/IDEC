import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, FilePlus, FolderPlus, Trash2, Edit3, Copy, Move, Clipboard, Clock, Folder } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

// Clipboard for copy/cut operations
let clipboardItem = null;
let clipboardOperation = null; // 'copy' or 'cut'

// Material Design File Icons with colors (using text badges for broad compatibility)
const materialIcons = {
  // JavaScript/TypeScript
  js: { icon: 'JS', color: '#F7DF1E', bg: '#323330' },
  jsx: { icon: 'JSX', color: '#61DAFB', bg: '#20232a' },
  ts: { icon: 'TS', color: '#fff', bg: '#3178C6' },
  tsx: { icon: 'TSX', color: '#fff', bg: '#3178C6' },
  mjs: { icon: 'MJS', color: '#F7DF1E', bg: '#323330' },
  cjs: { icon: 'CJS', color: '#F7DF1E', bg: '#323330' },
  
  // Web
  html: { icon: 'HTML', color: '#fff', bg: '#E44D26' },
  htm: { icon: 'HTM', color: '#fff', bg: '#E44D26' },
  css: { icon: 'CSS', color: '#fff', bg: '#1572B6' },
  scss: { icon: 'SCSS', color: '#fff', bg: '#CC6699' },
  sass: { icon: 'SASS', color: '#fff', bg: '#CC6699' },
  less: { icon: 'LESS', color: '#fff', bg: '#1D365D' },
  
  // Data/Config
  json: { icon: '{ }', color: '#323330', bg: '#F7DF1E' },
  yaml: { icon: 'YML', color: '#fff', bg: '#CB171E' },
  yml: { icon: 'YML', color: '#fff', bg: '#CB171E' },
  xml: { icon: 'XML', color: '#fff', bg: '#E34F26' },
  toml: { icon: 'TOML', color: '#fff', bg: '#9C4121' },
  ini: { icon: 'INI', color: '#fff', bg: '#6d8086' },
  env: { icon: 'ENV', color: '#323330', bg: '#ECD53F' },
  
  // Python
  py: { icon: 'PY', color: '#fff', bg: '#3776AB' },
  pyw: { icon: 'PY', color: '#fff', bg: '#3776AB' },
  pyx: { icon: 'PYX', color: '#323330', bg: '#FFD43B' },
  ipynb: { icon: 'NB', color: '#fff', bg: '#F37626' },
  
  // Java/JVM
  java: { icon: 'JAVA', color: '#fff', bg: '#007396' },
  kt: { icon: 'KT', color: '#fff', bg: '#A97BFF' },
  kts: { icon: 'KTS', color: '#fff', bg: '#A97BFF' },
  scala: { icon: 'SC', color: '#fff', bg: '#DC322F' },
  groovy: { icon: 'GVY', color: '#fff', bg: '#4298B8' },
  
  // C/C++/C#
  c: { icon: 'C', color: '#fff', bg: '#A8B9CC' },
  h: { icon: 'H', color: '#fff', bg: '#A8B9CC' },
  cpp: { icon: 'C++', color: '#fff', bg: '#00599C' },
  cxx: { icon: 'C++', color: '#fff', bg: '#00599C' },
  cc: { icon: 'C++', color: '#fff', bg: '#00599C' },
  hpp: { icon: 'H++', color: '#fff', bg: '#00599C' },
  cs: { icon: 'C#', color: '#fff', bg: '#239120' },
  
  // Systems
  go: { icon: 'GO', color: '#fff', bg: '#00ADD8' },
  rs: { icon: 'RS', color: '#323330', bg: '#DEA584' },
  swift: { icon: 'SW', color: '#fff', bg: '#F05138' },
  
  // Ruby/PHP
  rb: { icon: 'RB', color: '#fff', bg: '#CC342D' },
  erb: { icon: 'ERB', color: '#fff', bg: '#CC342D' },
  php: { icon: 'PHP', color: '#fff', bg: '#777BB4' },
  
  // Shell
  sh: { icon: 'SH', color: '#fff', bg: '#4EAA25' },
  bash: { icon: 'SH', color: '#fff', bg: '#4EAA25' },
  zsh: { icon: 'ZSH', color: '#fff', bg: '#4EAA25' },
  fish: { icon: 'FISH', color: '#fff', bg: '#4EAA25' },
  ps1: { icon: 'PS1', color: '#fff', bg: '#012456' },
  bat: { icon: 'BAT', color: '#323330', bg: '#C1F12E' },
  cmd: { icon: 'CMD', color: '#323330', bg: '#C1F12E' },
  
  // Documentation
  md: { icon: 'MD', color: '#fff', bg: '#519aba' },
  mdx: { icon: 'MDX', color: '#323330', bg: '#FCB32C' },
  txt: { icon: 'TXT', color: '#323330', bg: '#89e051' },
  rst: { icon: 'RST', color: '#323330', bg: '#8bc34a' },
  
  // Git
  gitignore: { icon: 'GIT', color: '#fff', bg: '#F14E32' },
  gitattributes: { icon: 'GIT', color: '#fff', bg: '#F14E32' },
  gitmodules: { icon: 'GIT', color: '#fff', bg: '#F14E32' },
  
  // Docker
  dockerfile: { icon: 'DKR', color: '#fff', bg: '#2496ED' },
  dockerignore: { icon: 'DKR', color: '#fff', bg: '#2496ED' },
  
  // Config files
  eslintrc: { icon: 'ESL', color: '#fff', bg: '#4B32C3' },
  prettierrc: { icon: 'PRT', color: '#323330', bg: '#F7B93E' },
  babelrc: { icon: 'BAB', color: '#323330', bg: '#F9DC3E' },
  
  // Build
  makefile: { icon: 'MK', color: '#fff', bg: '#6D8086' },
  cmake: { icon: 'CM', color: '#fff', bg: '#064F8C' },
  
  // Images
  png: { icon: 'PNG', color: '#fff', bg: '#a074c4' },
  jpg: { icon: 'JPG', color: '#fff', bg: '#a074c4' },
  jpeg: { icon: 'JPG', color: '#fff', bg: '#a074c4' },
  gif: { icon: 'GIF', color: '#fff', bg: '#a074c4' },
  svg: { icon: 'SVG', color: '#323330', bg: '#FFB13B' },
  ico: { icon: 'ICO', color: '#fff', bg: '#a074c4' },
  webp: { icon: 'WEBP', color: '#fff', bg: '#a074c4' },
  
  // Fonts
  ttf: { icon: 'TTF', color: '#fff', bg: '#EC5252' },
  otf: { icon: 'OTF', color: '#fff', bg: '#EC5252' },
  woff: { icon: 'WOFF', color: '#fff', bg: '#EC5252' },
  woff2: { icon: 'WF2', color: '#fff', bg: '#EC5252' },
  eot: { icon: 'EOT', color: '#fff', bg: '#EC5252' },
  
  // Archives
  zip: { icon: 'ZIP', color: '#323330', bg: '#EECC00' },
  tar: { icon: 'TAR', color: '#323330', bg: '#EECC00' },
  gz: { icon: 'GZ', color: '#323330', bg: '#EECC00' },
  rar: { icon: 'RAR', color: '#323330', bg: '#EECC00' },
  '7z': { icon: '7Z', color: '#323330', bg: '#EECC00' },
  
  // Misc
  log: { icon: 'LOG', color: '#fff', bg: '#6d8086' },
  lock: { icon: 'LCK', color: '#fff', bg: '#6d8086' },
  sql: { icon: 'SQL', color: '#fff', bg: '#00758F' },
  graphql: { icon: 'GQL', color: '#fff', bg: '#E535AB' },
  gql: { icon: 'GQL', color: '#fff', bg: '#E535AB' },
  vue: { icon: 'VUE', color: '#fff', bg: '#41B883' },
  svelte: { icon: 'SVT', color: '#fff', bg: '#FF3E00' },
};

// Folder icons with colors
const folderIcons = {
  src: '#42A5F5',
  source: '#42A5F5',
  lib: '#7E57C2',
  dist: '#FFA726',
  build: '#FFA726',
  out: '#FFA726',
  output: '#FFA726',
  node_modules: '#81C784',
  components: '#26C6DA',
  pages: '#26C6DA',
  views: '#26C6DA',
  styles: '#EC407A',
  css: '#EC407A',
  assets: '#AB47BC',
  images: '#AB47BC',
  img: '#AB47BC',
  public: '#66BB6A',
  static: '#66BB6A',
  test: '#FFCA28',
  tests: '#FFCA28',
  __tests__: '#FFCA28',
  spec: '#FFCA28',
  config: '#78909C',
  utils: '#78909C',
  helpers: '#78909C',
  hooks: '#00BCD4',
  api: '#EF5350',
  services: '#EF5350',
  models: '#7E57C2',
  types: '#3178C6',
  interfaces: '#3178C6',
  store: '#7C4DFF',
  redux: '#7C4DFF',
  context: '#7C4DFF',
  docs: '#42A5F5',
  documentation: '#42A5F5',
  scripts: '#FFCA28',
  bin: '#FFCA28',
  vendor: '#90A4AE',
  packages: '#90A4AE',
  '.git': '#F14E32',
  '.github': '#F14E32',
  '.vscode': '#0078D4',
};

const defaultFileIcon = { icon: 'FILE', color: '#fff', bg: '#6d8086' };
const defaultFolderColor = '#90CAF9';

function FileExplorer({ workspacePath, onFileSelect, onOpenFolder, onOpenProject, width = 260 }) {
  const [tree, setTree] = useState([]);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const refreshTimeoutRef = useRef(null);

  // Load recent projects on mount
  useEffect(() => {
    const loadRecentProjects = async () => {
      try {
        console.log('[FileExplorer] Loading recent projects...');
        const result = await ipcRenderer.invoke('get-recent-projects');
        console.log('[FileExplorer] Recent projects result:', result);
        if (result.success && result.projects) {
          setRecentProjects(result.projects);
          console.log('[FileExplorer] Set recent projects:', result.projects.length);
        }
      } catch (error) {
        console.error('[FileExplorer] Error loading recent projects:', error);
      }
    };
    loadRecentProjects();
  }, []);

  const loadDirectory = useCallback(async (dirPath) => {
    const result = await ipcRenderer.invoke('read-directory', dirPath);
    // Handle both old format (array) and new format ({ success, entries })
    const items = result?.entries || (Array.isArray(result) ? result : []);
    if (!Array.isArray(items)) return [];
    return items.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
  }, []);

  // Refresh the entire tree
  const refreshTree = useCallback(() => {
    if (workspacePath) {
      loadDirectory(workspacePath).then(setTree);
    }
  }, [workspacePath, loadDirectory]);

  useEffect(() => {
    if (workspacePath) loadDirectory(workspacePath).then(setTree);
  }, [workspacePath, loadDirectory]);

  // Watch for external file system changes
  useEffect(() => {
    if (!workspacePath) return;

    // Start watching the directory
    ipcRenderer.invoke('watch-directory', workspacePath);

    // Listen for fs change events with debouncing
    const handleFsChange = (event, data) => {
      // Debounce refresh to avoid too many updates
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTree();
      }, 300);
    };

    ipcRenderer.on('fs-change', handleFsChange);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      ipcRenderer.invoke('unwatch-directory');
      ipcRenderer.removeListener('fs-change', handleFsChange);
    };
  }, [workspacePath, refreshTree]);

  const toggleDir = (dirPath) => {
    const newExpanded = new Set(expandedDirs);
    newExpanded.has(dirPath) ? newExpanded.delete(dirPath) : newExpanded.add(dirPath);
    setExpandedDirs(newExpanded);
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleNewFile = async (dirPath) => {
    const name = prompt('Enter file name:');
    if (name) {
      await ipcRenderer.invoke('create-file', `${dirPath}/${name}`);
      loadDirectory(workspacePath).then(setTree);
    }
    setContextMenu(null);
  };

  const handleNewFolder = async (dirPath) => {
    const name = prompt('Enter folder name:');
    if (name) {
      await ipcRenderer.invoke('create-directory', `${dirPath}/${name}`);
      loadDirectory(workspacePath).then(setTree);
    }
    setContextMenu(null);
  };

  const handleDelete = async (path) => {
    if (confirm('Delete this item?')) {
      await ipcRenderer.invoke('delete-path', path);
      loadDirectory(workspacePath).then(setTree);
    }
    setContextMenu(null);
  };

  const handleRename = async (path) => {
    const oldName = path.split('/').pop();
    const newName = prompt('Enter new name:', oldName);
    if (newName && newName !== oldName) {
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      const newPath = `${parentDir}/${newName}`;
      const result = await ipcRenderer.invoke('rename-path', path, newPath);
      if (result.success) {
        loadDirectory(workspacePath).then(setTree);
      } else {
        alert(`Rename failed: ${result.error}`);
      }
    }
    setContextMenu(null);
  };

  const handleCopy = (item) => {
    clipboardItem = item;
    clipboardOperation = 'copy';
    setContextMenu(null);
  };

  const handleCut = (item) => {
    clipboardItem = item;
    clipboardOperation = 'cut';
    setContextMenu(null);
  };

  const handlePaste = async (targetDir) => {
    if (!clipboardItem) return;
    
    const sourcePath = clipboardItem.path;
    const fileName = sourcePath.split('/').pop();
    let destPath = `${targetDir}/${fileName}`;
    
    // Check if destination exists and prompt for new name
    try {
      const exists = await ipcRenderer.invoke('read-file', destPath);
      if (exists.success) {
        const newName = prompt(`"${fileName}" already exists. Enter a new name:`, fileName);
        if (!newName) {
          setContextMenu(null);
          return;
        }
        destPath = `${targetDir}/${newName}`;
      }
    } catch {}
    
    let result;
    if (clipboardOperation === 'copy') {
      result = await ipcRenderer.invoke('copy-path', sourcePath, destPath);
    } else {
      result = await ipcRenderer.invoke('move-path', sourcePath, destPath);
      if (result.success) {
        clipboardItem = null;
        clipboardOperation = null;
      }
    }
    
    if (result.success) {
      loadDirectory(workspacePath).then(setTree);
    } else {
      alert(`${clipboardOperation === 'copy' ? 'Copy' : 'Move'} failed: ${result.error}`);
    }
    setContextMenu(null);
  };

  const handleDuplicate = async (item) => {
    const sourcePath = item.path;
    const parentDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const fileName = sourcePath.split('/').pop();
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
    const baseName = ext ? fileName.slice(0, -ext.length) : fileName;
    const newName = `${baseName} copy${ext}`;
    const destPath = `${parentDir}/${newName}`;
    
    const result = await ipcRenderer.invoke('copy-path', sourcePath, destPath);
    if (result.success) {
      loadDirectory(workspacePath).then(setTree);
    } else {
      alert(`Duplicate failed: ${result.error}`);
    }
    setContextMenu(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
    // Add drag image styling
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow drop on directories
    if (item.isDirectory && draggedItem && draggedItem.path !== item.path) {
      // Don't allow dropping into own children
      if (!draggedItem.path.startsWith(item.path + '/') && item.path !== draggedItem.path) {
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(item.path);
        return;
      }
    }
    e.dataTransfer.dropEffect = 'none';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear if we're actually leaving the element
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    
    if (!draggedItem || !targetItem.isDirectory) return;
    
    // Don't drop on self or into children
    if (draggedItem.path === targetItem.path) return;
    if (draggedItem.path.startsWith(targetItem.path + '/')) return;
    
    const sourcePath = draggedItem.path;
    const fileName = sourcePath.split('/').pop();
    let destPath = `${targetItem.path}/${fileName}`;
    
    // Check if destination exists
    try {
      const exists = await ipcRenderer.invoke('read-file', destPath);
      if (exists.success) {
        const newName = prompt(`"${fileName}" already exists in target folder. Enter a new name:`, fileName);
        if (!newName) {
          setDraggedItem(null);
          return;
        }
        destPath = `${targetItem.path}/${newName}`;
      }
    } catch {}
    
    const result = await ipcRenderer.invoke('move-path', sourcePath, destPath);
    if (result.success) {
      loadDirectory(workspacePath).then(setTree);
    } else {
      alert(`Move failed: ${result.error}`);
    }
    setDraggedItem(null);
  };

  // Handle drop on root workspace
  const handleRootDragOver = (e) => {
    e.preventDefault();
    if (draggedItem) {
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(workspacePath);
    }
  };

  const handleRootDrop = async (e) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedItem) return;
    
    const sourcePath = draggedItem.path;
    const fileName = sourcePath.split('/').pop();
    const parentDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    
    // Don't move if already in root
    if (parentDir === workspacePath) {
      setDraggedItem(null);
      return;
    }
    
    let destPath = `${workspacePath}/${fileName}`;
    
    // Check if destination exists
    try {
      const exists = await ipcRenderer.invoke('read-file', destPath);
      if (exists.success) {
        const newName = prompt(`"${fileName}" already exists in root folder. Enter a new name:`, fileName);
        if (!newName) {
          setDraggedItem(null);
          return;
        }
        destPath = `${workspacePath}/${newName}`;
      }
    } catch {}
    
    const result = await ipcRenderer.invoke('move-path', sourcePath, destPath);
    if (result.success) {
      loadDirectory(workspacePath).then(setTree);
    } else {
      alert(`Move failed: ${result.error}`);
    }
    setDraggedItem(null);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  if (!workspacePath) {
    const handleOpenRecentProject = (projectPath) => {
      if (onOpenProject) {
        onOpenProject(projectPath);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: 24
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ opacity: 0.5, marginBottom: 16 }}>
            <FolderIcon folderName="" isOpen={false} size={48} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>No folder opened</p>
          <button className="btn btn-outline btn-sm" onClick={onOpenFolder}>
            Open Folder
          </button>
        </div>
        
        {recentProjects.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid var(--border)'
            }}>
              <Clock size={14} style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                color: 'var(--muted-foreground)', 
                textTransform: 'uppercase', 
                letterSpacing: 0.8 
              }}>
                Recent Projects
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentProjects.map((project, index) => (
                <motion.button
                  key={project.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleOpenRecentProject(project.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Folder size={16} style={{ color: '#90CAF9', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ 
                      fontSize: 13, 
                      color: 'var(--foreground)', 
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.name}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {project.path}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Explorer
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton onClick={() => handleNewFile(workspacePath)} icon={<FilePlus size={14} />} />
          <IconButton onClick={() => handleNewFolder(workspacePath)} icon={<FolderPlus size={14} />} />
        </div>
      </div>
      
      <div 
        style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onDragLeave={() => setDropTarget(null)}
      >
        <AnimatePresence>
          {tree.map((item, i) => (
            <FileTreeItem
              key={item.path}
              item={item}
              depth={0}
              index={i}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileSelect={onFileSelect}
              onContextMenu={handleContextMenu}
              loadDirectory={loadDirectory}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              draggedItem={draggedItem}
              dropTarget={dropTarget}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              minWidth: 160,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 4,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              zIndex: 1000
            }}
          >
            {contextMenu.item.isDirectory && (
              <>
                <ContextMenuItem onClick={() => handleNewFile(contextMenu.item.path)} icon={<FilePlus size={14} />} label="New File" />
                <ContextMenuItem onClick={() => handleNewFolder(contextMenu.item.path)} icon={<FolderPlus size={14} />} label="New Folder" />
                {clipboardItem && (
                  <ContextMenuItem onClick={() => handlePaste(contextMenu.item.path)} icon={<Clipboard size={14} />} label="Paste" />
                )}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
              </>
            )}
            <ContextMenuItem onClick={() => handleRename(contextMenu.item.path)} icon={<Edit3 size={14} />} label="Rename" />
            <ContextMenuItem onClick={() => handleCopy(contextMenu.item)} icon={<Copy size={14} />} label="Copy" />
            <ContextMenuItem onClick={() => handleCut(contextMenu.item)} icon={<Move size={14} />} label="Cut" />
            <ContextMenuItem onClick={() => handleDuplicate(contextMenu.item)} icon={<Copy size={14} />} label="Duplicate" />
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
            <ContextMenuItem onClick={() => handleDelete(contextMenu.item.path)} icon={<Trash2 size={14} />} label="Delete" destructive />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

// Get file icon configuration
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const name = filename.toLowerCase();
  
  // Check for special filenames
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return materialIcons.dockerfile || defaultFileIcon;
  if (name === '.dockerignore') return materialIcons.dockerignore || defaultFileIcon;
  if (name === '.gitignore') return materialIcons.gitignore || defaultFileIcon;
  if (name === '.gitattributes') return materialIcons.gitattributes || defaultFileIcon;
  if (name === 'makefile' || name === 'gnumakefile') return materialIcons.makefile || defaultFileIcon;
  if (name.includes('.eslintrc')) return materialIcons.eslintrc || defaultFileIcon;
  if (name.includes('.prettierrc')) return materialIcons.prettierrc || defaultFileIcon;
  if (name.includes('.babelrc') || name === 'babel.config.js' || name === 'babel.config.json') return materialIcons.babelrc || defaultFileIcon;
  if (name.endsWith('.lock') || name === 'package-lock.json' || name === 'yarn.lock' || name === 'bun.lock') return materialIcons.lock || defaultFileIcon;
  if (name.startsWith('.env')) return materialIcons.env || defaultFileIcon;
  
  return materialIcons[ext] || defaultFileIcon;
}

// Get folder color
function getFolderColor(folderName) {
  const name = folderName.toLowerCase();
  return folderIcons[name] || defaultFolderColor;
}

// Material File Icon Component
function FileIcon({ filename, size = 16 }) {
  const iconConfig = getFileIcon(filename);
  
  // Text-based icon badge
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      fontSize: iconConfig.icon.length > 3 ? 5 : iconConfig.icon.length > 2 ? 6 : 7,
      fontWeight: 700,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: iconConfig.color,
      background: iconConfig.bg,
      borderRadius: 2,
      letterSpacing: -0.5,
    }}>
      {iconConfig.icon}
    </span>
  );
}

// Material Folder Icon Component
function FolderIcon({ folderName, isOpen, size = 16 }) {
  const color = getFolderColor(folderName);
  
  if (isOpen) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path 
          d="M4 4h5l2 2h9a2 2 0 012 2v2H2V6a2 2 0 012-2z" 
          fill={color} 
          opacity="0.7"
        />
        <path 
          d="M2 10h20v8a2 2 0 01-2 2H4a2 2 0 01-2-2V10z" 
          fill={color}
        />
      </svg>
    );
  }
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M4 4h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" 
        fill={color}
      />
    </svg>
  );
}

function FileTreeItem({ item, depth, index, expandedDirs, toggleDir, onFileSelect, onContextMenu, loadDirectory, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, draggedItem, dropTarget }) {
  const [children, setChildren] = useState([]);
  const isExpanded = expandedDirs.has(item.path);
  const isDropTarget = dropTarget === item.path;
  const isDragging = draggedItem?.path === item.path;

  useEffect(() => {
    if (item.isDirectory && isExpanded) loadDirectory(item.path).then(setChildren);
  }, [item, isExpanded, loadDirectory]);

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
      <motion.div
        draggable
        onDragStart={(e) => onDragStart(e, item)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, item)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, item)}
        onClick={() => item.isDirectory ? toggleDir(item.path) : onFileSelect(item.path)}
        onContextMenu={(e) => onContextMenu(e, item)}
        whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.05)' }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          paddingLeft: depth * 12 + 8,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--muted-foreground)',
          transition: 'color 150ms ease, background-color 150ms ease, border 150ms ease',
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: isDropTarget ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
          border: isDropTarget ? '1px dashed rgba(59, 130, 246, 0.5)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
      >
        {item.isDirectory ? (
          <>
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight size={14} />
            </motion.div>
            <FolderIcon folderName={item.name} isOpen={isExpanded} size={16} />
          </>
        ) : (
          <>
            <span style={{ width: 14 }} />
            <FileIcon filename={item.name} size={16} />
          </>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
      </motion.div>
      
      <AnimatePresence>
        {item.isDirectory && isExpanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {children.map((child, i) => (
              <FileTreeItem key={child.path} item={child} depth={depth + 1} index={i}
                expandedDirs={expandedDirs} toggleDir={toggleDir} onFileSelect={onFileSelect}
                onContextMenu={onContextMenu} loadDirectory={loadDirectory}
                onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver}
                onDragLeave={onDragLeave} onDrop={onDrop} draggedItem={draggedItem} dropTarget={dropTarget} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function IconButton({ onClick, icon }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, background: 'transparent', border: 'none',
        borderRadius: 4, cursor: 'pointer', color: 'var(--muted-foreground)'
      }}
    >
      {icon}
    </motion.button>
  );
}

function ContextMenuItem({ onClick, icon, label, destructive }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ backgroundColor: destructive ? 'rgba(239, 68, 68, 0.1)' : 'var(--muted)' }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 12px', background: 'transparent', border: 'none',
        borderRadius: 6, cursor: 'pointer', fontSize: 13,
        color: destructive ? 'var(--destructive)' : 'var(--foreground)', textAlign: 'left'
      }}
    >
      {icon} {label}
    </motion.button>
  );
}

export default FileExplorer;
