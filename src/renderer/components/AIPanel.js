import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, BookOpen, RefreshCw, Sparkles, Send, Trash2, Copy, Plus, Check, ChevronDown, Download, Loader2, X, CheckCircle, FileCode, Paperclip, History, PanelLeft, Brain, Square, Search, File, Clipboard } from 'lucide-react';

const { ipcRenderer, clipboard } = window.require('electron');

// Thinking models that support extended thinking
const THINKING_MODELS = [
  'claude-3-7-sonnet', 'claude-sonnet-4', 'claude-opus-4',
  'o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini',
  'deepseek-r1', 'deepseek-reasoner',
  'qwq', 'qwen-qwq'
];

const isThinkingModel = (model) => {
  if (!model) return false;
  const lowerModel = model.toLowerCase();
  return THINKING_MODELS.some(tm => lowerModel.includes(tm.toLowerCase()));
};

const modes = [
  { id: 'ask', icon: MessageSquare, label: 'Ask', description: 'Quick questions about code' },
  { id: 'agent', icon: Bot, label: 'Agent', description: 'Autonomous code changes' },
  { id: 'plan', icon: BookOpen, label: 'Plan', description: 'Create step-by-step plans' },
  { id: 'explain', icon: BookOpen, label: 'Explain', description: 'Explain code in detail' },
  { id: 'refactor', icon: RefreshCw, label: 'Refactor', description: 'Improve existing code' },
  { id: 'generate', icon: Sparkles, label: 'Generate', description: 'Generate new code' },
];

// Agent tools definition
const AGENT_TOOLS = [
  { name: 'read_file', description: 'Read contents of a file', params: ['path'] },
  { name: 'write_file', description: 'Write/overwrite content to an existing file', params: ['path', 'content'] },
  { name: 'create_file', description: 'Create a new file with content (fails if file exists)', params: ['path', 'content'] },
  { name: 'list_files', description: 'List files in a directory', params: ['path'] },
  { name: 'search_files', description: 'Search for files by name pattern', params: ['pattern'] },
  { name: 'grep', description: 'Search for text in files', params: ['search_pattern', 'file_pattern'] },
  { name: 'web_search', description: 'Search the web for information', params: ['query'] },
  { name: 'web_fetch', description: 'Fetch and read content from a webpage URL', params: ['url'] },
];

