import React from 'react';
import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import './styles/globals.css';
import App from './App';

// Global error handlers to prevent crashes
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', message, source, lineno, colno, error);
  return true; // Prevent default handling
};

window.onunhandledrejection = (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  event.preventDefault();
};

// Configure Monaco to load from local vs folder
const getVsPath = () => {
  // In dev server (http://), use relative path which works with webpack dev server
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.origin}/vs`;
  }
  // In production Electron (file://), construct file path
  const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
  return `${basePath}/vs`;
};

const vsPath = getVsPath();
console.log('[Monaco] Configuring vs path:', vsPath);
console.log('[Monaco] Protocol:', window.location.protocol);
window.__monacoVsPath = vsPath;
window.__monacoErrors = [];

// Configure Monaco Environment for web workers
window.MonacoEnvironment = {
  getWorker: function(workerId, label) {
    const getWorkerModule = (moduleUrl) => {
      return `self.MonacoEnvironment = {
        baseUrl: '${vsPath}/'
      };
      importScripts('${moduleUrl}');`;
    };
    
    let workerUrl;
    switch (label) {
      case 'json':
        workerUrl = `${vsPath}/language/json/json.worker.js`;
        break;
      case 'css':
      case 'scss':
      case 'less':
        workerUrl = `${vsPath}/language/css/css.worker.js`;
        break;
      case 'html':
      case 'handlebars':
      case 'razor':
        workerUrl = `${vsPath}/language/html/html.worker.js`;
        break;
      case 'typescript':
      case 'javascript':
        workerUrl = `${vsPath}/language/typescript/ts.worker.js`;
        break;
      default:
        workerUrl = `${vsPath}/editor/editor.worker.js`;
    }
    
    const blob = new Blob([getWorkerModule(workerUrl)], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }
};

loader.config({
  paths: {
    vs: vsPath
  }
});

// Add Monaco init promise handler for debugging
loader.init().then(monaco => {
  console.log('[Monaco] Loaded successfully!', monaco ? 'monaco object available' : 'no monaco');
  window.__monacoLoaded = true;
  window.__monaco = monaco;
  
  // Create a schema request service that can fetch remote schemas via main process
  // Use the preload-exposed electronAPI instead of window.require('electron')
  const schemaRequestService = async (url) => {
    console.log('[Monaco JSON] Fetching schema:', url);
    try {
      // Use IPC to fetch schema from main process (bypasses CORS)
      const result = await window.electronAPI.fetchJsonSchema(url);
      if (result.success) {
        console.log('[Monaco JSON] Schema loaded:', url);
        return result.schema;
      } else {
        console.warn('[Monaco JSON] Schema fetch failed:', url, result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[Monaco JSON] Schema request error:', url, error);
      throw error;
    }
  };
  
  // Configure JSON language service with schema request service for remote schemas
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [],
    enableSchemaRequest: true,
    schemaRequest: 'warning',
    schemaValidation: 'warning',
  });
  
  // Register the custom schema request service
  // Monaco JSON defaults has a way to set this during mode configuration
  monaco.languages.json.jsonDefaults.setModeConfiguration({
    documentFormattingEdits: true,
    documentRangeFormattingEdits: true,
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    tokens: true,
    colors: true,
    foldingRanges: true,
    diagnostics: true,
    selectionRanges: true,
  });
  
  // Store schema request service globally for worker access
  window.__schemaRequestService = schemaRequestService;
  
}).catch(err => {
  console.error('[Monaco] Failed to load:', err);
  window.__monacoErrors.push(err.toString());
});

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
