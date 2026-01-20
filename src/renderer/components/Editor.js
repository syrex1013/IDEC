import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Sparkles, Zap, Loader2 } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { themes, createMonacoTheme } from '../lib/themes';

const { ipcRenderer } = window.require('electron');

// Cache for fetched schemas
const schemaCache = new Map();

// Debounce helper
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

// Fetch and register JSON schema for a file
async function fetchAndRegisterSchema(monaco, schemaUrl, fileUri) {
  if (!schemaUrl || !schemaUrl.startsWith('http')) return;
  
  try {
    // Check cache first
    let schemaContent = schemaCache.get(schemaUrl);
    
    if (!schemaContent) {
      console.log('[Editor] Fetching JSON schema:', schemaUrl);
      const result = await ipcRenderer.invoke('fetch-json-schema', schemaUrl);
      if (result.success) {
        schemaContent = JSON.parse(result.schema);
        schemaCache.set(schemaUrl, schemaContent);
        console.log('[Editor] Schema cached:', schemaUrl);
      } else {
        console.warn('[Editor] Failed to fetch schema:', schemaUrl, result.error);
        return;
      }
    }
    
    // Get current diagnostics options
    const currentOptions = monaco.languages.json.jsonDefaults.diagnosticsOptions || {};
    const existingSchemas = currentOptions.schemas || [];
    
    // Check if this schema is already registered for this file
    const alreadyRegistered = existingSchemas.some(
      s => s.uri === schemaUrl && s.fileMatch?.includes(fileUri)
    );
    
    if (!alreadyRegistered) {
      // Add schema configuration
      const newSchemas = [
        ...existingSchemas.filter(s => s.uri !== schemaUrl),
        {
          uri: schemaUrl,
          fileMatch: [fileUri, `**/components.json`], // Match specific file and pattern
          schema: schemaContent
        }
      ];
      
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        ...currentOptions,
        validate: true,
        schemas: newSchemas,
        enableSchemaRequest: false, // We handle it ourselves
      });
      
      console.log('[Editor] Registered schema for:', fileUri);
    }
  } catch (error) {
    console.error('[Editor] Error registering schema:', error);
  }
}