// Parse tool calls from agent response
const parseToolCalls = (content) => {
  // Try multiple patterns to be more robust
  // Pattern 1: Standard format with possible whitespace/newlines
  const patterns = [
    /<tool>\s*([^<]+?)\s*<\/tool>\s*<params>\s*([\s\S]*?)\s*<\/params>/,
    /<tool>([^<]+)<\/tool>[\s\n]*<params>([\s\S]*?)<\/params>/,
  ];
  
  for (const pattern of patterns) {
    const toolMatch = content.match(pattern);
    if (toolMatch) {
      try {
        const toolName = toolMatch[1].trim();
        let paramsStr = toolMatch[2].trim();
        
        console.log(`[Agent] Found tool call: ${toolName}, params preview: ${paramsStr.slice(0, 100)}...`);
        
        // Try to parse JSON directly first
        try {
          const parsed = JSON.parse(paramsStr);
          return {
            tool: toolName,
            params: parsed,
            fullMatch: toolMatch[0]
          };
        } catch (jsonErr) {
          // If direct parse fails, try fixing common issues
          console.log('[Agent] Direct JSON parse failed, trying to fix...');
          
          let fixedParams = paramsStr;
          
          // Fix backtick template literals: convert `content` to "content"
          // This handles when AI returns {"content": `some text`} instead of {"content": "some text"}
          if (fixedParams.includes('`')) {
            console.log('[Agent] Found backticks in params, converting to JSON strings...');
            // Match backtick strings and convert to proper JSON strings
            fixedParams = fixedParams.replace(/`([\s\S]*?)`/g, (match, content) => {
              // Escape special JSON characters in the content
              const escaped = content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              return `"${escaped}"`;
            });
          }
          
          // Remove newlines between JSON tokens (but preserve \n inside strings)
          fixedParams = fixedParams.replace(/\n(?=\s*["{}\[\]:,])/g, ' ');
          fixedParams = fixedParams.replace(/(?<=["{}\[\]:,])\n/g, ' ');
          
          const parsed = JSON.parse(fixedParams);
          return {
            tool: toolName,
            params: parsed,
            fullMatch: toolMatch[0]
          };
        }
      } catch (e) {
        console.error('[Agent] Failed to parse tool params:', e.message);
        console.error('[Agent] Raw params:', toolMatch[2].slice(0, 500));
        // Return error info so caller can show a message
        return {
          error: true,
          message: `Failed to parse tool parameters: ${e.message}`,
          tool: toolMatch[1]?.trim() || 'unknown',
          rawParams: toolMatch[2]?.slice(0, 200)
        };
      }
    }
  }
  
  // Check if we see incomplete tool tags (streaming might not be done)
  if (content.includes('<tool>')) {
    const toolStartIdx = content.indexOf('<tool>');
    const hasClosingTool = content.includes('</tool>');
    const hasParams = content.includes('<params>');
    const hasClosingParams = content.includes('</params>');
    
    if (!hasClosingParams) {
      console.warn('[Agent] Found incomplete tool call (streaming may not be finished)');
      // Don't return error for incomplete - caller should wait
      return null;
    }
    
    console.warn('[Agent] Found tool tags but could not parse. Content sample:', content.slice(toolStartIdx, toolStartIdx + 200));
  }
  
  return null;
};

const providers = [
  { id: 'claude', name: 'Claude', icon: '🤖' },
  { id: 'ollama', name: 'Ollama', icon: '🦙' },
  { id: 'ollama-cloud', name: 'Ollama Cloud', icon: '☁️' },
  { id: 'openai', name: 'OpenAI', icon: '💚' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔀' },
  { id: 'groq', name: 'Groq', icon: '⚡' },
];

// Tool display components for Claude-like UI
const getToolDescription = (tool, params) => {
  switch (tool) {
    case 'list_files': return `Listed ${params?.path || '.'}`;
    case 'read_file': return `Read ${params?.path}`;
    case 'write_file': return `Write ${params?.path}`;
    case 'create_file': return `Create ${params?.path}`;
    case 'search_files': return `Search: ${params?.pattern}`;
    case 'grep': return `Grepped ${params?.search_pattern}`;
    default: return `${tool}`;
  }
};

const getToolIcon = (tool) => {
  switch (tool) {
    case 'list_files': return '📁';
    case 'read_file': return '📄';
    case 'write_file': return '✏️';
    case 'create_file': return '📝';
    case 'search_files': return '🔍';
    case 'grep': return '🔎';
    default: return '⚡';
  }
};

// Syntax highlight for shell commands (Claude-style)
const highlightCommand = (text) => {
  if (!text) return null;
  const parts = [];
  const words = text.split(/(\s+)/);
  let isFirstWord = true;
  
  words.forEach((word, i) => {
    if (/^\s+$/.test(word)) {
      parts.push(<span key={i}>{word}</span>);
      return;
    }
    
    // Command names (yellow)
    if (isFirstWord || word === '&&' || word === '||' || word === '|') {
      if (word === '&&' || word === '||' || word === '|') {
        parts.push(<span key={i} style={{ color: '#a1a1aa' }}>{word}</span>);
        isFirstWord = true;
      } else {
        parts.push(<span key={i} style={{ color: '#facc15' }}>{word}</span>);
        isFirstWord = false;
      }
    }
    // Flags (cyan)
    else if (word.startsWith('-')) {
      parts.push(<span key={i} style={{ color: '#22d3ee' }}>{word}</span>);
    }
    // Strings in quotes (green)
    else if (word.startsWith('"') || word.startsWith("'")) {
      parts.push(<span key={i} style={{ color: '#4ade80' }}>{word}</span>);
    }
    // Paths (white/default)
    else {
      parts.push(<span key={i} style={{ color: '#e2e8f0' }}>{word}</span>);
    }
  });
  
  return parts;
};

// Tool Result Card - Claude-style tool execution display
function ToolResultCard({ msg, onInsertCode }) {
  const [expanded, setExpanded] = React.useState(false);
  const isSuccess = msg.result && !msg.result.toLowerCase().includes('error');
  const isFileOp = msg.tool === 'write_file' || msg.tool === 'read_file' || msg.tool === 'create_file';
  const isListOp = msg.tool === 'list_files' || msg.tool === 'search_files';
  const isGrepOp = msg.tool === 'grep';
  
  // Count results for summary
  const getResultSummary = () => {
    if (!msg.result) return '';
    const lines = msg.result.split('\n').filter(l => l.trim());
    if (isListOp) return `${lines.length - 1} items`;
    if (isGrepOp) return `${lines.length} matches`;
    return '';
  };
  
  return (
    <div style={{ 
      background: 'var(--card)', 
      border: '1px solid var(--border)', 
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8
    }}>
      {/* Compact Header - Claude style */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          background: 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{getToolIcon(msg.tool)}</span>
          <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
            {getToolDescription(msg.tool, msg.params)}
          </span>
          {getResultSummary() && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              · {getResultSummary()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSuccess && (
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4, 
              fontSize: 12, 
              color: '#71717a'
            }}>
              <Check size={14} style={{ color: '#22c55e' }} /> Success
            </span>
          )}
          <ChevronDown 
            size={14} 
            style={{ 
              color: 'var(--muted-foreground)', 
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease'
            }} 
          />
        </div>
      </div>
      
      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ 
              padding: '0 12px 12px',
              borderTop: '1px solid var(--border)',
              marginTop: 0
            }}>
              {/* Command/path display with syntax highlighting */}
              {msg.params?.path && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)',
                  padding: '10px 12px',
                  borderRadius: 6,
                  marginTop: 10,
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  fontSize: 12
                }}>
                  <span style={{ color: '#22c55e' }}>$</span>{' '}
                  {highlightCommand(`${msg.tool === 'read_file' ? 'cat' : msg.tool === 'list_files' ? 'ls' : 'write'} ${msg.params.path}`)}
                </div>
              )}
              
              {/* Result content */}
              <div style={{ 
                fontSize: 12, 
                lineHeight: 1.6,
                maxHeight: 300, 
                overflow: 'auto',
                marginTop: 10,
                color: '#a1a1aa',
                whiteSpace: 'pre-wrap',
                fontFamily: "'SF Mono', 'JetBrains Mono', monospace"
              }}>
                {msg.result}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tool Pending Card - Claude-style file change approval
function ToolPendingCard({ msg, onApprove, onDecline }) {
  const [showContent, setShowContent] = React.useState(true);
  
  return (
    <div style={{ 
      background: 'var(--card)', 
      border: '1px solid var(--border)', 
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#f97316', fontFamily: "'SF Mono', monospace", fontSize: 14 }}>{'{}'}</span>
          <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
            {msg.tool === 'create_file' ? 'Create' : msg.tool === 'write_file' ? 'Write' : 'Edit'} {msg.params?.path}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onDecline}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            style={{
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--foreground)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            Accept <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>⌘↵</span>
          </button>
        </div>
      </div>
      
      {/* File content preview - collapsible */}
      {msg.params?.content && (
        <>
          <div 
            onClick={() => setShowContent(!showContent)}
            style={{ 
              padding: '6px 12px',
              borderTop: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--muted-foreground)'
            }}
          >
            <ChevronDown 
              size={12} 
              style={{ 
                transform: showContent ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease'
              }} 
            />
            Preview ({msg.params.content.length} chars)
          </div>
          <AnimatePresence>
            {showContent && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '10px 12px', 
                  margin: '0 12px 12px',
                  borderRadius: 6, 
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace", 
                  fontSize: 11, 
                  maxHeight: 200, 
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: '#a1a1aa',
                  border: '1px solid var(--border)'
                }}>
                  {msg.params.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// Generate unique ID for chats
const generateId = () => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function AIPanel({ context, settings, onInsertCode, onFileReload, workspacePath, openFiles, codebaseIndex, indexingStatus, onReindex }) {
  // Chat tabs state - load from .IDEC folder in project
  const [chatTabs, setChatTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y } for context menu position
  const lastLoadedWorkspace = useRef(null);
  const saveTimeoutRef = useRef(null);
  
  // Load chats when workspace changes
  useEffect(() => {
    // Only load if workspace actually changed and we have a valid path
    if (!workspacePath || workspacePath === lastLoadedWorkspace.current) return;
    
    console.log(`[AIPanel] Loading chats for workspace: ${workspacePath}`);
    lastLoadedWorkspace.current = workspacePath;
    
    // Load from .IDEC/chat-history.json
    ipcRenderer.invoke('project-data-read', workspacePath, 'chat-history.json')
      .then(result => {
        if (result.success && result.data && result.data.length > 0) {
          console.log(`[AIPanel] Loaded ${result.data.length} chat tabs from .IDEC folder`);
          setChatTabs(result.data);
          setActiveTabId(result.data[0].id);
        } else {
          console.log(`[AIPanel] No saved chats, creating default tab`);
          const defaultTab = { id: generateId(), name: 'Chat 1', messages: [], provider: 'claude', model: '', mode: 'ask', createdAt: Date.now() };
          setChatTabs([defaultTab]);
          setActiveTabId(defaultTab.id);
        }
      })
      .catch(err => {
        console.error('[AIPanel] Failed to load chats:', err);
        const defaultTab = { id: generateId(), name: 'Chat 1', messages: [], provider: 'claude', model: '', mode: 'ask', createdAt: Date.now() };
        setChatTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      });
  }, [workspacePath]);
  
  // Save chats to .IDEC folder (debounced)
  const saveChatsToProject = useCallback((chats) => {
    if (!workspacePath) return;
    
    // Debounce saves to avoid excessive writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      ipcRenderer.invoke('project-data-write', workspacePath, 'chat-history.json', chats)
        .then(result => {
          if (!result.success) {
            console.error('[AIPanel] Failed to save chats:', result.error);
          }
        });
    }, 500);
  }, [workspacePath]);
  
  // Get current tab
  const currentTab = chatTabs.find(t => t.id === activeTabId) || chatTabs[0];
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [agentStatus, setAgentStatus] = useState(null); // { step, action, details }
  const [ragIndexed, setRagIndexed] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null); // { messageIndex, codeIndex, code }
  const [pendingToolApproval, setPendingToolApproval] = useState(null); // { tool, params, resolve }
  const pendingToolApprovalRef = useRef(null);
  const [mode, setMode] = useState(currentTab?.mode || 'ask');
  const [provider, setProvider] = useState(currentTab?.provider || settings?.ai?.provider || 'claude');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(currentTab?.model || '');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pullingModel, setPullingModel] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [projectFiles, setProjectFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const messagesEndRef = useRef(null);
  const streamRequestRef = useRef(null);
  const streamingContentRef = useRef('');
  const thinkingContentRef = useRef('');
  const fileSearchRef = useRef(null);
  const inputRef = useRef(null);
  
  const aiSettings = settings?.ai || {};

  // Sync provider with settings when settings load
  useEffect(() => {
    if (settings?.ai?.provider && settings.ai.provider !== provider) {
      setProvider(settings.ai.provider);
    }
  }, [settings?.ai?.provider]);

  // Stream listeners
  useEffect(() => {
    const handleChunk = (event, data) => {
      console.log(`[AIPanel] Received ai-stream-chunk:`, data?.requestId, 'current ref:', streamRequestRef.current);
      if (streamRequestRef.current === data.requestId) {
        console.log(`[AIPanel] Setting streaming content, length:`, data.fullContent?.length);
        streamingContentRef.current = data.fullContent || '';
        thinkingContentRef.current = data.thinkingContent || '';
        setStreamingContent(data.fullContent);
        setThinkingContent(data.thinkingContent || '');
      }
    };
    
    const handleDone = (event, data) => {
      console.log(`[AIPanel] Received ai-stream-done:`, data?.requestId, 'current ref:', streamRequestRef.current);
      if (streamRequestRef.current === data.requestId) {
        console.log(`[AIPanel] Stream done, final content length:`, data.fullContent?.length);
        // Update refs with final content to prevent race conditions
        if (data.fullContent) {
          streamingContentRef.current = data.fullContent;
          setStreamingContent(data.fullContent);
        }
        if (data.thinkingContent) {
          thinkingContentRef.current = data.thinkingContent;
          setThinkingContent(data.thinkingContent);
        }
        streamRequestRef.current = null;
      }
    };
    
    const handleError = (event, data) => {
      console.log(`[AIPanel] Received ai-stream-error:`, data?.requestId, data?.error);
      if (streamRequestRef.current === data.requestId) {
        streamRequestRef.current = null;
        setStreamingContent('');
        setThinkingContent('');
      }
    };
    
    console.log('[AIPanel] Setting up stream listeners');
    ipcRenderer.on('ai-stream-chunk', handleChunk);
    ipcRenderer.on('ai-stream-done', handleDone);
    ipcRenderer.on('ai-stream-error', handleError);
    
    return () => {
      console.log('[AIPanel] Removing stream listeners');
      ipcRenderer.removeListener('ai-stream-chunk', handleChunk);
      ipcRenderer.removeListener('ai-stream-done', handleDone);
      ipcRenderer.removeListener('ai-stream-error', handleError);
    };
  }, []);

  // Helper to get current messages
  const messages = currentTab?.messages || [];
  
  // Helper to update messages for current tab
  const setMessages = useCallback((updater) => {
    setChatTabs(prev => {
      const updated = prev.map(tab => {
        if (tab.id === activeTabId) {
          const newMessages = typeof updater === 'function' ? updater(tab.messages) : updater;
          return { ...tab, messages: newMessages, updatedAt: Date.now() };
        }
        return tab;
      });
      saveChatsToProject(updated);
      return updated;
    });
  }, [activeTabId, workspacePath]);

  // Save chats when tabs change
  useEffect(() => {
    if (chatTabs.length > 0 && lastLoadedWorkspace.current === workspacePath) {
      saveChatsToProject(chatTabs);
    }
  }, [chatTabs, workspacePath, saveChatsToProject]);

  // Build RAG index when workspace changes
  useEffect(() => {
    if (workspacePath && !ragIndexed) {
      ipcRenderer.invoke('rag-build-index', workspacePath).then(result => {
        if (result.success) {
          setRagIndexed(true);
          console.log(`[RAG] Indexed ${result.chunks} chunks from ${result.files} files`);
        }
      });
    }
  }, [workspacePath, ragIndexed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Fetch models when provider changes
  useEffect(() => {
    fetchModels();
  }, [provider, settings]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      // Get fresh settings reference to avoid stale closure
      const currentAiSettings = settings?.ai || {};
      const config = {
        claudeApiKey: currentAiSettings.claudeApiKey,
        openaiApiKey: currentAiSettings.openaiApiKey,
        groqApiKey: currentAiSettings.groqApiKey,
        ollamaUrl: currentAiSettings.ollamaUrl || 'http://localhost:11434',
        ollamaCloudUrl: currentAiSettings.ollamaCloudUrl || 'https://api.ollama.com',
        ollamaCloudApiKey: currentAiSettings.ollamaCloudApiKey,
        openrouterApiKey: currentAiSettings.openrouterApiKey
      };
      
      const result = await ipcRenderer.invoke('fetch-models', provider, config);
      if (result.success) {
        const modelIds = result.models.map(m => typeof m === 'string' ? m : m.id);
        setModels(modelIds);
        if (modelIds.length > 0 && !modelIds.includes(selectedModel)) {
          setSelectedModel(modelIds[0]);
        }
      } else {
        setModels([]);
        setSelectedModel('');
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([]);
    }
    setLoadingModels(false);
  };

  const pullOllamaModel = async (modelName) => {
    if (!modelName || provider !== 'ollama') return;
    setPullingModel(true);
    setMessages(prev => [...prev, { role: 'system', content: `⏳ Pulling model "${modelName}"... This may take a while.` }]);
    
    try {
      const ollamaUrl = aiSettings.ollamaUrl || 'http://localhost:11434';
      const result = await ipcRenderer.invoke('ollama-pull', modelName, ollamaUrl);
      if (result.success) {
        setMessages(prev => [...prev, { role: 'system', content: `✅ Model "${modelName}" pulled successfully!` }]);
        await fetchModels();
      } else {
        setMessages(prev => [...prev, { role: 'system', content: `❌ Failed to pull model: ${result.error}` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'system', content: `❌ Error: ${error.message}` }]);
    }
    setPullingModel(false);
  };

  const getApiKey = () => {
    const currentAiSettings = settings?.ai || {};
    if (provider === 'claude') return currentAiSettings.claudeApiKey;
    if (provider === 'openai') return currentAiSettings.openaiApiKey;
    if (provider === 'groq') return currentAiSettings.groqApiKey;
    if (provider === 'ollama-cloud') return currentAiSettings.ollamaCloudApiKey;
    if (provider === 'openrouter') return currentAiSettings.openrouterApiKey;
    return null;
  };

  const isConfigured = () => {
    if (provider === 'ollama') return models.length > 0;
    return !!getApiKey();
  };

  // Execute agent tool and return result
  const executeAgentTool = useCallback(async (toolName, params) => {
    console.log(`[Agent] Executing tool: ${toolName}`, params, 'workspacePath:', workspacePath);
    setAgentStatus({ step: 'tool', action: `Running ${toolName}...`, tool: toolName });
    
    // Validate workspacePath
    if (!workspacePath) {
      return `Error: No project folder open. Please open a folder first.`;
    }
    
    try {
      switch (toolName) {
        case 'list_files': {
          const targetPath = params.path || '.';
          const dirPath = targetPath === '.' ? workspacePath : 
            (targetPath.startsWith('/') ? targetPath : `${workspacePath}/${targetPath}`);
          console.log(`[Agent] list_files: resolving "${targetPath}" to "${dirPath}"`);
          try {
            const result = await ipcRenderer.invoke('read-directory', dirPath);
            console.log(`[Agent] list_files result:`, result);
            if (!result) {
              return `Error listing files: No response from file system`;
            }
            // Handle both { success, entries } format and direct array format
            const entries = result.entries || (Array.isArray(result) ? result : null);
            if (entries && Array.isArray(entries)) {
              const fileList = entries.map(e => `${e.isDirectory ? '📁' : '📄'} ${e.name}`).join('\n');
              return fileList.length > 0 ? `Files in ${targetPath}:\n${fileList}` : `No files found in ${targetPath}`;
            }
            return `Error listing files: ${result.error || 'Unknown error'}`;
          } catch (err) {
            console.error(`[Agent] list_files error:`, err);
            return `Error listing files: ${err.message}`;
          }
        }
        case 'read_file': {
          const targetPath = params.path;
          if (!targetPath) return 'Error: path parameter required';
          const filePath = targetPath.startsWith('/') ? targetPath : `${workspacePath}/${targetPath}`;
          console.log(`[Agent] read_file: resolving "${targetPath}" to "${filePath}"`);
          const result = await ipcRenderer.invoke('read-file', filePath);
          console.log(`[Agent] read_file result:`, result?.success, result?.error);
          if (!result) {
            return `Error reading file: No response from file system`;
          }
          if (result.success && result.content !== undefined) {
            const ext = targetPath.split('.').pop() || '';
            return `Contents of ${targetPath}:\n\`\`\`${ext}\n${result.content}\n\`\`\``;
          }
          return `Error reading file: ${result.error || 'Unknown error'}`;
        }
        case 'write_file': {
          const targetPath = params.path;
          if (!targetPath) return 'Error: path parameter required';
          if (params.content === undefined || params.content === null) return 'Error: content parameter required';
          const filePath = targetPath.startsWith('/') ? targetPath : `${workspacePath}/${targetPath}`;
          console.log(`[Agent] write_file: resolving "${targetPath}" to "${filePath}"`);
          console.log(`[Agent] write_file: content length ${params.content.length} chars`);
          try {
            const result = await ipcRenderer.invoke('write-file', filePath, params.content);
            console.log(`[Agent] write_file result:`, result?.success, result?.error);
            if (!result) {
              return `Error writing file: No response from file system`;
            }
            if (result.success) {
              // Reload the file in the editor if it's open
              if (onFileReload) {
                console.log(`[Agent] write_file: triggering file reload for ${filePath}`);
                onFileReload(filePath);
              }
              return `Successfully wrote to ${targetPath}`;
            }
            return `Error writing file: ${result.error || 'Unknown error'}`;
          } catch (err) {
            console.error(`[Agent] write_file error:`, err);
            return `Error writing file: ${err.message}`;
          }
        }
        case 'create_file': {
          const targetPath = params.path;
          if (!targetPath) return 'Error: path parameter required';
          const content = params.content !== undefined ? params.content : '';
          const filePath = targetPath.startsWith('/') ? targetPath : `${workspacePath}/${targetPath}`;
          console.log(`[Agent] create_file: resolving "${targetPath}" to "${filePath}"`);
          console.log(`[Agent] create_file: content length ${content.length} chars`);
          try {
            const result = await ipcRenderer.invoke('agent-create-file', workspacePath, targetPath, content);
            console.log(`[Agent] create_file result:`, result?.success, result?.error);
            if (!result) {
              return `Error creating file: No response from file system`;
            }
            if (result.success) {
              // Reload the file in the editor if it's open
              if (onFileReload) {
                console.log(`[Agent] create_file: triggering file reload for ${filePath}`);
                onFileReload(filePath);
              }
              return `Successfully created ${targetPath}`;
            }
            return `Error creating file: ${result.error || 'Unknown error'}`;
          } catch (err) {
            console.error(`[Agent] create_file error:`, err);
            return `Error creating file: ${err.message}`;
          }
        }
        case 'search_files': {
          const pattern = params.pattern;
          if (!pattern) return 'Error: pattern parameter required';
          console.log(`[Agent] search_files: searching for "${pattern}" in "${workspacePath}"`);
          const result = await ipcRenderer.invoke('list-files-recursive', workspacePath);
          console.log(`[Agent] search_files: got result:`, result?.success, result?.files?.length);
          if (!result) {
            return `Error searching: No response from file system`;
          }
          if (result.success && result.files) {
            const patternLower = pattern.toLowerCase();
            // Convert glob pattern to regex for proper matching
            const isGlob = patternLower.includes('*') || patternLower.includes('?');
            let matchFn;
            if (isGlob) {
              // Convert glob to regex: * -> .*, ? -> ., escape other special chars
              const regexPattern = patternLower
                .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
              const regex = new RegExp(regexPattern + '$', 'i'); // Match at end of path
              console.log(`[Agent] search_files: using regex "${regex.source}"`);
              matchFn = (f) => regex.test(f);
            } else {
              matchFn = (f) => f.toLowerCase().includes(patternLower);
            }
            const matches = result.files
              .filter(matchFn)
              .map(f => f.replace(workspacePath + '/', ''))
              .slice(0, 20);
            console.log(`[Agent] search_files: found ${matches.length} matches`);
            return matches.length > 0 
              ? `Files matching "${pattern}":\n${matches.join('\n')}`
              : `No files found matching "${pattern}" (searched ${result.files.length} files)`;
          }
          return `Error searching: ${result.error || 'Unknown error'}`;
        }
        case 'grep': {
          const searchPattern = params.search_pattern;
          if (!searchPattern) return 'Error: search_pattern parameter required';
          const filePattern = params.file_pattern || '*';
          console.log(`[Agent] grep: searching for "${searchPattern}" in files matching "${filePattern}"`);
          
          // Simple grep using file reading
          const searchResult = await ipcRenderer.invoke('list-files-recursive', workspacePath);
          if (!searchResult) {
            return `Error: No response from file system`;
          }
          if (!searchResult.success || !searchResult.files) {
            return `Error: ${searchResult.error || 'Failed to list files'}`;
          }
          console.log(`[Agent] grep: got ${searchResult.files.length} files to search`);
          
          const matches = [];
          
          // Convert file pattern glob to regex for proper matching
          let fileMatchFn;
          if (filePattern === '*') {
            fileMatchFn = () => true;
          } else {
            const regexPattern = filePattern.toLowerCase()
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.');
            const regex = new RegExp(regexPattern + '$', 'i');
            fileMatchFn = (f) => regex.test(f);
          }
          
          for (const filePath of searchResult.files.slice(0, 50)) {
            if (!fileMatchFn(filePath)) continue;
            const content = await ipcRenderer.invoke('read-file', filePath);
            if (content && content.success && content.content && content.content.includes(searchPattern)) {
              const lines = content.content.split('\n');
              const matchingLines = lines
                .map((line, i) => ({ line, num: i + 1 }))
                .filter(({ line }) => line.includes(searchPattern))
                .slice(0, 3);
              if (matchingLines.length > 0) {
                matches.push(`${filePath.replace(workspacePath + '/', '')}:\n${matchingLines.map(m => `  ${m.num}: ${m.line.trim()}`).join('\n')}`);
              }
            }
            if (matches.length >= 10) break;
          }
          console.log(`[Agent] grep: found ${matches.length} matches`);
          return matches.length > 0
            ? `Search results for "${searchPattern}":\n${matches.join('\n\n')}`
            : `No matches found for "${searchPattern}" in ${filePattern} files`;
        }
        case 'web_search': {
          const query = params.query;
          if (!query) return 'Error: query parameter required';
          console.log(`[Agent] web_search: searching for "${query}"`);
          try {
            const result = await ipcRenderer.invoke('web-search', query, { maxResults: 5 });
            if (!result || !result.success) {
              return `Error searching web: ${result?.error || 'Unknown error'}`;
            }
            if (result.results.length === 0) {
              return `No results found for "${query}"`;
            }
            const formattedResults = result.results.map((r, i) => 
              `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`
            ).join('\n\n');
            return `Web search results for "${query}":\n\n${formattedResults}`;
          } catch (err) {
            console.error(`[Agent] web_search error:`, err);
            return `Error searching web: ${err.message}`;
          }
        }
        case 'web_fetch': {
          const url = params.url;
          if (!url) return 'Error: url parameter required';
          console.log(`[Agent] web_fetch: fetching "${url}"`);
          try {
            const result = await ipcRenderer.invoke('web-fetch', url, { maxLength: 10000 });
            if (!result || !result.success) {
              return `Error fetching URL: ${result?.error || 'Unknown error'}`;
            }
            return `Content from ${url}:\n\n${result.content}`;
          } catch (err) {
            console.error(`[Agent] web_fetch error:`, err);
            return `Error fetching URL: ${err.message}`;
          }
        }
        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error) {
      return `Tool error: ${error.message}`;
    }
  }, [workspacePath, onFileReload]);

  const sendMessage = useCallback(async (customPrompt = null) => {
    const prompt = customPrompt || input;
    if (!prompt.trim() && mode === 'ask') return;
    
    if (!isConfigured()) {
      const msg = provider === 'ollama' 
        ? '⚠️ No Ollama models available. Make sure Ollama is running.'
        : `⚠️ Add your ${providers.find(p => p.id === provider)?.name} API key in Settings.`;
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
      return;
    }

    // Helper to chunk large files
    const chunkCode = (code, maxChunkSize = 3000) => {
      if (code.length <= maxChunkSize) return [code];
      const chunks = [];
      const lines = code.split('\n');
      let currentChunk = '';
      
      for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxChunkSize && currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
      return chunks;
    };

    // RAG: Search for relevant code chunks (only if no direct file context)
    let ragContext = '';
    const hasDirectContext = context.code || attachedFiles.length > 0;
    if (workspacePath && !hasDirectContext && (mode === 'ask' || mode === 'agent' || mode === 'plan')) {
      try {
        const ragResult = await ipcRenderer.invoke('rag-search', workspacePath, prompt, 5);
        if (ragResult.success && ragResult.results.length > 0) {
          ragContext = '## Relevant Code from Codebase\n';
          for (const result of ragResult.results) {
            ragContext += `\n### ${result.filePath} (lines ${result.startLine}-${result.endLine})\n`;
            ragContext += `\`\`\`\n${result.content.slice(0, 1500)}\n\`\`\`\n`;
          }
          ragContext += '\n';
        }
      } catch (e) {
        console.warn('[RAG] Search failed:', e);
      }
    }

    // Build context - prioritize user's direct context over project-wide context
    let contextStr = '';
    
    // FIRST: Handle current file (user's primary context)
    if (context.code && context.fileName) {
      const codeLength = context.code.length;
      if (codeLength > 6000) {
        // Use RAG to extract relevant chunks based on the prompt
        try {
          const analyzed = await ipcRenderer.invoke('rag-analyze-file', context.code, prompt, context.fileName, 8000);
          if (analyzed.success) {
            if (analyzed.isFullFile) {
              contextStr += `## Current File: ${context.fileName}\n\`\`\`${context.language}\n${analyzed.content}\n\`\`\`\n\n`;
            } else {
              contextStr += `## Current File: ${context.fileName} (relevant sections from ${Math.round(codeLength/1000)}KB file)\n\`\`\`${context.language}\n${analyzed.content}\n\`\`\`\n\n`;
            }
          } else {
            // Fallback to chunking
            const chunks = chunkCode(context.code, 4000);
            contextStr += `## Current File: ${context.fileName} [Chunk 1/${chunks.length}]\n\`\`\`${context.language}\n${chunks[0]}\n\`\`\`\n\n`;
          }
        } catch (e) {
          console.warn('[AIPanel] RAG analyze failed, using chunking:', e);
          const chunks = chunkCode(context.code, 4000);
          contextStr += `## Current File: ${context.fileName} [Chunk 1/${chunks.length}]\n\`\`\`${context.language}\n${chunks[0]}\n\`\`\`\n\n`;
        }
      } else {
        contextStr += `## Current File: ${context.fileName}\n\`\`\`${context.language}\n${context.code}\n\`\`\`\n\n`;
      }
    }
    
    // SECOND: Attached files
    for (const file of attachedFiles) {
      if (file.content.length > 4000) {
        try {
          const analyzed = await ipcRenderer.invoke('rag-analyze-file', file.content, prompt, file.name, 4000);
          if (analyzed.success) {
            if (analyzed.isFullFile) {
              contextStr += `## Attached: ${file.name}\n\`\`\`${file.language || ''}\n${analyzed.content}\n\`\`\`\n\n`;
            } else {
              contextStr += `## Attached: ${file.name} (relevant sections)\n\`\`\`${file.language || ''}\n${analyzed.content}\n\`\`\`\n\n`;
            }
          } else {
            contextStr += `## Attached: ${file.name}\n\`\`\`${file.language || ''}\n${file.content.slice(0, 3000)}\n... [truncated]\n\`\`\`\n\n`;
          }
        } catch (e) {
          contextStr += `## Attached: ${file.name}\n\`\`\`${file.language || ''}\n${file.content.slice(0, 3000)}\n... [truncated]\n\`\`\`\n\n`;
        }
      } else {
        contextStr += `## Attached: ${file.name}\n\`\`\`${file.language || ''}\n${file.content}\n\`\`\`\n\n`;
      }
    }
    
    // THIRD: Only include project context if no direct file context provided
    if (!hasDirectContext) {
      if (codebaseIndex) {
        const indexSummary = codebaseIndex.slice(0, 1500);
        contextStr += `## Project Overview\n${indexSummary}\n\n`;
      }
      if (ragContext) {
        contextStr += ragContext;
      }
    }

    // Detect if user is asking for code changes/edits
    const editKeywords = /\b(change|modify|update|fix|edit|refactor|replace|convert|transform|make|set|add|remove|delete|rename|move|color|style|theme)\b/i;
    const isEditRequest = (mode === 'ask' || mode === 'agent') && context.code && editKeywords.test(prompt);
    
    // Build prompt based on mode
    let fullPrompt = prompt;
    let systemPrompt = '';
    
    if (mode === 'agent') {
      systemPrompt = `You are an autonomous coding agent with tool execution capabilities.

AVAILABLE TOOLS:
- list_files(path): List files in a directory (use "." for current directory)
- read_file(path): Read a file's contents
- create_file(path, content): Create a NEW file (use when file doesn't exist)
- write_file(path, content): Overwrite an EXISTING file (use to update existing files)
- search_files(pattern): Search for files by name pattern
- grep(search_pattern, file_pattern): Search for text in files
- web_search(query): Search the web for information, documentation, APIs, or solutions
- web_fetch(url): Fetch and read content from a specific webpage URL

CRITICAL RULES:
1. When you need to perform ANY action, you MUST include the tool call XML in your response
2. Do NOT just describe what you would do - ACTUALLY call the tool
3. NEVER say "I will update the file" without including the <tool>write_file</tool> or <tool>create_file</tool> call
4. For NEW files, use create_file. For EXISTING files, use write_file
5. If you need to look up documentation, APIs, or find solutions online, use web_search

TOOL CALL FORMAT (you MUST use this exact XML format):
<tool>tool_name</tool>
<params>{"param1": "value1"}</params>

EXAMPLE - To list files:
<tool>list_files</tool>
<params>{"path": "src"}</params>

EXAMPLE - To read a file:
<tool>read_file</tool>
<params>{"path": "package.json"}</params>

EXAMPLE - To create a NEW file:
<tool>create_file</tool>
<params>{"path": "hello.py", "content": "print('Hello, World!')"}</params>

EXAMPLE - To update an EXISTING file:
<tool>write_file</tool>
<params>{"path": "README.md", "content": "# Project Title\\n\\nUpdated content here..."}</params>

EXAMPLE - To search the web for documentation or solutions:
<tool>web_search</tool>
<params>{"query": "react useEffect cleanup function"}</params>

EXAMPLE - To fetch content from a URL:
<tool>web_fetch</tool>
<params>{"url": "https://api.example.com/docs"}</params>

WORKFLOW:
1. Use tools to explore and understand the codebase
2. After receiving tool results, decide next steps
3. If you need external information (APIs, docs, solutions), use web_search or web_fetch
4. Use write_file to make changes - ALWAYS include the full file content
5. Provide a summary when complete

IMPORTANT: Your response MUST include the <tool> and <params> XML tags when performing any action. The system executes tools automatically.`;
      
      fullPrompt = `${contextStr}\n\nTask: ${prompt}\n\nUse the appropriate tool NOW. Include the <tool> and <params> XML tags in your response.`;
    } else if (mode === 'plan') {
      systemPrompt = `You are a senior software architect. Create detailed, actionable plans for coding tasks.`;
      
      fullPrompt = `${contextStr}\n\nCreate a detailed implementation plan for: ${prompt}

Include:
1. **Overview**: Brief summary of the approach
2. **Steps**: Numbered list of specific tasks
3. **Files to Modify**: List of files that need changes
4. **Code Changes**: Key code snippets or pseudocode
5. **Testing**: How to verify the changes work
6. **Risks**: Potential issues and mitigations`;
    } else if (mode === 'explain' && context.code) {
      fullPrompt = `Explain this ${context.language} code in detail:\n\`\`\`${context.language}\n${context.code}\n\`\`\``;
    } else if (mode === 'refactor' && context.code) {
      fullPrompt = `Refactor this ${context.language} code to improve quality:\n\`\`\`${context.language}\n${context.code}\n\`\`\`\n\nProvide the complete refactored code.`;
    } else if (mode === 'generate') {
      fullPrompt = `Generate ${context.language || 'code'} for: ${prompt}\n\nProvide complete, working code.`;
    } else if (isEditRequest && contextStr) {
      fullPrompt = `${contextStr}\nTask: ${prompt}\n\nProvide the complete modified code in a code block.`;
    } else if (contextStr) {
      fullPrompt = `${contextStr}\nQuestion: ${prompt}`;
    }

    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setThinkingContent('');
    setAgentStatus(mode === 'agent' ? { step: 1, action: 'Analyzing task...' } : null);

    const requestStartTime = Date.now();
    console.log(`[AI Panel] Starting request - Provider: ${provider}, Mode: ${mode}`);

    try {
      // Get fresh settings reference to avoid stale closure
      const currentAiSettings = settings?.ai || {};
      const ollamaUrl = currentAiSettings.ollamaUrl || 'http://localhost:11434';
      const model = selectedModel || (provider === 'claude' ? 'claude-sonnet-4-20250514' : 'llama3.2');
      const config = {
        claudeApiKey: currentAiSettings.claudeApiKey,
        openaiApiKey: currentAiSettings.openaiApiKey,
        groqApiKey: currentAiSettings.groqApiKey,
        ollamaUrl: ollamaUrl,
        ollamaCloudUrl: currentAiSettings.ollamaCloudUrl || 'https://api.ollama.com',
        ollamaCloudApiKey: currentAiSettings.ollamaCloudApiKey,
        openrouterApiKey: currentAiSettings.openrouterApiKey
      };
      
      // Build messages array with optional system prompt
      // Trim history to prevent context overflow (~4 chars per token estimate)
      const MAX_HISTORY_CHARS = 50000; // ~12.5K tokens for history
      let historyChars = 0;
      const trimmedMessages = [];
      
      // Always include recent messages, working backwards
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const msgSize = (msg.content || '').length;
        if (historyChars + msgSize > MAX_HISTORY_CHARS && trimmedMessages.length > 0) {
          break; // Stop if we exceed limit (but keep at least some context)
        }
        trimmedMessages.unshift(msg);
        historyChars += msgSize;
      }
      
      if (trimmedMessages.length < messages.length) {
        console.log(`[AI Panel] Trimmed message history: ${messages.length} -> ${trimmedMessages.length} messages`);
      }
      
      const messagesArray = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...trimmedMessages, { role: 'user', content: fullPrompt }]
        : [...trimmedMessages, { role: 'user', content: fullPrompt }];
      
      // Use streaming for supported providers
      const enableThinking = isThinkingModel(model);
      
      // Generate requestId in renderer BEFORE calling main to avoid race condition
      // (chunks arrive before invoke() returns)
      const requestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      streamRequestRef.current = requestId;
      console.log(`[AI Panel FIX v2] Sending stream request to ${provider} with model ${model}, thinking: ${enableThinking}, requestId: ${requestId}`);
      
      const options = { enableThinking, requestId };
      console.log('[AI Panel FIX v2] Options being sent:', JSON.stringify(options));
      const streamResult = await ipcRenderer.invoke('ai-request-stream', provider, model,
        messagesArray, config, options);
      
      if (!streamResult.success) {
        streamRequestRef.current = null;
        throw new Error(streamResult.error);
      }
      
      console.log(`[AIPanel] Stream invoke returned for requestId: ${requestId}`);
      
      // Wait for stream to complete
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!streamRequestRef.current) {
            console.log('[AIPanel] Stream ref cleared, resolving wait promise');
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // Timeout after 120 seconds
        setTimeout(() => {
          console.log('[AIPanel] Wait promise timed out after 120s');
          clearInterval(checkInterval);
          resolve();
        }, 120000);
      });
      
      console.log('[AIPanel] Wait promise resolved, continuing with mode:', mode);
      
      const duration = Date.now() - requestStartTime;
      console.log(`[AI Panel] Stream completed - Duration: ${duration}ms, content length: ${streamingContentRef.current.length}`);
      
      let finalContent = streamingContentRef.current || 'No response received';
      const finalThinking = thinkingContentRef.current || null;
      
      // Agent mode: check for tool calls and execute them in a loop
      console.log(`[AI Panel] Mode check: "${mode}", is agent: ${mode === 'agent'}`);
      if (mode === 'agent') {
        console.log('[Agent] Entering agent mode processing, content length:', finalContent.length);
        let toolCall = parseToolCalls(finalContent);
        console.log('[Agent] parseToolCalls result:', toolCall ? (toolCall.error ? 'error' : toolCall.tool) : 'null');
        let agentIterations = 0;
        const maxIterations = 10;
        let conversationHistory = [...messagesArray, { role: 'assistant', content: finalContent }];
        
        // Handle tool call parsing errors
        if (toolCall?.error) {
          console.error('[Agent] Tool call parse error:', toolCall.message);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: finalContent + `\n\n⚠️ **Tool call parsing failed**: ${toolCall.message}\n\nThe AI tried to call \`${toolCall.tool}\` but the parameters couldn't be parsed. Please try again or rephrase your request.`,
            mode 
          }]);
          setStreamingContent('');
          setThinkingContent('');
          streamingContentRef.current = '';
          thinkingContentRef.current = '';
          setIsLoading(false);
          setAgentStatus(null);
          return;
        }
        
        // Check if AI described tool usage but didn't actually use tool format
        // Common patterns: "let me write", "I'll update", "let's proceed with", "I will create"
        if (!toolCall) {
          console.log('[Agent] No tool call found, checking for pending action description...');
          console.log('[Agent] Content sample (last 200 chars):', finalContent.slice(-200));
          
          // Simple check: does the content end with phrases that suggest upcoming action?
          const lowerContent = finalContent.toLowerCase();
          const lastSentence = finalContent.slice(-300);
          
          // More flexible pattern: matches phrases like "I'll use ... to update", "Let me go ahead with modifying", etc.
          const describesPendingAction = (
            /(?:let me|i'll|let's|i will|going to)\s+(?:now\s+)?(?:proceed\s+(?:with|to)\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /(?:let me|i'll|let's|i will|going to)\s+(?:\w+\s+)*?(?:to\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /(?:let me|i'll|let's|i will)\s+go\s+ahead\s+(?:with\s+|and\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /proceed(?:ing)?\s+(?:with|to)\s+(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            // Additional patterns for common AI "about to do something" phrases
            /i(?:'ll| will) (?:now )?(?:make|do|perform|execute|apply|implement)/i.test(lastSentence) ||
            /let(?:'s| me) (?:now )?(?:make|do|perform|execute|apply|implement)/i.test(lastSentence) ||
            /proceeding (?:to|with)/i.test(lastSentence) ||
            // Ends with a statement about updating/modifying without the tool
            /(?:update|modify|change|edit|write to) (?:the )?(?:readme|file|code)/i.test(lastSentence)
          );
          const hasFileReference = /(?:readme|\.md|\.js|\.json|\.ts|\.py|\.txt|file|code)/i.test(finalContent);
          console.log('[Agent] describesPendingAction:', describesPendingAction, 'hasFileReference:', hasFileReference);
          
          if (describesPendingAction && hasFileReference) {
            console.warn('[Agent] AI described file operation but did not use tool format - TRIGGERING RETRY');
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: finalContent + `\n\n💡 *It looks like I described a file operation but didn't execute it. Let me try again with the proper tool call...*`,
              mode 
            }]);
            setStreamingContent('');
            
            // Make another request asking AI to actually use the tool
            const retryMessagesArray = [...messagesArray, 
              { role: 'assistant', content: finalContent },
              { role: 'user', content: 'ERROR: You described a file operation but did NOT include the required tool call XML. You MUST use <tool>write_file</tool> with <params>{"path": "...", "content": "..."}</params> to actually make changes. Include the COMPLETE tool call XML in your next response.' }
            ];
            
            streamingContentRef.current = '';
            const retryRequestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            streamRequestRef.current = retryRequestId;
            console.log('[Agent] Starting retry request with ID:', retryRequestId);
            setAgentStatus({ step: 1, action: 'Retrying with tool call...' });
            
            const retryResult = await ipcRenderer.invoke('ai-request-stream', provider, model,
              retryMessagesArray, config, { requestId: retryRequestId });
            
            if (retryResult.success) {
              await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                  if (!streamRequestRef.current) { clearInterval(checkInterval); resolve(); }
                }, 100);
                setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
              });
              
              const retryContent = streamingContentRef.current || '';
              const retryToolCall = parseToolCalls(retryContent);
              
              if (retryToolCall && !retryToolCall.error) {
                // Continue with the tool call
                finalContent = retryContent;
                toolCall = retryToolCall;
                setMessages(prev => [...prev, { role: 'assistant', content: retryContent, mode }]);
                setStreamingContent('');
              } else {
                // Retry didn't produce a tool call either - show a message and end
                console.warn('[Agent] Retry also did not produce a tool call');
                setMessages(prev => [...prev, { 
                  role: 'assistant', 
                  content: retryContent + `\n\n⚠️ *The AI still didn't execute the tool. This might be a model limitation - try rephrasing your request or using a different model.*`,
                  mode 
                }]);
                setStreamingContent('');
                setThinkingContent('');
                streamingContentRef.current = '';
                thinkingContentRef.current = '';
                setIsLoading(false);
                setAgentStatus(null);
                return;
              }
            } else {
              // Retry request failed
              console.error('[Agent] Retry request failed:', retryResult.error);
              setStreamingContent('');
              setThinkingContent('');
              streamingContentRef.current = '';
              thinkingContentRef.current = '';
              setIsLoading(false);
              setAgentStatus(null);
              return;
            }
          } else {
            console.log('[Agent] Conditions not met for retry - describesPendingAction:', describesPendingAction, 'hasFileReference:', hasFileReference);
          }
        }
        
        console.log('[Agent] After !toolCall block, toolCall is now:', toolCall ? (toolCall.error ? 'error' : toolCall.tool) : 'null');
        
        // If there's a tool call, first save the assistant's initial response as a message
        if (toolCall && !toolCall.error) {
          setMessages(prev => [...prev, { role: 'assistant', content: finalContent, mode }]);
          setStreamingContent('');
        }
        
        while (toolCall && !toolCall.error && agentIterations < maxIterations) {
          agentIterations++;
          console.log(`[Agent] Tool call detected (iteration ${agentIterations}):`, toolCall);
          
          let toolResult;
          
          // For write_file and create_file, require user approval
          if (toolCall.tool === 'write_file' || toolCall.tool === 'create_file') {
            setAgentStatus({ step: agentIterations, action: `Waiting for approval...`, tool: toolCall.tool });
            
            // Show the pending approval message with unique ID
            const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const pendingMessage = {
              role: 'tool_pending',
              id: pendingId,
              tool: toolCall.tool,
              params: toolCall.params,
              iteration: agentIterations
            };
            setMessages(prev => [...prev, pendingMessage]);
            
            // Wait for user approval
            const approvalResult = await new Promise((resolve) => {
              pendingToolApprovalRef.current = resolve;
              setPendingToolApproval({ tool: toolCall.tool, params: toolCall.params, resolve });
            });
            
            setPendingToolApproval(null);
            pendingToolApprovalRef.current = null;
            
            // Remove the pending message by ID
            setMessages(prev => prev.filter(m => m.id !== pendingId));
            
            if (approvalResult.approved) {
              setAgentStatus({ step: agentIterations, action: `Running ${toolCall.tool}...`, tool: toolCall.tool });
              toolResult = await executeAgentTool(toolCall.tool, toolCall.params);
            } else {
              toolResult = `Edit declined by user: ${approvalResult.reason || 'No reason given'}`;
            }
          } else {
            // Execute the tool directly for read-only operations
            setAgentStatus({ step: agentIterations, action: `Running ${toolCall.tool}...`, tool: toolCall.tool });
            toolResult = await executeAgentTool(toolCall.tool, toolCall.params);
          }
          
          console.log(`[Agent] Tool result:`, toolResult.slice(0, 200));
          
          // Add tool execution as a separate message in the chat
          const toolMessage = {
            role: 'tool',
            tool: toolCall.tool,
            params: toolCall.params,
            result: toolResult,
            iteration: agentIterations
          };
          setMessages(prev => [...prev, toolMessage]);
          
          // Add tool result to conversation and continue
          conversationHistory.push({ role: 'user', content: `Tool result:\n${toolResult}\n\nContinue with your analysis.` });
          
          // Make another request with the tool result
          streamingContentRef.current = '';
          const nextRequestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          streamRequestRef.current = nextRequestId;
          setAgentStatus({ step: agentIterations, action: 'Thinking...' });
          
          const nextStreamResult = await ipcRenderer.invoke('ai-request-stream', provider, model,
            conversationHistory, config, { requestId: nextRequestId });
          
          if (!nextStreamResult.success) {
            // Add error message
            setMessages(prev => [...prev, { role: 'assistant', content: `Error continuing: ${nextStreamResult.error}`, mode }]);
            break;
          }
          
          // Wait for this stream to complete
          await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              if (!streamRequestRef.current) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
            setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
          });
          
          // Get the new response
          const newResponse = streamingContentRef.current || '';
          conversationHistory.push({ role: 'assistant', content: newResponse });
          
          // Check for more tool calls
          toolCall = parseToolCalls(newResponse);
          
          // Handle tool call parsing errors in subsequent iterations
          if (toolCall?.error) {
            console.error('[Agent] Tool call parse error in iteration:', toolCall.message);
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: newResponse + `\n\n⚠️ **Tool call parsing failed**: ${toolCall.message}`,
              mode 
            }]);
            setStreamingContent('');
            break;
          }
          
          // If there's another tool call, save this response as a message
          // Otherwise it will be saved after the loop
          if (toolCall && !toolCall.error) {
            setMessages(prev => [...prev, { role: 'assistant', content: newResponse, mode }]);
            setStreamingContent('');
          }
          
          // Update finalContent for the last iteration
          finalContent = newResponse;
        }
        
        if (agentIterations >= maxIterations) {
          setMessages(prev => [...prev, { role: 'assistant', content: '*[Agent stopped: maximum iterations reached]*', mode }]);
        }
        
        setAgentStatus(null);
        
        // If we processed tool calls, skip the normal message addition (already handled)
        if (agentIterations > 0 && !toolCall) {
          // Check if the AI's final message describes a pending action but didn't execute it
          const lastSentence = finalContent.slice(-300);
          const describesPendingAction = (
            /(?:let me|i'll|let's|i will|going to)\s+(?:now\s+)?(?:proceed\s+(?:with|to)\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /(?:let me|i'll|let's|i will|going to)\s+(?:\w+\s+)*?(?:to\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /(?:let me|i'll|let's|i will)\s+go\s+ahead\s+(?:with\s+|and\s+)?(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            /proceed(?:ing)?\s+(?:with|to)\s+(?:writ|updat|creat|modif|edit|read|list|search)/i.test(finalContent) ||
            // Additional patterns for common AI "about to do something" phrases
            /i(?:'ll| will) (?:now )?(?:make|do|perform|execute|apply|implement)/i.test(lastSentence) ||
            /let(?:'s| me) (?:now )?(?:make|do|perform|execute|apply|implement)/i.test(lastSentence) ||
            /proceeding (?:to|with)/i.test(lastSentence) ||
            // Ends with a statement about updating/modifying without the tool
            /(?:update|modify|change|edit|write to) (?:the )?(?:readme|file|code)/i.test(lastSentence)
          );
          const hasFileReference = /(?:readme|\.md|\.js|\.json|\.ts|\.py|\.txt|file|code)/i.test(finalContent);
          
          if (describesPendingAction && hasFileReference) {
            console.warn('[Agent] Final message described file operation but did not use tool format');
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: finalContent + `\n\n💡 *It looks like I described a file operation but didn't execute it. Let me try again with the proper tool call...*`,
              mode 
            }]);
            setStreamingContent('');
            
            // Make another request asking AI to actually use the tool
            const retryMessagesArray = [...conversationHistory, 
              { role: 'user', content: 'You described an action but did not use a tool. Please use the <tool> and <params> XML format to actually execute the operation now.' }
            ];
            
            streamingContentRef.current = '';
            const retryRequestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            streamRequestRef.current = retryRequestId;
            setAgentStatus({ step: agentIterations + 1, action: 'Executing tool call...' });
            
            const retryResult = await ipcRenderer.invoke('ai-request-stream', provider, model,
              retryMessagesArray, config, { requestId: retryRequestId });
            
            if (retryResult.success) {
              await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                  if (!streamRequestRef.current) { clearInterval(checkInterval); resolve(); }
                }, 100);
                setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
              });
              
              const retryContent = streamingContentRef.current || '';
              const retryToolCall = parseToolCalls(retryContent);
              
              if (retryToolCall && !retryToolCall.error) {
                // Execute the tool call
                setMessages(prev => [...prev, { role: 'assistant', content: retryContent, mode }]);
                setStreamingContent('');
                
                let toolResult;
                
                // For write_file and create_file, require user approval
                if (retryToolCall.tool === 'write_file' || retryToolCall.tool === 'create_file') {
                  setAgentStatus({ step: agentIterations + 1, action: `Waiting for approval...`, tool: retryToolCall.tool });
                  
                  // Show the pending approval message with unique ID
                  const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  const pendingMessage = {
                    role: 'tool_pending',
                    id: pendingId,
                    tool: retryToolCall.tool,
                    params: retryToolCall.params,
                    iteration: agentIterations + 1
                  };
                  setMessages(prev => [...prev, pendingMessage]);
                  
                  // Wait for user approval
                  const approvalResult = await new Promise((resolve) => {
                    pendingToolApprovalRef.current = resolve;
                    setPendingToolApproval({ tool: retryToolCall.tool, params: retryToolCall.params, resolve });
                  });
                  
                  setPendingToolApproval(null);
                  pendingToolApprovalRef.current = null;
                  
                  // Remove the pending message by ID
                  setMessages(prev => prev.filter(m => m.id !== pendingId));
                  
                  if (approvalResult.approved) {
                    setAgentStatus({ step: agentIterations + 1, action: `Running ${retryToolCall.tool}...`, tool: retryToolCall.tool });
                    toolResult = await executeAgentTool(retryToolCall.tool, retryToolCall.params);
                  } else {
                    toolResult = `Edit declined by user: ${approvalResult.reason || 'No reason given'}`;
                  }
                } else {
                  // Execute the tool directly for read-only operations
                  setAgentStatus({ step: agentIterations + 1, action: `Running ${retryToolCall.tool}...`, tool: retryToolCall.tool });
                  toolResult = await executeAgentTool(retryToolCall.tool, retryToolCall.params);
                }
                
                setMessages(prev => [...prev, { 
                  role: 'tool', 
                  tool: retryToolCall.tool, 
                  params: retryToolCall.params, 
                  result: toolResult,
                  iteration: agentIterations + 1
                }]);
                
                // Continue the agent loop with the tool result
                conversationHistory.push({ role: 'assistant', content: retryContent });
                conversationHistory.push({ role: 'user', content: `Tool result:\n${toolResult}` });
                
                // Get final response after tool execution
                streamingContentRef.current = '';
                const finalRequestId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                streamRequestRef.current = finalRequestId;
                setAgentStatus({ step: agentIterations + 2, action: 'Continuing...' });
                
                const finalResult = await ipcRenderer.invoke('ai-request-stream', provider, model,
                  conversationHistory, config, { requestId: finalRequestId });
                
                if (finalResult.success) {
                  await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                      if (!streamRequestRef.current) { clearInterval(checkInterval); resolve(); }
                    }, 100);
                    setTimeout(() => { clearInterval(checkInterval); resolve(); }, 60000);
                  });
                  
                  const finalResponse = streamingContentRef.current || '';
                  setMessages(prev => [...prev, { role: 'assistant', content: finalResponse, mode }]);
                }
                
                setStreamingContent('');
                setThinkingContent('');
                streamingContentRef.current = '';
                thinkingContentRef.current = '';
                setIsLoading(false);
                setAgentStatus(null);
                return;
              } else {
                // Retry didn't produce a tool call either
                console.warn('[Agent] Retry also did not produce a tool call');
                setMessages(prev => [...prev, { 
                  role: 'assistant', 
                  content: retryContent + `\n\n⚠️ *The AI still didn't execute the tool. This might be a model limitation - try rephrasing your request or using a different model.*`,
                  mode 
                }]);
                setStreamingContent('');
                setThinkingContent('');
                streamingContentRef.current = '';
                thinkingContentRef.current = '';
                setIsLoading(false);
                setAgentStatus(null);
                return;
              }
            }
          }
          
          // Only add the final response if there was no more tool call
          console.log('[Agent] Reached end of agent processing, agentIterations:', agentIterations, 'toolCall:', toolCall ? 'exists' : 'null');
          const shouldShowApply = isEditRequest || mode === 'refactor' || mode === 'generate';
          console.log('[Agent] Setting final message with showApply:', shouldShowApply);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: finalContent, 
            mode, 
            showApply: shouldShowApply,
            thinking: finalThinking
          }]);
          setStreamingContent('');
          setThinkingContent('');
          streamingContentRef.current = '';
          thinkingContentRef.current = '';
          setIsLoading(false);
          return; // Skip the normal message handling below
        }
      }
      
      // Mark message with showApply flag if it's an edit request or refactor/generate mode
      const shouldShowApply = isEditRequest || mode === 'refactor' || mode === 'generate';
      const newMessage = { 
        role: 'assistant', 
        content: finalContent, 
        mode, 
        showApply: shouldShowApply,
        thinking: finalThinking
      };
      setMessages(prev => [...prev, newMessage]);
      setStreamingContent('');
      setThinkingContent('');
      streamingContentRef.current = '';
      thinkingContentRef.current = '';
      
      // Check if response contains code blocks that need approval
      if (shouldShowApply) {
        const codeBlocks = (finalContent || '').match(/```[\w]*\n[\s\S]*?```/g);
        if (codeBlocks && codeBlocks.length > 0) {
          setPendingApproval({ messageIndex: messages.length + 1 }); // +1 for user message + current assistant
        }
      }
    } catch (error) {
      const duration = Date.now() - requestStartTime;
      console.error(`[AI Panel] Request failed - Duration: ${duration}ms, Error: ${error.message}`);
      const errorMessage = error.message.includes('timed out') 
        ? `Request timed out. The ${provider} API took too long to respond. Please try again.`
        : `Error: ${error.message}`;
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage, mode }]);
      setStreamingContent('');
      setThinkingContent('');
      streamingContentRef.current = '';
      thinkingContentRef.current = '';
    }
    setIsLoading(false);
    setAgentStatus(null);
  }, [input, mode, context, settings, messages, provider, selectedModel, attachedFiles, setMessages, codebaseIndex, workspacePath, executeAgentTool]);

  // Stop streaming request
  const stopStream = useCallback(async () => {
    const requestId = streamRequestRef.current;
    if (requestId) {
      console.log(`[AIPanel] Stopping stream: ${requestId}`);
      await ipcRenderer.invoke('ai-stream-stop', requestId);
      streamRequestRef.current = null;
      setIsLoading(false);
      setAgentStatus(null);
      // Keep whatever content we received so far
      if (streamingContentRef.current) {
        const partialContent = streamingContentRef.current + '\n\n*[Response stopped by user]*';
        setMessages(prev => [...prev, { role: 'assistant', content: partialContent, mode }]);
      }
      setStreamingContent('');
      setThinkingContent('');
      streamingContentRef.current = '';
      thinkingContentRef.current = '';
    }
  }, [mode, setMessages]);

  // Tab management functions
  const createNewChat = useCallback(() => {
    const newTab = {
      id: generateId(),
      name: `Chat ${chatTabs.length + 1}`,
      messages: [],
      provider,
      model: selectedModel,
      mode,
      createdAt: Date.now()
    };
    setChatTabs(prev => {
      const updated = [...prev, newTab];
      saveChatsToProject(updated);
      return updated;
    });
    setActiveTabId(newTab.id);
    setPendingApproval(null);
  }, [chatTabs.length, provider, selectedModel, mode, workspacePath]);

  const switchTab = useCallback((tabId) => {
    const tab = chatTabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      setProvider(tab.provider || 'claude');
      setSelectedModel(tab.model || '');
      setMode(tab.mode || 'ask');
      setPendingApproval(null);
    }
  }, [chatTabs]);

  const closeTab = useCallback((tabId, e) => {
    e?.stopPropagation();
    setChatTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) {
        const newTab = { id: generateId(), name: 'Chat 1', messages: [], provider: 'claude', model: '', mode: 'ask', createdAt: Date.now() };
        saveChatsToProject([newTab]);
        setActiveTabId(newTab.id);
        return [newTab];
      }
      if (activeTabId === tabId) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }
      saveChatsToProject(filtered);
      return filtered;
    });
    setPendingApproval(null);
  }, [activeTabId, workspacePath]);

  const renameTab = useCallback((tabId, newName) => {
    setChatTabs(prev => {
      const updated = prev.map(t => t.id === tabId ? { ...t, name: newName } : t);
      saveChatsToProject(updated);
      return updated;
    });
  }, [workspacePath]);

  const loadChat = useCallback((chat) => {
    setActiveTabId(chat.id);
    setProvider(chat.provider || 'claude');
    setSelectedModel(chat.model || '');
    setMode(chat.mode || 'chat');
    setShowHistory(false);
    setPendingApproval(null);
  }, []);

  const deleteChat = useCallback((chatId, e) => {
    e?.stopPropagation();
    closeTab(chatId);
  }, [closeTab]);

  // Handle approval/decline for pending code
  const handlePendingApproval = useCallback((approved) => {
    setPendingApproval(null);
  }, []);

  // Handle approval/decline for pending tool calls (write_file)
  const handleToolApproval = useCallback((approved, reason = '') => {
    console.log(`[Agent] Tool approval: ${approved ? 'approved' : 'declined'}`, reason);
    if (pendingToolApprovalRef.current) {
      pendingToolApprovalRef.current({ approved, reason });
    }
  }, []);

  const addFileToContext = useCallback(async (file) => {
    if (!attachedFiles.find(f => f.path === file.path)) {
      // If file doesn't have content, load it
      if (!file.content) {
        const result = await ipcRenderer.invoke('read-file', file.path);
        if (result.success) {
          file.content = result.content;
          file.language = file.name.split('.').pop() || '';
        }
      }
      setAttachedFiles(prev => [...prev, file]);
    }
    setShowFileSearch(false);
    setFileSearchQuery('');
  }, [attachedFiles]);

  const removeFileFromContext = useCallback((filePath) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== filePath));
  }, []);

  // Load project files for search
  const loadProjectFiles = useCallback(async () => {
    if (!workspacePath || loadingFiles) return;
    setLoadingFiles(true);
    try {
      const result = await ipcRenderer.invoke('list-files-recursive', workspacePath);
      if (result.success) {
        setProjectFiles(result.files.filter(f => 
          !f.includes('node_modules') && 
          !f.includes('.git') && 
          !f.includes('.IDEC') &&
          !f.includes('dist/') &&
          !f.includes('build/')
        ));
      }
    } catch (e) {
      console.error('Failed to load project files:', e);
    }
    setLoadingFiles(false);
  }, [workspacePath, loadingFiles]);

  // Filter files based on search query
  const filteredFiles = projectFiles.filter(f => {
    const fileName = f.split('/').pop().toLowerCase();
    const query = fileSearchQuery.toLowerCase();
    return fileName.includes(query) && !attachedFiles.find(af => af.path === f);
  }).slice(0, 20);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !pendingApproval) { e.preventDefault(); sendMessage(); }
  };

  // Context menu handlers for copy/paste
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopy = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      clipboard.writeText(selection.toString());
    }
    setContextMenu(null);
  }, []);

  const handlePaste = useCallback(async () => {
    const text = clipboard.readText();
    if (text && inputRef.current) {
      const inputEl = inputRef.current;
      const start = inputEl.selectionStart || 0;
      const end = inputEl.selectionEnd || 0;
      const currentValue = input;
      const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
      setInput(newValue);
      // Set cursor position after paste
      setTimeout(() => {
        inputEl.selectionStart = inputEl.selectionEnd = start + text.length;
        inputEl.focus();
      }, 0);
    }
    setContextMenu(null);
  }, [input]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const currentProvider = providers.find(p => p.id === provider);

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--card)',
      borderLeft: '1px solid var(--border)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
          {isConfigured() && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 10, fontWeight: 600 }}>
              Connected
            </motion.span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton onClick={() => setShowHistory(!showHistory)} icon={<History size={14} />} label="History" />
          <IconButton onClick={createNewChat} icon={<Plus size={14} />} label="New Chat" />
          <IconButton onClick={() => setMessages([])} icon={<Trash2 size={14} />} label="Clear" />
        </div>
      </div>

      {/* Chat Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        minHeight: 36
      }}>
        {chatTabs.map(tab => (
          <motion.div
            key={tab.id}
            whileHover={{ backgroundColor: activeTabId === tab.id ? 'var(--primary)' : 'var(--muted)' }}
            onClick={() => switchTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: activeTabId === tab.id ? 600 : 400,
              background: activeTabId === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTabId === tab.id ? 'white' : 'var(--muted-foreground)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <MessageSquare size={12} />
            <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.name}</span>
            {chatTabs.length > 1 && (
              <X 
                size={12} 
                onClick={(e) => closeTab(tab.id, e)}
                style={{ opacity: 0.6, cursor: 'pointer' }}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              borderBottom: '1px solid var(--border)',
              background: 'var(--secondary)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '8px 12px', maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                Chat History
              </div>
              {chatTabs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 0' }}>
                  No chats yet
                </div>
              ) : (
                chatTabs.map(chat => (
                  <motion.div
                    key={chat.id}
                    whileHover={{ backgroundColor: 'var(--muted)' }}
                    onClick={() => loadChat(chat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginBottom: 4,
                      background: activeTabId === chat.id ? 'var(--muted)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MessageSquare size={14} style={{ color: 'var(--muted-foreground)' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{chat.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                          {chat.messages.length} messages • {new Date(chat.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <X 
                      size={14} 
                      onClick={(e) => deleteChat(chat.id, e)}
                      style={{ color: 'var(--muted-foreground)', cursor: 'pointer' }}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Approval Overlay */}
      {pendingApproval && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '12px',
            background: 'rgba(234, 179, 8, 0.1)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#eab308' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>Waiting for code approval before continuing...</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePendingApproval(false)}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid rgba(234, 179, 8, 0.5)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              color: '#eab308'
            }}
          >
            Skip Approval
          </motion.button>
        </motion.div>
      )}

      {/* Provider & Model Selector */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        {/* Provider Dropdown */}
        <div style={{ position: 'relative', flex: 1 }}>
          <motion.button
            whileHover={{ backgroundColor: 'var(--muted)' }}
            onClick={() => { setShowProviderMenu(!showProviderMenu); setShowModelMenu(false); }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--foreground)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{currentProvider?.icon}</span>
              <span>{currentProvider?.name}</span>
            </span>
            <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
          </motion.button>
          
          <AnimatePresence>
            {showProviderMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  zIndex: 20,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                }}
              >
                {providers.map(p => (
                  <motion.button
                    key={p.id}
                    whileHover={{ backgroundColor: 'var(--muted)' }}
                    onClick={() => { setProvider(p.id); setShowProviderMenu(false); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: provider === p.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: provider === p.id ? 'var(--primary)' : 'var(--foreground)'
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Model Dropdown */}
        <div style={{ position: 'relative', flex: 2, minWidth: 180 }}>
          <motion.button
            whileHover={{ backgroundColor: 'var(--muted)' }}
            onClick={() => { setShowModelMenu(!showModelMenu); setShowProviderMenu(false); }}
            disabled={loadingModels}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--foreground)',
              opacity: loadingModels ? 0.6 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
              {isThinkingModel(selectedModel) && (
                <Brain size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
              )}
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap'
              }}>
                {loadingModels ? 'Loading...' : (selectedModel || 'Select model')}
              </span>
            </div>
            {loadingModels ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={14} style={{ color: 'var(--muted-foreground)' }} />
              </motion.div>
            ) : (
              <ChevronDown size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            )}
          </motion.button>
          
          <AnimatePresence>
            {showModelMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  minWidth: 280,
                  marginTop: 4,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  zIndex: 20,
                  maxHeight: 300,
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                }}
              >
                {models.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                    No models available
                  </div>
                ) : (
                  models.map(m => (
                    <motion.button
                      key={m}
                      whileHover={{ backgroundColor: 'var(--muted)' }}
                      onClick={() => { setSelectedModel(m); setShowModelMenu(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        background: selectedModel === m ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: selectedModel === m ? 'var(--primary)' : 'var(--foreground)',
                        textAlign: 'left'
                      }}
                    >
                      {isThinkingModel(m) && (
                        <Brain size={14} style={{ color: '#a78bfa', flexShrink: 0 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                    </motion.button>
                  ))
                )}
                
                {provider === 'ollama' && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
                    <motion.button
                      whileHover={{ backgroundColor: 'var(--muted)' }}
                      onClick={() => {
                        const modelName = prompt('Enter Ollama model name to pull (e.g., llama3.2, mistral, codellama):');
                        if (modelName) pullOllamaModel(modelName);
                        setShowModelMenu(false);
                      }}
                      disabled={pullingModel}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 6,
                        cursor: pullingModel ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        color: 'var(--primary)',
                        opacity: pullingModel ? 0.6 : 1
                      }}
                    >
                      {pullingModel ? (
                        <>
                          <Loader2 size={12} /> Pulling...
                        </>
                      ) : (
                        <>
                          <Download size={12} /> Pull New Model
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Refresh Button */}
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'var(--muted)' }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchModels}
          disabled={loadingModels}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--muted-foreground)'
          }}
        >
          <motion.div animate={loadingModels ? { rotate: 360 } : {}} 
            transition={{ duration: 1, repeat: loadingModels ? Infinity : 0, ease: 'linear' }}>
            <RefreshCw size={14} />
          </motion.div>
        </motion.button>
      </div>

      {/* Agent Status */}
      {agentStatus && (
        <div style={{ 
          padding: '8px 16px', 
          background: 'rgba(139, 92, 246, 0.1)', 
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Bot size={14} style={{ color: '#8b5cf6' }} />
          </motion.div>
          <span style={{ fontSize: 12, color: '#8b5cf6' }}>
            Step {agentStatus.step}: {agentStatus.action}
          </span>
        </div>
      )}

      {/* Messages */}
      <div 
        style={{ flex: 1, overflow: 'auto', padding: 16 }}
        onContextMenu={handleContextMenu}
      >
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: 32 }}>
            <Bot size={40} style={{ color: 'var(--muted-foreground)', opacity: 0.5, marginBottom: 16 }} />
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 8 }}>How can I help?</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.7 }}>
              {isConfigured() ? `Using ${currentProvider?.name}` : 'Configure a provider in Settings'}
            </p>
          </motion.div>
        )}
        
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ 
                display: 'flex', 
                gap: 12, 
                marginBottom: 16, 
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              {msg.role !== 'system' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : (msg.role === 'tool' || msg.role === 'tool_pending') ? 'rgba(139,92,246,0.15)' : 'var(--muted)', flexShrink: 0
                }}>
                  {msg.role === 'user' ? '👤' : msg.role === 'tool' ? '⚡' : msg.role === 'tool_pending' ? '⏳' : <Bot size={16} style={{ color: 'var(--primary)' }} />}
                </div>
              )}
              <div style={{ 
                flex: 1,
                maxWidth: msg.role === 'user' ? '85%' : '100%',
                padding: msg.role === 'tool' || msg.role === 'tool_pending' ? 0 : '12px 16px',
                borderRadius: 12,
                background: msg.role === 'user' 
                  ? 'rgba(59,130,246,0.1)' 
                  : msg.role === 'system' 
                    ? 'var(--muted)' 
                    : msg.role === 'tool' || msg.role === 'tool_pending'
                      ? 'transparent'
                      : 'rgba(255,255,255,0.03)',
                border: msg.role === 'user' 
                  ? '1px solid rgba(59,130,246,0.2)' 
                  : msg.role === 'tool' || msg.role === 'tool_pending'
                    ? 'none'
                    : '1px solid var(--border)',
                fontSize: 13, 
                lineHeight: 1.6, 
                color: msg.role === 'system' ? 'var(--muted-foreground)' : '#e2e8f0',
                fontStyle: msg.role === 'system' ? 'italic' : 'normal'
              }}>
                {msg.role === 'system' ? msg.content : 
                 msg.role === 'tool_pending' ? (
                   <ToolPendingCard msg={msg} onApprove={() => handleToolApproval(true)} onDecline={() => handleToolApproval(false, 'User declined')} />
                 ) :
                 msg.role === 'tool' ? (
                   <ToolResultCard msg={msg} onInsertCode={onInsertCode} />
                 ) : <MessageContent content={msg.content} onInsertCode={onInsertCode} showApplyButtons={msg.showApply || msg.mode === 'refactor' || msg.mode === 'generate'} onApprovalChange={() => setPendingApproval(null)} />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ 
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)'
            }}>
              {thinkingContent && (
                <div style={{ 
                  marginBottom: 12, 
                  padding: '8px 12px', 
                  background: 'rgba(167,139,250,0.1)', 
                  borderRadius: 8,
                  border: '1px solid rgba(167,139,250,0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Brain size={14} style={{ color: '#a78bfa' }} />
                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>Thinking...</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>
                    {thinkingContent.slice(-500)}
                  </div>
                </div>
              )}
              {streamingContent ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0' }}>
                  <MessageContent content={streamingContent} onInsertCode={onInsertCode} showApplyButtons={false} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} style={{ width: 6, height: 6, background: 'var(--primary)', borderRadius: '50%' }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Indicator & File Attachment */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--secondary)' }}>
        {/* Codebase index status */}
        {indexingStatus && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: 6, 
            padding: '4px 8px',
            background: indexingStatus === 'indexing' ? 'rgba(234, 179, 8, 0.1)' : 
                        indexingStatus === 'done' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: 6,
            marginBottom: 6,
            fontSize: 11,
            color: indexingStatus === 'indexing' ? '#eab308' : 
                   indexingStatus === 'done' ? '#22c55e' : '#ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {indexingStatus === 'indexing' ? <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : 
               indexingStatus === 'done' ? <CheckCircle size={12} /> : <X size={12} />}
              <span>
                {indexingStatus === 'indexing' ? 'Indexing codebase...' : 
                 indexingStatus === 'done' ? 'Codebase indexed' : 'Indexing failed'}
              </span>
            </div>
            {indexingStatus !== 'indexing' && onReindex && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onReindex}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  borderRadius: 4
                }}
              >
                <RefreshCw size={10} />
              </motion.button>
            )}
          </div>
        )}
        
        {/* Current file context */}
        {context.fileName && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '4px 8px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 6,
            marginBottom: attachedFiles.length > 0 ? 6 : 0,
            fontSize: 11,
            color: 'var(--primary)'
          }}>
            <FileCode size={12} />
            <span>Context: {context.fileName}</span>
          </div>
        )}
        
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {attachedFiles.map((file) => (
              <div
                key={file.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: 'var(--muted)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--foreground)'
                }}
              >
                <File size={10} />
                <span>{file.name || file.path.split('/').pop()}</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeFileFromContext(file.path)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--muted-foreground)'
                  }}
                >
                  <X size={10} />
                </motion.button>
              </div>
            ))}
          </div>
        )}

        {/* File search */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowFileSearch(!showFileSearch);
              if (!showFileSearch && projectFiles.length === 0) {
                loadProjectFiles();
              }
              setTimeout(() => fileSearchRef.current?.focus(), 100);
            }}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              textAlign: 'left'
            }}
          >
            <Search size={12} />
            <span>Add files to context...</span>
          </motion.button>
          
          {showFileSearch && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 4,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxHeight: 300,
              overflow: 'hidden',
              zIndex: 100
            }}>
              <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                <input
                  ref={fileSearchRef}
                  type="text"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  placeholder="Search files by name..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--foreground)',
                    outline: 'none'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowFileSearch(false);
                      setFileSearchQuery('');
                    }
                  }}
                />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {loadingFiles ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ marginLeft: 8 }}>Loading files...</span>
                  </div>
                ) : filteredFiles.length > 0 ? (
                  filteredFiles.map((filePath) => {
                    const fileName = filePath.split('/').pop();
                    const relativePath = workspacePath ? filePath.replace(workspacePath + '/', '') : filePath;
                    return (
                      <motion.div
                        key={filePath}
                        whileHover={{ background: 'var(--muted)' }}
                        onClick={() => addFileToContext({ path: filePath, name: fileName })}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderBottom: '1px solid var(--border)'
                        }}
                      >
                        <File size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{fileName}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{relativePath}</div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : fileSearchQuery ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                    No files found matching "{fileSearchQuery}"
                  </div>
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                    Type to search for files
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        {/* Mode dropdown and input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mode dropdown */}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{
              padding: '8px 28px 8px 10px',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              minWidth: 90,
              height: 36
            }}
          >
            {modes.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          
          {/* Text input */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingApproval ? "Accept or decline changes..." : modes.find(m => m.id === mode)?.description || "Ask anything..."}
              className="input"
              style={{ 
                paddingRight: 44, 
                opacity: pendingApproval ? 0.6 : 1, 
                height: 36,
                width: '100%'
              }}
              disabled={pendingApproval}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => isLoading ? stopStream() : sendMessage()}
              disabled={pendingApproval || (!isLoading && !input.trim() && mode === 'ask')}
              aria-label={isLoading ? "Stop" : "Send"}
              style={{
                position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%)',
                width: 28, height: 28,
                background: isLoading ? 'var(--error, #ef4444)' : 'var(--primary)', 
                color: 'white', border: 'none', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                opacity: pendingApproval || (!isLoading && !input.trim() && mode === 'ask') ? 0.5 : 1
              }}
            >
              {isLoading ? <Square size={10} fill="white" /> : <Send size={12} />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Context Menu for Copy/Paste */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 4,
              minWidth: 140,
              zIndex: 1000,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              onClick={handleCopy}
              whileHover={{ backgroundColor: 'var(--muted)' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: 6, cursor: 'pointer', fontSize: 13,
                color: 'var(--foreground)', textAlign: 'left'
              }}
            >
              <Copy size={14} /> Copy
            </motion.button>
            <motion.button
              onClick={handlePaste}
              whileHover={{ backgroundColor: 'var(--muted)' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', background: 'transparent', border: 'none',
                borderRadius: 6, cursor: 'pointer', fontSize: 13,
                color: 'var(--foreground)', textAlign: 'left'
              }}
            >
              <Clipboard size={14} /> Paste
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Parse inline markdown (bold, italic, code, links)
function parseInlineMarkdown(text) {
  if (!text) return null;
  
  const elements = [];
  let keyIndex = 0;
  
  // Process text segment by segment
  // Order matters: process more specific patterns first
  const processSegment = (segment) => {
    if (!segment) return null;
    
    // Tool calls: <tool>name</tool><params>{...}</params>
    const toolMatch = segment.match(/^(.*?)<tool>([^<]+)<\/tool>\s*<params>([^<]+)<\/params>(.*)$/s);
    if (toolMatch) {
      const [, before, tool, params, after] = toolMatch;
      return (
        <>
          {processSegment(before)}
          <div key={keyIndex++} style={{ 
            background: 'rgba(139,92,246,0.1)', 
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 8, 
            padding: '8px 12px', 
            margin: '8px 0',
            fontSize: 12
          }}>
            <div style={{ color: '#a78bfa', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🔧</span> Tool: {tool}
            </div>
            <code style={{ color: '#94a3b8', fontSize: 11 }}>{params}</code>
          </div>
          {processSegment(after)}
        </>
      );
    }
    
    // Check for inline code first (most specific for {{CODE:...}} issue)
    const codeMatch = segment.match(/^(.*?)`([^`]+)`(.*)$/s);
    if (codeMatch) {
      const [, before, code, after] = codeMatch;
      return (
        <>
          {processSegment(before)}
          <code key={keyIndex++} style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em' }}>{code}</code>
          {processSegment(after)}
        </>
      );
    }
    
    // Bold **text**
    const boldMatch = segment.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s);
    if (boldMatch) {
      const [, before, bold, after] = boldMatch;
      return (
        <>
          {processSegment(before)}
          <strong key={keyIndex++} style={{ color: '#e2e8f0', fontWeight: 600 }}>{bold}</strong>
          {processSegment(after)}
        </>
      );
    }
    
    // Italic *text* (but not **)
    const italicMatch = segment.match(/^(.*?)(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)(.*)$/s);
    if (italicMatch) {
      const [, before, italic, after] = italicMatch;
      return (
        <>
          {processSegment(before)}
          <em key={keyIndex++} style={{ color: '#cbd5e1' }}>{italic}</em>
          {processSegment(after)}
        </>
      );
    }
    
    // Links [text](url)
    const linkMatch = segment.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/s);
    if (linkMatch) {
      const [, before, linkText, url, after] = linkMatch;
      return (
        <>
          {processSegment(before)}
          <a key={keyIndex++} href={url} style={{ color: '#60a5fa', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{linkText}</a>
          {processSegment(after)}
        </>
      );
    }
    
    // No patterns found, return plain text
    return segment;
  };
  
  return processSegment(text);
}

// Render a text block with markdown parsing
function MarkdownText({ text }) {
  if (!text || !text.trim()) return null;
  
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;
  let keyIdx = 0;
  
  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={keyIdx++} style={{ margin: '8px 0', paddingLeft: 24, color: '#e2e8f0' }}>
          {listItems.map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{parseInlineMarkdown(item)}</li>)}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={keyIdx++} style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '12px 0 6px' }}>{parseInlineMarkdown(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={keyIdx++} style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: '14px 0 8px' }}>{parseInlineMarkdown(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={keyIdx++} style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: '16px 0 10px' }}>{parseInlineMarkdown(line.slice(2))}</h2>);
      continue;
    }
    
    // Unordered list
    if (line.match(/^[\-\*]\s+/)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(line.replace(/^[\-\*]\s+/, ''));
      continue;
    }
    
    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s+/, ''));
      continue;
    }
    
    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={keyIdx++} style={{ 
          borderLeft: '3px solid #8b5cf6', 
          paddingLeft: 12, 
          margin: '8px 0', 
          color: '#cbd5e1',
          fontStyle: 'italic'
        }}>
          {parseInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      continue;
    }
    
    // Horizontal rule
    if (line.match(/^[\-\*\_]{3,}$/)) {
      flushList();
      elements.push(<hr key={keyIdx++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
      continue;
    }
    
    // Empty line
    if (!line.trim()) {
      flushList();
      continue;
    }
    
    // Regular paragraph
    flushList();
    elements.push(
      <p key={keyIdx++} style={{ margin: '6px 0', color: '#e2e8f0', lineHeight: 1.7 }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  }
  
  flushList();
  return <div style={{ userSelect: 'text' }}>{elements}</div>;
}

// Inner component for rendering non-tool content (code blocks, markdown)
function MessageContentInner({ content, onInsertCode, showApplyButtons = false, onApprovalChange }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [codeStatus, setCodeStatus] = useState({});
  
  if (!content) return null;
  
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  
  const handleCopy = (code, index) => {
    try {
      clipboard.writeText(code);
    } catch (e) {
      // Fallback to navigator.clipboard if electron clipboard not available
      navigator.clipboard?.writeText(code);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleApprove = (code, index) => {
    onInsertCode(code);
    setCodeStatus(prev => ({ ...prev, [index]: 'approved' }));
    onApprovalChange?.('approved', index);
  };

  const handleDecline = (index) => {
    setCodeStatus(prev => ({ ...prev, [index]: 'declined' }));
    onApprovalChange?.('declined', index);
  };
  
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          if (match) {
            const [, lang, code] = match;
            const status = codeStatus[idx];
            const isHandled = status === 'approved' || status === 'declined';
            
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                style={{ 
                  borderRadius: 8, 
                  border: status === 'approved' ? '1px solid rgba(34,197,94,0.5)' : 
                          status === 'declined' ? '1px solid rgba(239,68,68,0.5)' : 
                          '1px solid var(--border)', 
                  overflow: 'hidden', 
                  margin: '12px 0',
                  opacity: status === 'declined' ? 0.6 : 1
                }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {lang || 'code'}
                    {status === 'approved' && (
                      <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Applied
                      </span>
                    )}
                    {status === 'declined' && (
                      <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <X size={12} /> Declined
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <SmallButton onClick={() => handleCopy(code, idx)}
                      icon={copiedIndex === idx ? <Check size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />} />
                  </div>
                </div>
                <pre style={{ padding: 12, fontSize: 12, overflow: 'auto', margin: 0, background: 'var(--background)', color: '#e2e8f0' }}>
                  <code>{code}</code>
                </pre>
                
                {/* Approve/Decline Buttons */}
                {showApplyButtons && !isHandled && (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderTop: '1px solid var(--border)'
                  }}>
                    <motion.button
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(34,197,94,0.2)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleApprove(code, idx)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#22c55e'
                      }}
                    >
                      <CheckCircle size={14} />
                      Apply Changes
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(239,68,68,0.2)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDecline(idx)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#ef4444'
                      }}
                    >
                      <X size={14} />
                      Decline
                    </motion.button>
                  </div>
                )}
              </motion.div>
            );
          }
        }
        return part.trim() ? <MarkdownText key={idx} text={part} /> : null;
      })}
    </>
  );
}

function MessageContent({ content, onInsertCode, showApplyButtons = false, onApprovalChange }) {
  if (!content) return null;
  
  // Parse tool calls from content for nice display during streaming
  const renderToolCallIndicator = (toolName, paramsPreview, isComplete) => (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: '12px 0',
        padding: '12px 16px',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <motion.div
        animate={!isComplete ? { rotate: 360 } : {}}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{ flexShrink: 0 }}
      >
        <span style={{ fontSize: 16 }}>🔧</span>
      </motion.div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 4 }}>
          {isComplete ? 'Tool Call' : 'Calling Tool'}: {toolName}
        </div>
        {paramsPreview && (
          <div style={{ 
            fontSize: 11, 
            color: 'var(--muted-foreground)', 
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {paramsPreview}
          </div>
        )}
      </div>
    </motion.div>
  );

  // Check for tool call patterns and split content around them
  const toolCallPattern = /<tool>\s*([^<]*?)(?:\s*<\/tool>\s*<params>\s*([\s\S]*?)(?:<\/params>)?|<\/tool>|$)/;
  const hasToolCall = toolCallPattern.test(content);
  
  if (hasToolCall) {
    // Split content into parts: before tool, tool call indicator, after tool
    const fullPattern = /(<tool>[\s\S]*?(?:<\/params>|$))/;
    const splitParts = content.split(fullPattern);
    
    return (
      <div style={{ color: '#e2e8f0', userSelect: 'text', cursor: 'text' }}>
        {splitParts.map((part, idx) => {
          if (part.startsWith('<tool>')) {
            // Parse the tool call
            const match = part.match(/<tool>\s*([^<]*?)(?:\s*<\/tool>\s*<params>\s*([\s\S]*?)(?:<\/params>)?|<\/tool>|$)/);
            if (match) {
              const toolName = match[1]?.trim() || 'unknown';
              const params = match[2]?.trim();
              const isComplete = part.includes('</params>');
              const paramsPreview = params ? (params.length > 100 ? params.slice(0, 100) + '...' : params) : null;
              return <React.Fragment key={idx}>{renderToolCallIndicator(toolName, paramsPreview, isComplete)}</React.Fragment>;
            }
          }
          // Render non-tool content normally
          if (part.trim()) {
            return <MessageContentInner key={idx} content={part} onInsertCode={onInsertCode} showApplyButtons={showApplyButtons} onApprovalChange={onApprovalChange} />;
          }
          return null;
        })}
      </div>
    );
  }
  
  // No tool calls - delegate to inner component
  return (
    <div style={{ color: '#e2e8f0', userSelect: 'text', cursor: 'text' }}>
      <MessageContentInner content={content} onInsertCode={onInsertCode} showApplyButtons={showApplyButtons} onApprovalChange={onApprovalChange} />
    </div>
  );
}

function IconButton({ onClick, icon, label }) {
  return (
    <motion.button onClick={onClick} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
      aria-label={label}
      style={{ width: 28, height: 28, background: 'transparent', border: 'none', borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
      {icon}
    </motion.button>
  );
}

function SmallButton({ onClick, icon }) {
  return (
    <motion.button onClick={onClick} whileHover={{ backgroundColor: 'var(--muted)' }} whileTap={{ scale: 0.95 }}
      style={{ width: 24, height: 24, background: 'transparent', border: 'none', borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
      {icon}
    </motion.button>
  );
}

export default AIPanel;
