import React, { useState, useCallback, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import AIPanel from './components/AIPanel';
import Terminal from './components/Terminal';
import BottomPanel from './components/BottomPanel';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import SetupWizard from './components/SetupWizard';
import ExtensionMarketplace from './components/ExtensionMarketplace';
import ResizeHandle from './components/ResizeHandle';
import GitPanel from './components/GitPanel';
import GitHubPanel from './components/GitHubPanel';
import CreateProjectModal from './components/CreateProjectModal';
import CloneRepoModal from './components/CloneRepoModal';
import { themes, applyTheme } from './lib/themes';
import { defaultSettings, mergeSettings } from './lib/settings';
import './styles/globals.css';

const { ipcRenderer } = window.require('electron');

// Error boundary to catch rendering errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#ff6b6b', background: '#1a1a1a', height: '100vh' }}>
          <h1>Something went wrong</h1>
          <pre style={{ marginTop: 20, fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [workspacePath, setWorkspacePath] = useState(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showGitHubPanel, setShowGitHubPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCloneRepo, setShowCloneRepo] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [showSetupWizard, setShowSetupWizard] = useState(true); // Start true, will check disk
  const [aiContext, setAiContext] = useState({ code: '', language: '', fileName: '' });
  const [codebaseIndex, setCodebaseIndex] = useState(null);
  const [indexingStatus, setIndexingStatus] = useState(null); // 'indexing', 'done', 'error'
  const [fileExplorerWidth, setFileExplorerWidth] = useState(260);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [gitPanelWidth, setGitPanelWidth] = useState(300);
  const [gitHubPanelWidth, setGitHubPanelWidth] = useState(340);
  const [gitHubUser, setGitHubUser] = useState(null);
  const [settings, setSettings] = useState(() => mergeSettings({}));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [problems, setProblems] = useState([]); // Linting/compilation problems
  
  // Load settings from disk on mount
  useEffect(() => {
    const loadSettingsFromDisk = async () => {
      try {
        const result = await ipcRenderer.invoke('load-settings');
        if (result.success && result.settings) {
          setSettings(mergeSettings(result.settings));
          setShowSetupWizard(!result.settings.setupComplete);
        } else {
          setShowSetupWizard(true);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setShowSetupWizard(true);
      }
      setSettingsLoaded(true);
    };
    loadSettingsFromDisk();
  }, []);

  // Check GitHub login status on mount
  useEffect(() => {
    const checkGitHubUser = async () => {
      const result = await ipcRenderer.invoke('github-get-user');
      if (result.success) {
        setGitHubUser(result.user);
      }
    };
    checkGitHubUser();
  }, []);
  
  const handleSetupComplete = async (newSettings) => {
    const updatedSettings = { ...mergeSettings(newSettings), setupComplete: true };
    setSettings(updatedSettings);
    await ipcRenderer.invoke('save-settings', updatedSettings);
    setShowSetupWizard(false);
  };

  // Save settings to disk and apply theme
  useEffect(() => {
    if (!settingsLoaded) return; // Don't save until initial load is complete
    
    ipcRenderer.invoke('save-settings', settings);
    
    // Apply theme
    const theme = themes[settings.theme] || themes['idec-dark'];
    applyTheme(theme);
  }, [settings, settingsLoaded]);
  
  // Apply panel size settings
  useEffect(() => {
    if (settings.panels) {
      if (settings.panels.fileExplorerWidth) setFileExplorerWidth(settings.panels.fileExplorerWidth);
      if (settings.panels.terminalHeight) setTerminalHeight(settings.panels.terminalHeight);
      if (settings.panels.aiPanelWidth) setAiPanelWidth(settings.panels.aiPanelWidth);
    }
  }, []);

  // Load extensions on startup to trigger output logging
  useEffect(() => {
    const loadExtensionsOnStartup = async () => {
      try {
        // Small delay to ensure output-log listener is registered in BottomPanel
        await new Promise(resolve => setTimeout(resolve, 100));
        await ipcRenderer.invoke('extensions-list');
      } catch (error) {
        console.error('Failed to load extensions on startup:', error);
      }
    };
    loadExtensionsOnStartup();
  }, []);

  // Index codebase when workspace changes
  const indexCodebase = useCallback(async (folderPath) => {
    setCodebaseIndex(null);
    try {
      // First try to read existing index from .IDEC/CODEBASE.md
      const existing = await ipcRenderer.invoke('read-codebase-index', folderPath);
      if (existing.success) {
        setCodebaseIndex(existing.content);
        setIndexingStatus('done');
        console.log('[App] Loaded existing codebase index from .IDEC/CODEBASE.md');
        return;
      }
      
      // No existing index - generate new one
      setIndexingStatus('indexing');
      const result = await ipcRenderer.invoke('index-codebase', folderPath);
      if (result.success) {
        setCodebaseIndex(result.analysis);
        setIndexingStatus('done');
        console.log(`[App] Indexed ${result.fileCount} files in ${result.duration}ms, saved to .IDEC/CODEBASE.md`);
      } else {
        setIndexingStatus('error');
        console.error('[App] Indexing failed:', result.error);
      }
    } catch (error) {
      setIndexingStatus('error');
      console.error('[App] Indexing error:', error);
    }
  }, []);

  const handleOpenFolder = async () => {
    const folderPath = await ipcRenderer.invoke('open-folder-dialog');
    if (folderPath) {
      setWorkspacePath(folderPath);
      setOpenFiles([]);
      setActiveFile(null);
      indexCodebase(folderPath);
    }
  };

  // Open a project directly (from recent projects list)
  const handleOpenProject = async (projectPath) => {
    // Add to recent projects
    await ipcRenderer.invoke('add-recent-project', projectPath);
    setWorkspacePath(projectPath);
    setOpenFiles([]);
    setActiveFile(null);
    indexCodebase(projectPath);
  };

  const handleProjectCreated = (projectPath) => {
    // Add to recent projects
    ipcRenderer.invoke('add-recent-project', projectPath);
    setWorkspacePath(projectPath);
    setOpenFiles([]);
    setActiveFile(null);
    indexCodebase(projectPath);
  };

  const handleCloneComplete = (clonedPath) => {
    // Add to recent projects
    ipcRenderer.invoke('add-recent-project', clonedPath);
    setWorkspacePath(clonedPath);
    setOpenFiles([]);
    setActiveFile(null);
    indexCodebase(clonedPath);
  };

  const handleGitHubClone = (url) => {
    setCloneUrl(url);
    setShowGitHubPanel(false);
    setShowCloneRepo(true);
  };

  const handleFileSelect = useCallback(async (filePath) => {
    const existing = openFiles.find(f => f.path === filePath);
    if (existing) {
      setActiveFile(existing);
      setAiContext({ code: existing.content, language: existing.language, fileName: existing.name });
      return;
    }

    setLoadingFile(true);
    console.log('[File Loading] Starting load for:', filePath);
    const result = await ipcRenderer.invoke('read-file', filePath);
    setLoadingFile(false);
    
    if (result.success) {
      const fileName = filePath.split('/').pop();
      const extension = fileName.split('.').pop();
      const language = getLanguageFromExtension(extension);
      console.log('[File Loading] Success - ext:', extension, 'language:', language, 'size:', result.content?.length);
      const newFile = {
        path: filePath,
        name: fileName,
        content: result.content,
        language: language,
        isDirty: false
      };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFile(newFile);
      setAiContext({ code: result.content, language: language, fileName: fileName });
    } else {
      console.error('[File Loading] Failed:', result.error);
    }
  }, [openFiles]);

  const handleFileChange = useCallback((content) => {
    if (!activeFile) return;
    const updated = { ...activeFile, content, isDirty: true };
    setActiveFile(updated);
    setOpenFiles(prev => prev.map(f => f.path === activeFile.path ? updated : f));
    setAiContext({ code: content, language: activeFile.language, fileName: activeFile.name });
  }, [activeFile]);

  const handleFileSave = useCallback(async () => {
    if (!activeFile) return;
    const result = await ipcRenderer.invoke('write-file', activeFile.path, activeFile.content);
    if (result.success) {
      const updated = { ...activeFile, isDirty: false };
      setActiveFile(updated);
      setOpenFiles(prev => prev.map(f => f.path === activeFile.path ? updated : f));
    }
  }, [activeFile]);

  // Reload a file from disk (used when agent writes to a file)
  const handleFileReload = useCallback(async (filePath) => {
    console.log('[File Reload] Reloading:', filePath);
    const result = await ipcRenderer.invoke('read-file', filePath);
    if (result.success) {
      const fileName = filePath.split('/').pop();
      const extension = fileName.split('.').pop();
      const language = getLanguageFromExtension(extension);
      const updatedFile = {
        path: filePath,
        name: fileName,
        content: result.content,
        language: language,
        isDirty: false
      };
      
      // Check if file is already open
      const existingIndex = openFiles.findIndex(f => f.path === filePath);
      if (existingIndex >= 0) {
        // Update existing file
        setOpenFiles(prev => prev.map(f => f.path === filePath ? updatedFile : f));
        if (activeFile?.path === filePath) {
          setActiveFile(updatedFile);
          setAiContext({ code: result.content, language: language, fileName: fileName });
        }
      } else {
        // Open the file
        setOpenFiles(prev => [...prev, updatedFile]);
        setActiveFile(updatedFile);
        setAiContext({ code: result.content, language: language, fileName: fileName });
      }
      console.log('[File Reload] Success - reloaded', filePath);
    } else {
      console.error('[File Reload] Failed:', result.error);
    }
  }, [openFiles, activeFile]);

  const handleCloseFile = useCallback((filePath) => {
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));
    if (activeFile?.path === filePath) {
      const remaining = openFiles.filter(f => f.path !== filePath);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  }, [activeFile, openFiles]);

  const handleAIInsert = useCallback((code) => {
    if (!activeFile) return;
    handleFileChange(activeFile.content + '\n' + code);
  }, [activeFile, handleFileChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleFileSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFileSave]);
  
  // Get current theme background
  const currentTheme = themes[settings.theme] || themes['idec-dark'];
  
  // Show loading while settings are being loaded from disk
  if (!settingsLoaded) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#09090b',
        color: '#a1a1aa'
      }}>
        Loading...
      </div>
    );
  }
  
  // Show setup wizard on first launch
  if (showSetupWizard) {
    return (
      <SetupWizard 
        onComplete={handleSetupComplete}
        initialSettings={settings}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" style={{ background: currentTheme.colors.background }}>
      <Toolbar 
        onOpenFolder={handleOpenFolder}
        onCreateProject={() => setShowCreateProject(true)}
        onCloneRepo={() => { setCloneUrl(''); setShowCloneRepo(true); }}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
        onToggleAI={() => setShowAIPanel(!showAIPanel)}
        onToggleGit={() => setShowGitPanel(!showGitPanel)}
        onToggleGitHub={() => setShowGitHubPanel(!showGitHubPanel)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenExtensions={() => setShowExtensions(true)}
        showTerminal={showTerminal}
        showAIPanel={showAIPanel}
        showGitPanel={showGitPanel}
        showGitHubPanel={showGitHubPanel}
        gitHubUser={gitHubUser}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div style={{ position: 'relative', width: fileExplorerWidth, flexShrink: 0 }}>
          <FileExplorer 
            workspacePath={workspacePath}
            onFileSelect={handleFileSelect}
            onOpenFolder={handleOpenFolder}
            onOpenProject={handleOpenProject}
            width={fileExplorerWidth}
            settings={settings}
          />
          <ResizeHandle
            direction="right"
            onResize={setFileExplorerWidth}
            minSize={settings.panels?.fileExplorerMinWidth || 180}
            maxSize={settings.panels?.fileExplorerMaxWidth || 500}
          />
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 200 }}>
          <Editor 
            openFiles={openFiles}
            activeFile={activeFile}
            loadingFile={loadingFile}
            onFileSelect={(file) => setActiveFile(file)}
            onFileChange={handleFileChange}
            onFileClose={handleCloseFile}
            onFileSave={handleFileSave}
            settings={settings}
            onProblemsChange={setProblems}
          />
          
          <AnimatePresence>
            {showTerminal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: terminalHeight, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}
              >
                <ResizeHandle
                  direction="top"
                  onResize={setTerminalHeight}
                  minSize={settings.panels?.terminalMinHeight || 100}
                  maxSize={settings.panels?.terminalMaxHeight || 600}
                />
                <BottomPanel 
                  key={workspacePath || 'default'} 
                  workspacePath={workspacePath} 
                  settings={settings} 
                  problems={problems}
                  onClose={() => setShowTerminal(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <AnimatePresence>
          {showAIPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: aiPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}
            >
              <ResizeHandle
                direction="left"
                onResize={setAiPanelWidth}
                minSize={settings.panels?.aiPanelMinWidth || 280}
                maxSize={settings.panels?.aiPanelMaxWidth || 700}
              />
              <AIPanel 
                context={aiContext}
                settings={settings}
                onInsertCode={handleAIInsert}
                onFileReload={handleFileReload}
                width={aiPanelWidth}
                openFiles={openFiles}
                workspacePath={workspacePath}
                codebaseIndex={codebaseIndex}
                indexingStatus={indexingStatus}
                onReindex={() => workspacePath && indexCodebase(workspacePath)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showGitPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: gitPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}
            >
              <ResizeHandle
                direction="left"
                onResize={setGitPanelWidth}
                minSize={250}
                maxSize={500}
              />
              <GitPanel 
                workspacePath={workspacePath}
                onClose={() => setShowGitPanel(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showGitHubPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: gitHubPanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}
            >
              <ResizeHandle
                direction="left"
                onResize={setGitHubPanelWidth}
                minSize={280}
                maxSize={500}
              />
              <GitHubPanel 
                onClose={() => setShowGitHubPanel(false)}
                onCloneRepo={handleGitHubClone}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            settings={settings}
            onSettingsChange={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showExtensions && (
          <ExtensionMarketplace 
            onClose={() => setShowExtensions(false)}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showCreateProject && (
          <CreateProjectModal 
            onClose={() => setShowCreateProject(false)}
            onProjectCreated={handleProjectCreated}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showCloneRepo && (
          <CloneRepoModal 
            onClose={() => setShowCloneRepo(false)}
            onCloneComplete={handleCloneComplete}
            initialUrl={cloneUrl}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getLanguageFromExtension(ext) {
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', c: 'c', cpp: 'cpp',
    go: 'go', rs: 'rust', html: 'html', css: 'css', json: 'json',
    md: 'markdown', yaml: 'yaml', yml: 'yaml', sh: 'shell',
    php: 'php', xml: 'xml', sql: 'sql', lua: 'lua', r: 'r', swift: 'swift',
    kotlin: 'kotlin', scala: 'scala', dart: 'dart', perl: 'perl', groovy: 'groovy',
    dockerfile: 'dockerfile', makefile: 'makefile', properties: 'properties',
    gradle: 'gradle', clojure: 'clojure', elixir: 'elixir', erlang: 'erlang',
    fsharp: 'fsharp', haskell: 'haskell', lisp: 'lisp', scheme: 'scheme',
    diff: 'diff', patch: 'diff', toml: 'toml', ini: 'ini', cfg: 'ini',
    txt: 'plaintext', log: 'plaintext'
  };
  return map[ext] || 'plaintext';
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
