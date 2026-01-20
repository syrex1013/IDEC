// Default settings for IDEC
export const defaultSettings = {
  // Appearance
  theme: 'idec-dark',
  
  // Editor
  editor: {
    fontSize: 14,
    fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontLigatures: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'off',
    lineNumbers: 'on',
    minimap: true,
    minimapScale: 1,
    minimapSide: 'right',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorStyle: 'line',
    cursorWidth: 2,
    bracketPairColorization: true,
    renderWhitespace: 'none',
    renderLineHighlight: 'line',
    lineHeight: 22,
    letterSpacing: 0,
    padding: { top: 16, bottom: 16 },
    formatOnSave: false,
    formatOnPaste: false,
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full',
    autoSave: 'off', // 'off', 'afterDelay', 'onFocusChange'
    autoSaveDelay: 1000,
  },
  
  // Terminal
  terminal: {
    fontSize: 13,
    fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block', // 'block', 'underline', 'bar'
    scrollback: 1000,
    copyOnSelect: false,
    rightClickSelectsWord: true,
  },
  
  // Panels
  panels: {
    fileExplorerWidth: 260,
    fileExplorerMinWidth: 180,
    fileExplorerMaxWidth: 500,
    terminalHeight: 240,
    terminalMinHeight: 100,
    terminalMaxHeight: 600,
    aiPanelWidth: 380,
    aiPanelMinWidth: 280,
    aiPanelMaxWidth: 700,
    showTerminal: true,
    showAIPanel: true,
    showMinimap: true,
    showBreadcrumbs: true,
    showStatusBar: true,
    activityBarPosition: 'left', // 'left', 'top', 'hidden'
  },
  
  // AI Providers
  ai: {
    provider: 'claude',
    claudeApiKey: '',
    openaiApiKey: '',
    groqApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaCloudUrl: 'https://api.ollama.com',
    ollamaCloudApiKey: '',
    openrouterApiKey: '',
    defaultModel: '',
    streamResponses: true,
    contextLines: 50,
  },
  
  // Files
  files: {
    exclude: ['node_modules', '.git', '.DS_Store', 'dist', 'build', 'coverage'],
    autoSave: 'off',
    autoSaveDelay: 1000,
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    encoding: 'utf8',
    eol: 'auto', // 'auto', 'lf', 'crlf'
  },
  
  // Keybindings
  keybindings: {
    save: 'Cmd+S',
    saveAll: 'Cmd+Shift+S',
    openFile: 'Cmd+O',
    openFolder: 'Cmd+Shift+O',
    closeFile: 'Cmd+W',
    closeAllFiles: 'Cmd+Shift+W',
    newFile: 'Cmd+N',
    find: 'Cmd+F',
    findAndReplace: 'Cmd+H',
    findInFiles: 'Cmd+Shift+F',
    goToLine: 'Cmd+G',
    goToFile: 'Cmd+P',
    commandPalette: 'Cmd+Shift+P',
    toggleTerminal: 'Cmd+`',
    toggleSidebar: 'Cmd+B',
    toggleAIPanel: 'Cmd+Shift+A',
    zoomIn: 'Cmd+=',
    zoomOut: 'Cmd+-',
    zoomReset: 'Cmd+0',
    formatDocument: 'Shift+Alt+F',
    commentLine: 'Cmd+/',
  },
  
  // Workbench
  workbench: {
    colorCustomizations: {},
    startupEditor: 'welcomePage', // 'welcomePage', 'none', 'newUntitledFile'
    sideBarLocation: 'left',
    showTabs: true,
    tabCloseButton: 'right',
    tabSizing: 'fit', // 'fit', 'shrink', 'fixed'
    iconTheme: 'default',
    tree: {
      indent: 12,
      renderIndentGuides: 'always',
    }
  },
};

// Settings sections for the UI
export const settingsSections = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'Palette',
    description: 'Theme, colors, and visual settings',
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: 'Code',
    description: 'Font, formatting, and editor behavior',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: 'TerminalSquare',
    description: 'Integrated terminal settings',
  },
  {
    id: 'ai',
    label: 'AI Providers',
    icon: 'Bot',
    description: 'Configure AI assistants and API keys',
  },
  {
    id: 'files',
    label: 'Files',
    icon: 'Files',
    description: 'File handling and exclusions',
  },
  {
    id: 'keybindings',
    label: 'Keyboard',
    icon: 'Keyboard',
    description: 'Keyboard shortcuts',
  },
];

// Merge user settings with defaults
export function mergeSettings(userSettings) {
  const merged = { ...defaultSettings };
  
  if (userSettings) {
    // Simple top-level properties
    if (userSettings.theme) merged.theme = userSettings.theme;
    
    // Preserve setupComplete flag - ALWAYS copy it
    if (userSettings.setupComplete !== undefined) {
      merged.setupComplete = userSettings.setupComplete;
    }
    
    // Nested objects
    if (userSettings.editor) merged.editor = { ...merged.editor, ...userSettings.editor };
    if (userSettings.terminal) merged.terminal = { ...merged.terminal, ...userSettings.terminal };
    if (userSettings.panels) merged.panels = { ...merged.panels, ...userSettings.panels };
    if (userSettings.ai) merged.ai = { ...merged.ai, ...userSettings.ai };
    if (userSettings.files) merged.files = { ...merged.files, ...userSettings.files };
    if (userSettings.keybindings) merged.keybindings = { ...merged.keybindings, ...userSettings.keybindings };
    if (userSettings.workbench) merged.workbench = { ...merged.workbench, ...userSettings.workbench };
    
    // Legacy support
    if (userSettings.fontSize) merged.editor.fontSize = userSettings.fontSize;
    if (userSettings.claudeApiKey) merged.ai.claudeApiKey = userSettings.claudeApiKey;
    if (userSettings.openaiApiKey) merged.ai.openaiApiKey = userSettings.openaiApiKey;
    if (userSettings.groqApiKey) merged.ai.groqApiKey = userSettings.groqApiKey;
    if (userSettings.ollamaUrl) merged.ai.ollamaUrl = userSettings.ollamaUrl;
    if (userSettings.ollamaCloudApiKey) merged.ai.ollamaCloudApiKey = userSettings.ollamaCloudApiKey;
    if (userSettings.openrouterApiKey) merged.ai.openrouterApiKey = userSettings.openrouterApiKey;
    if (userSettings.provider) merged.ai.provider = userSettings.provider;
  }
  
  return merged;
}

export default defaultSettings;
