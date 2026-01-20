const { contextBridge, ipcRenderer, clipboard } = require('electron');

// Track callback->wrapper mappings for proper listener removal
const listenerMap = new Map();

// Create an ipcRenderer-like interface that works with contextIsolation
const ipcRendererProxy = {
  invoke: (channel, ...args) => {
    if (channel === 'ai-request-stream') {
      console.log(`[Preload IPC] invoke ai-request-stream with ${args.length} args, last arg:`, JSON.stringify(args[args.length-1]));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, callback) => {
    const subscription = (event, ...args) => {
      if (channel.startsWith('ai-stream')) {
        console.log(`[Preload IPC] Received ${channel}:`, args[0]?.requestId || 'no-id');
      }
      callback(event, ...args);
    };
    // Store the mapping so we can remove the correct listener later
    if (!listenerMap.has(channel)) {
      listenerMap.set(channel, new Map());
    }
    listenerMap.get(channel).set(callback, subscription);
    ipcRenderer.on(channel, subscription);
    console.log(`[Preload IPC] Registered listener for ${channel}`);
    return ipcRendererProxy;
  },
  removeListener: (channel, callback) => {
    // Find the wrapped subscription for this callback
    const channelMap = listenerMap.get(channel);
    if (channelMap) {
      const subscription = channelMap.get(callback);
      if (subscription) {
        ipcRenderer.removeListener(channel, subscription);
        channelMap.delete(callback);
      }
    }
    return ipcRendererProxy;
  }
};

// Expose electron shim as window.require('electron')
// This allows existing code that uses window.require('electron') to work
contextBridge.exposeInMainWorld('__electronModule', {
  ipcRenderer: ipcRendererProxy,
  shell: {
    openExternal: (url) => {
      // Use a custom IPC call for shell.openExternal
      return ipcRenderer.invoke('shell-open-external', url);
    }
  },
  clipboard: {
    writeText: (text) => clipboard.writeText(text),
    readText: () => clipboard.readText()
  }
});

// Also expose as window.electronAPI for new code
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  watchDirectory: (dirPath) => ipcRenderer.invoke('watch-directory', dirPath),
  unwatchDirectory: () => ipcRenderer.invoke('unwatch-directory'),
  onFsChange: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('fs-change', handler);
    return () => ipcRenderer.removeListener('fs-change', handler);
  },
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('create-file', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  deleteItem: (itemPath) => ipcRenderer.invoke('delete-item', itemPath),
  renameItem: (oldPath, newPath) => ipcRenderer.invoke('rename-item', oldPath, newPath),
  
  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  saveFileDialog: (defaultPath) => ipcRenderer.invoke('save-file-dialog', defaultPath),
  
  // Terminal
  terminalCreate: (id, cwd) => ipcRenderer.invoke('terminal-create', id, cwd),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', id),
  onTerminalData: (callback) => {
    const handler = (_, id, data) => callback(id, data);
    ipcRenderer.on('terminal-data', handler);
    return () => ipcRenderer.removeListener('terminal-data', handler);
  },
  onTerminalExit: (callback) => {
    const handler = (_, id, code) => callback(id, code);
    ipcRenderer.on('terminal-exit', handler);
    return () => ipcRenderer.removeListener('terminal-exit', handler);
  },
  
  // Git operations
  gitStatus: (repoPath) => ipcRenderer.invoke('git-status', repoPath),
  gitAdd: (repoPath, files) => ipcRenderer.invoke('git-add', repoPath, files),
  gitCommit: (repoPath, message) => ipcRenderer.invoke('git-commit', repoPath, message),
  gitPush: (repoPath) => ipcRenderer.invoke('git-push', repoPath),
  gitPull: (repoPath) => ipcRenderer.invoke('git-pull', repoPath),
  gitBranches: (repoPath) => ipcRenderer.invoke('git-branches', repoPath),
  gitCheckout: (repoPath, branch) => ipcRenderer.invoke('git-checkout', repoPath, branch),
  gitCreateBranch: (repoPath, branchName) => ipcRenderer.invoke('git-create-branch', repoPath, branchName),
  gitLog: (repoPath, limit) => ipcRenderer.invoke('git-log', repoPath, limit),
  gitDiff: (repoPath, file) => ipcRenderer.invoke('git-diff', repoPath, file),
  gitClone: (url, targetDir) => ipcRenderer.invoke('git-clone', url, targetDir),
  gitInit: (repoPath) => ipcRenderer.invoke('git-init', repoPath),
  gitStash: (repoPath) => ipcRenderer.invoke('git-stash', repoPath),
  gitStashPop: (repoPath) => ipcRenderer.invoke('git-stash-pop', repoPath),
  gitReset: (repoPath, file) => ipcRenderer.invoke('git-reset', repoPath, file),
  
  // Project operations
  createProject: (data) => ipcRenderer.invoke('create-project', data),
  
  // AI operations
  streamAIResponse: (provider, model, messages, apiKey, options) => 
    ipcRenderer.invoke('stream-ai-response', provider, model, messages, apiKey, options),
  onAIChunk: (callback) => {
    const handler = (_, chunk) => callback(chunk);
    ipcRenderer.on('ai-chunk', handler);
    return () => ipcRenderer.removeListener('ai-chunk', handler);
  },
  onAIDone: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ai-done', handler);
    return () => ipcRenderer.removeListener('ai-done', handler);
  },
  onAIError: (callback) => {
    const handler = (_, error) => callback(error);
    ipcRenderer.on('ai-error', handler);
    return () => ipcRenderer.removeListener('ai-error', handler);
  },
  
  // Extensions
  getInstalledExtensions: () => ipcRenderer.invoke('get-installed-extensions'),
  installExtension: (ext) => ipcRenderer.invoke('install-extension', ext),
  uninstallExtension: (extId) => ipcRenderer.invoke('uninstall-extension', extId),
  
  // GitHub
  githubSearch: (query, type, apiKey) => ipcRenderer.invoke('github-search', query, type, apiKey),
  githubGetUser: (apiKey) => ipcRenderer.invoke('github-get-user', apiKey),
  githubGetRepos: (apiKey) => ipcRenderer.invoke('github-get-repos', apiKey),
  
  // Path utilities - since we can't use Node's path module in renderer
  pathJoin: (...args) => ipcRenderer.invoke('path-join', ...args),
  pathBasename: (p) => ipcRenderer.invoke('path-basename', p),
  pathDirname: (p) => ipcRenderer.invoke('path-dirname', p),
  
  // JSON Schema fetching
  fetchJsonSchema: (url) => ipcRenderer.invoke('fetch-json-schema', url),
  
  // Output log listener
  onOutputLog: (callback) => {
    const handler = (_, log) => callback(log);
    ipcRenderer.on('output-log', handler);
    console.log('[Preload IPC] Registered listener for output-log');
    return () => ipcRenderer.removeListener('output-log', handler);
  },
  
  // Clipboard operations
  clipboardWriteText: (text) => clipboard.writeText(text),
  clipboardReadText: () => clipboard.readText(),
  
  // Menu event listeners
  onMenuOpenFolder: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-open-folder', handler);
    return () => ipcRenderer.removeListener('menu-open-folder', handler);
  },
  onMenuSave: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-save', handler);
    return () => ipcRenderer.removeListener('menu-save', handler);
  },
  
  // Environment
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  platform: process.platform
});