function Editor({ openFiles, activeFile, loadingFile, onFileSelect, onFileChange, onFileClose, onFileSave, settings, onProblemsChange }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const completionProviderRef = useRef(null);
  const [isGeneratingCompletion, setIsGeneratingCompletion] = useState(false);
  
  const editorSettings = settings?.editor || {};
  const currentTheme = settings?.theme || 'idec-dark';
  const aiCompletionEnabled = editorSettings.aiInlineCompletion !== false;

  // AI Inline completion provider
  const registerAICompletionProvider = useCallback((monaco) => {
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
      completionProviderRef.current = null;
    }
    
    if (!aiCompletionEnabled) return;
    
    const provider = {
      provideInlineCompletions: async (model, position, context, token) => {
        // Don't trigger if already generating or if explicitly dismissed
        if (isGeneratingCompletion || context.triggerKind === 0) {
          return { items: [], dispose: () => {} };
        }
        
        // Get current line and check if we should trigger
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        
        // Don't trigger on empty lines or just whitespace
        if (!textBeforeCursor.trim()) {
          return { items: [], dispose: () => {} };
        }
        
        // Don't trigger in middle of words
        const charAfter = lineContent.charAt(position.column - 1);
        if (charAfter && /\w/.test(charAfter)) {
          return { items: [], dispose: () => {} };
        }
        
        try {
          setIsGeneratingCompletion(true);
          
          // Get surrounding context
          const startLine = Math.max(1, position.lineNumber - 20);
          const endLine = Math.min(model.getLineCount(), position.lineNumber + 5);
          const prefix = model.getValueInRange({
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });
          const suffix = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine)
          });
          
          const language = model.getLanguageId();
          const fileName = activeFile?.name || 'unknown';
          
          // Call AI for completion
          const result = await ipcRenderer.invoke('ai-inline-completion', {
            prefix,
            suffix,
            language,
            fileName
          });
          
          if (token.isCancellationRequested || !result.success || !result.completion) {
            return { items: [], dispose: () => {} };
          }
          
          return {
            items: [{
              insertText: result.completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            }],
            dispose: () => {}
          };
        } catch (error) {
          console.error('[Editor] AI completion error:', error);
          return { items: [], dispose: () => {} };
        } finally {
          setIsGeneratingCompletion(false);
        }
      },
      freeInlineCompletions: (completions) => {
        // Clean up completions - no-op as dispose is called separately
      },
      disposeInlineCompletions: (completions) => {
        // Clean up completions - no-op since items contain dispose functions
      },
      handleItemDidShow: () => {},
      handlePartialAccept: () => {},
      // Required groupId for some Monaco versions
      groupId: 'ai-inline-completion'
    };
    
    completionProviderRef.current = monaco.languages.registerInlineCompletionsProvider('*', provider);
  }, [aiCompletionEnabled, activeFile?.name, isGeneratingCompletion]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Register all themes
    Object.values(themes).forEach(theme => {
      monaco.editor.defineTheme(theme.id, createMonacoTheme(theme));
    });
    
    monaco.editor.setTheme(currentTheme);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onFileSave);
    
    // Configure TypeScript compiler options to be lenient about external types
    const tsDefaults = monaco.languages.typescript?.typescriptDefaults;
    const jsDefaults = monaco.languages.typescript?.javascriptDefaults;
    
    const compilerOptions = {
      target: monaco.languages.typescript?.ScriptTarget?.ESNext || 99,
      module: monaco.languages.typescript?.ModuleKind?.ESNext || 99,
      moduleResolution: monaco.languages.typescript?.ModuleResolutionKind?.NodeJs || 2,
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript?.JsxEmit?.React || 2,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true, // Skip type checking of declaration files
      noResolve: true, // Don't resolve imports - prevents type definition errors
      isolatedModules: true,
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
    };
    
    if (tsDefaults) {
      tsDefaults.setCompilerOptions(compilerOptions);
      tsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [
          2307, // Cannot find module
          2304, // Cannot find name
          2552, // Cannot find name (did you mean)
          7016, // Could not find declaration file
          2503, // Cannot find namespace
          2688, // Cannot find type definition file
          2694, // Namespace has no exported member
        ]
      });
    }
    
    if (jsDefaults) {
      jsDefaults.setCompilerOptions(compilerOptions);
      jsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [2307, 2304, 2552, 7016, 2503, 2688, 2694]
      });
    }
    
    // Register AI inline completion provider
    registerAICompletionProvider(monaco);
    
    // Listen for diagnostic changes (for Problems panel)
    if (onProblemsChange) {
      monaco.editor.onDidChangeMarkers((uris) => {
        const allProblems = [];
        uris.forEach(uri => {
          const markers = monaco.editor.getModelMarkers({ resource: uri });
          markers.forEach(marker => {
            // Filter out common "cannot find" errors that are due to Monaco not having access to node_modules
            const ignoredPatterns = [
              /Cannot find (module|type definition file|name|namespace)/i,
              /Could not find (a )?declaration file/i,
              /has no exported member/i,
              /Module.*has no default export/i,
            ];
            
            const shouldIgnore = ignoredPatterns.some(pattern => pattern.test(marker.message));
            if (shouldIgnore) return;
            
            allProblems.push({
              file: uri.path,
              line: marker.startLineNumber,
              column: marker.startColumn,
              message: marker.message,
              severity: marker.severity === 8 ? 'error' : 'warning',
              source: marker.source || 'typescript'
            });
          });
        });
        onProblemsChange(allProblems);
      });
    }
  };
  
  // Update theme when it changes
  useEffect(() => {
    if (monacoRef.current && currentTheme) {
      monacoRef.current.editor.setTheme(currentTheme);
    }
  }, [currentTheme]);

  // Detect and fetch JSON schemas when file content changes
  useEffect(() => {
    if (!monacoRef.current || !activeFile) return;
    if (activeFile.language !== 'json') return;
    
    // Try to parse JSON and look for $schema
    try {
      const content = activeFile.content;
      if (!content) return;
      
      // Quick check for $schema before full parse
      if (!content.includes('$schema')) return;
      
      const json = JSON.parse(content);
      if (json.$schema) {
        const fileUri = activeFile.path || activeFile.name;
        fetchAndRegisterSchema(monacoRef.current, json.$schema, fileUri);
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }, [activeFile?.content, activeFile?.language, activeFile?.path]);

  useEffect(() => {
    if (editorRef.current && activeFile) editorRef.current.focus();
  }, [activeFile]);

  // Update Monaco editor options when settings change
  useEffect(() => {
    if (!editorRef.current) return;
    
    editorRef.current.updateOptions({
      fontSize: editorSettings.fontSize || 14,
      fontFamily: editorSettings.fontFamily || "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: editorSettings.fontLigatures !== false,
      tabSize: editorSettings.tabSize || 2,
      insertSpaces: editorSettings.insertSpaces !== false,
      wordWrap: editorSettings.wordWrap || 'off',
      lineNumbers: editorSettings.lineNumbers || 'on',
      minimap: { 
        enabled: editorSettings.minimap !== false, 
        scale: editorSettings.minimapScale || 1 
      },
      scrollBeyondLastLine: editorSettings.scrollBeyondLastLine || false,
      smoothScrolling: editorSettings.smoothScrolling !== false,
      cursorBlinking: editorSettings.cursorBlinking || 'smooth',
      cursorStyle: editorSettings.cursorStyle || 'line',
      cursorWidth: editorSettings.cursorWidth || 2,
      bracketPairColorization: { enabled: editorSettings.bracketPairColorization !== false },
      renderWhitespace: editorSettings.renderWhitespace || 'none',
      renderLineHighlight: editorSettings.renderLineHighlight || 'line',
      padding: editorSettings.padding || { top: 16, bottom: 16 },
      lineHeight: editorSettings.lineHeight || 22,
      letterSpacing: editorSettings.letterSpacing || 0,
      autoClosingBrackets: editorSettings.autoClosingBrackets || 'always',
      autoClosingQuotes: editorSettings.autoClosingQuotes || 'always',
      autoIndent: editorSettings.autoIndent || 'full',
    });
  }, [editorSettings]);

  if (!activeFile) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2), rgba(59,130,246,0.2))',
                filter: 'blur(20px)'
              }}
            />
            <Bot size={56} style={{ color: 'var(--primary)', position: 'relative' }} />
          </motion.div>
          
          <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Welcome to IDEC
          </motion.h2>
          
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            style={{ color: 'var(--muted-foreground)', marginBottom: 40 }}>
            AI-Powered Development Environment
          </motion.p>
          
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: Bot, label: 'AI Assistant', desc: 'Claude integrated' },
              { icon: Sparkles, label: 'Smart Edit', desc: 'Monaco editor' },
              { icon: Zap, label: 'Fast', desc: 'Electron powered' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                whileHover={{ y: -4, scale: 1.02 }}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  transition: 'border-color 200ms ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <item.icon size={24} style={{ color: 'var(--primary)', marginBottom: 8 }} />
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.label}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 32 }}>
            Press <kbd style={{ padding: '2px 8px', background: 'var(--muted)', borderRadius: 4, fontSize: 11 }}>⌘O</kbd> to open a folder
          </motion.p>
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '8px 8px 0', gap: 4, overflowX: 'auto' }}>
        <AnimatePresence mode="popLayout">
          {openFiles.map(file => (
            <motion.div
              key={file.path}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, width: 0 }}
              onClick={() => onFileSelect(file)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontSize: 13,
                background: activeFile?.path === file.path ? 'var(--background)' : 'transparent',
                color: activeFile?.path === file.path ? 'var(--foreground)' : 'var(--muted-foreground)',
                borderTop: activeFile?.path === file.path ? '1px solid var(--border)' : '1px solid transparent',
                borderLeft: activeFile?.path === file.path ? '1px solid var(--border)' : '1px solid transparent',
                borderRight: activeFile?.path === file.path ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'all 150ms ease'
              }}
            >
              {file.isDirty && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
              )}
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'var(--muted)' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onFileClose(file.path); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, background: 'transparent', border: 'none',
                  borderRadius: 4, cursor: 'pointer', opacity: 0.5, transition: 'opacity 150ms ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
              >
                <X size={12} />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Editor with Loading State */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loadingFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--background)',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--muted)', borderTopColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Loading file...</span>
            </div>
          </motion.div>
        )}
        <MonacoEditor
          height="100%"
          language={activeFile?.language}
          value={activeFile?.content}
          onChange={(value) => onFileChange(value || '')}
          onMount={handleEditorMount}
          options={{
            fontSize: editorSettings.fontSize || 14,
            fontFamily: editorSettings.fontFamily || "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: editorSettings.fontLigatures !== false,
            tabSize: editorSettings.tabSize || 2,
            insertSpaces: editorSettings.insertSpaces !== false,
            wordWrap: editorSettings.wordWrap || 'off',
            lineNumbers: editorSettings.lineNumbers || 'on',
            minimap: { 
              enabled: editorSettings.minimap !== false, 
              scale: editorSettings.minimapScale || 1 
            },
            scrollBeyondLastLine: editorSettings.scrollBeyondLastLine || false,
            smoothScrolling: editorSettings.smoothScrolling !== false,
            cursorBlinking: editorSettings.cursorBlinking || 'smooth',
            cursorStyle: editorSettings.cursorStyle || 'line',
            cursorSmoothCaretAnimation: 'on',
            cursorWidth: editorSettings.cursorWidth || 2,
            bracketPairColorization: { enabled: editorSettings.bracketPairColorization !== false },
            renderWhitespace: editorSettings.renderWhitespace || 'none',
            renderLineHighlight: editorSettings.renderLineHighlight || 'line',
            padding: editorSettings.padding || { top: 16, bottom: 16 },
            lineHeight: editorSettings.lineHeight || 22,
            letterSpacing: editorSettings.letterSpacing || 0,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            autoClosingBrackets: editorSettings.autoClosingBrackets || 'always',
            autoClosingQuotes: editorSettings.autoClosingQuotes || 'always',
            autoIndent: editorSettings.autoIndent || 'full',
            // IntelliSense / Autocomplete
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'matchingDocuments',
            parameterHints: { enabled: true },
            suggest: {
              localityBonus: true,
              shareSuggestSelections: true,
              showIcons: true,
              showStatusBar: true,
              preview: true,
              previewMode: 'subwordSmart',
              showMethods: true,
              showFunctions: true,
              showConstructors: true,
              showDeprecated: true,
              showFields: true,
              showVariables: true,
              showClasses: true,
              showStructs: true,
              showInterfaces: true,
              showModules: true,
              showProperties: true,
              showEvents: true,
              showOperators: true,
              showUnits: true,
              showValues: true,
              showConstants: true,
              showEnumMembers: true,
              showKeywords: true,
              showWords: true,
              showColors: true,
              showFiles: true,
              showReferences: true,
              showFolders: true,
              showTypeParameters: true,
              showSnippets: true,
            },
            // Inline completions (for AI ghost text)
            inlineSuggest: {
              enabled: aiCompletionEnabled,
              showToolbar: 'onHover'
            },
          }}
        />
        {/* AI Completion indicator */}
        {isGeneratingCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--muted-foreground)'
            }}
          >
            <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            AI completing...
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default Editor;
