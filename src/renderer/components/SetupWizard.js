import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ChevronRight, ChevronLeft, Check, Palette, Key, 
  Import, ArrowRight, Moon, Sun, Zap, Bot, Eye, EyeOff,
  FolderOpen, CheckCircle2
} from 'lucide-react';
import { themes } from '../lib/themes';

const { ipcRenderer } = window.require('electron');

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'theme', title: 'Choose Theme' },
  { id: 'import', title: 'Import Settings' },
  { id: 'api', title: 'AI Providers' },
  { id: 'complete', title: 'Ready!' },
];

const featuredThemes = ['idec-dark', 'dracula', 'github-dark'];

function SetupWizard({ onComplete, initialSettings }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState(initialSettings || {
    theme: 'idec-dark',
    ai: {
      claudeApiKey: '',
      openaiApiKey: '',
      groqApiKey: '',
      openrouterApiKey: '',
      ollamaCloudApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      provider: 'claude',
    },
    editor: { fontSize: 14 },
  });
  const [showKeys, setShowKeys] = useState({});
  const [importStatus, setImportStatus] = useState(null);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    onComplete(settings);
  };

  const handleThemeSelect = (themeId) => {
    setSettings(prev => ({ ...prev, theme: themeId }));
  };

  const handleApiKeyChange = (provider, value) => {
    setSettings(prev => ({
      ...prev,
      ai: { ...prev.ai, [provider]: value }
    }));
  };

  const handleImportVSCode = async () => {
    setImportStatus('importing');
    try {
      const result = await ipcRenderer.invoke('import-vscode-settings');
      if (result.success) {
        setSettings(prev => ({
          ...prev,
          ...result.settings,
          ai: { ...prev.ai, ...result.settings.ai }
        }));
        setImportStatus('success');
      } else {
        setImportStatus('error');
      }
    } catch (error) {
      setImportStatus('error');
    }
  };

  const toggleShowKey = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  const currentTheme = themes[settings.theme] || themes['idec-dark'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: currentTheme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Progress Indicator */}
      <div style={{ 
        position: 'absolute', 
        top: 40, 
        display: 'flex', 
        gap: 8,
        padding: '8px 16px',
        background: currentTheme.colors.card,
        borderRadius: 20,
        border: `1px solid ${currentTheme.colors.border}`
      }}>
        {steps.map((step, idx) => (
          <motion.div
            key={step.id}
            animate={{
              background: idx <= currentStep ? currentTheme.colors.primary : currentTheme.colors.muted,
              scale: idx === currentStep ? 1.2 : 1,
            }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          style={{
            width: '100%',
            maxWidth: 600,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {currentStep === 0 && (
            <WelcomeStep theme={currentTheme} />
          )}
          
          {currentStep === 1 && (
            <ThemeStep 
              theme={currentTheme}
              selectedTheme={settings.theme}
              onSelect={handleThemeSelect}
            />
          )}
          
          {currentStep === 2 && (
            <ImportStep 
              theme={currentTheme}
              importStatus={importStatus}
              onImport={handleImportVSCode}
            />
          )}
          
          {currentStep === 3 && (
            <APIStep 
              theme={currentTheme}
              settings={settings}
              showKeys={showKeys}
              onApiKeyChange={handleApiKeyChange}
              toggleShowKey={toggleShowKey}
            />
          )}
          
          {currentStep === 4 && (
            <CompleteStep theme={currentTheme} settings={settings} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ 
        position: 'absolute', 
        bottom: 40, 
        display: 'flex', 
        gap: 12 
      }}>
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: 'transparent',
              border: `1px solid ${currentTheme.colors.border}`,
              borderRadius: 10,
              color: currentTheme.colors.foreground,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} /> Back
          </motion.button>
        )}
        
        {currentStep < steps.length - 1 ? (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: `0 0 30px ${currentTheme.colors.primary}40` }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 32px',
              background: currentTheme.colors.primary,
              border: 'none',
              borderRadius: 10,
              color: currentTheme.colors.primaryForeground,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {currentStep === 0 ? "Let's Go" : 'Continue'} <ChevronRight size={18} />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: `0 0 30px ${currentTheme.colors.primary}40` }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFinish}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 32px',
              background: currentTheme.colors.primary,
              border: 'none',
              borderRadius: 10,
              color: currentTheme.colors.primaryForeground,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start Coding <ArrowRight size={18} />
          </motion.button>
        )}
      </div>

      {/* Skip */}
      {currentStep > 0 && currentStep < steps.length - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setCurrentStep(steps.length - 1)}
          style={{
            position: 'absolute',
            bottom: 100,
            background: 'transparent',
            border: 'none',
            color: currentTheme.colors.mutedForeground,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Skip setup
        </motion.button>
      )}
    </motion.div>
  );
}

function WelcomeStep({ theme }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring' }}
        style={{ marginBottom: 32 }}
      >
        <div style={{ 
          position: 'relative', 
          display: 'inline-block',
          padding: 24,
          background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.accent}20)`,
          borderRadius: 24,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: -10,
              borderRadius: 30,
              background: `linear-gradient(135deg, ${theme.colors.primary}30, ${theme.colors.accent}30)`,
              filter: 'blur(20px)',
            }}
          />
          <Bot size={64} style={{ color: theme.colors.primary, position: 'relative' }} />
        </div>
      </motion.div>
      
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ 
          fontSize: 36, 
          fontWeight: 700, 
          marginBottom: 12,
          color: theme.colors.foreground,
        }}
      >
        Welcome to IDEC
      </motion.h1>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ 
          fontSize: 16, 
          color: theme.colors.mutedForeground,
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        Your AI-powered development environment with Claude, OpenAI, Groq, and Ollama integration.
      </motion.p>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ 
          display: 'flex', 
          gap: 24, 
          marginTop: 40,
          justifyContent: 'center',
        }}
      >
        {[
          { icon: Zap, label: 'Fast' },
          { icon: Sparkles, label: 'AI-Powered' },
          { icon: Palette, label: 'Customizable' },
        ].map((item, i) => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12,
              background: theme.colors.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}>
              <item.icon size={22} style={{ color: theme.colors.primary }} />
            </div>
            <span style={{ fontSize: 12, color: theme.colors.mutedForeground }}>{item.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ThemeStep({ theme, selectedTheme, onSelect }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Palette size={32} style={{ color: theme.colors.primary, marginBottom: 12 }} />
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: theme.colors.foreground }}>
          Choose Your Theme
        </h2>
        <p style={{ color: theme.colors.mutedForeground }}>
          You can change this anytime in settings
        </p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {featuredThemes.map(themeId => {
          const t = themes[themeId];
          const isSelected = selectedTheme === themeId;
          return (
            <motion.button
              key={themeId}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(themeId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                background: isSelected ? `${t.colors.primary}15` : theme.colors.card,
                border: isSelected ? `2px solid ${t.colors.primary}` : `1px solid ${theme.colors.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Theme Preview */}
              <div style={{ 
                display: 'flex', 
                gap: 2, 
                borderRadius: 6, 
                overflow: 'hidden',
                width: 80,
                height: 40,
              }}>
                <div style={{ flex: 1, background: t.colors.background }} />
                <div style={{ flex: 1, background: t.colors.primary }} />
                <div style={{ flex: 1, background: t.syntax.keyword }} />
                <div style={{ flex: 1, background: t.syntax.string }} />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: theme.colors.foreground,
                  marginBottom: 2,
                }}>
                  {t.name}
                </div>
                <div style={{ 
                  fontSize: 12, 
                  color: theme.colors.mutedForeground,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {t.type === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                  {t.type.charAt(0).toUpperCase() + t.type.slice(1)} theme
                </div>
              </div>
              
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: t.colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={14} style={{ color: t.colors.primaryForeground }} />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
      
      <p style={{ 
        textAlign: 'center', 
        marginTop: 16, 
        fontSize: 12, 
        color: theme.colors.mutedForeground 
      }}>
        9 themes available in settings
      </p>
    </div>
  );
}

function ImportStep({ theme, importStatus, onImport }) {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <Import size={32} style={{ color: theme.colors.primary, marginBottom: 12 }} />
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: theme.colors.foreground }}>
        Import from VS Code
      </h2>
      <p style={{ color: theme.colors.mutedForeground, marginBottom: 32 }}>
        Import your VS Code settings, keybindings, and extensions
      </p>
      
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onImport}
        disabled={importStatus === 'importing'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          width: '100%',
          padding: 20,
          background: theme.colors.card,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 12,
          cursor: importStatus === 'importing' ? 'wait' : 'pointer',
          marginBottom: 16,
        }}
      >
        <FolderOpen size={24} style={{ color: theme.colors.primary }} />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.colors.foreground }}>
            {importStatus === 'importing' ? 'Importing...' : 
             importStatus === 'success' ? 'Import Successful!' :
             importStatus === 'error' ? 'Import Failed' :
             'Import VS Code Settings'}
          </div>
          <div style={{ fontSize: 12, color: theme.colors.mutedForeground }}>
            Automatically detect and import your configuration
          </div>
        </div>
        {importStatus === 'success' && (
          <CheckCircle2 size={20} style={{ color: '#22c55e', marginLeft: 'auto' }} />
        )}
      </motion.button>
      
      <p style={{ fontSize: 12, color: theme.colors.mutedForeground }}>
        This step is optional. You can configure everything manually.
      </p>
    </div>
  );
}

function APIStep({ theme, settings, showKeys, onApiKeyChange, toggleShowKey }) {
  const [testStatus, setTestStatus] = useState({});
  
  const providers = [
    { id: 'claudeApiKey', name: 'Claude (Anthropic)', icon: '🤖', placeholder: 'sk-ant-...', testProvider: 'claude' },
    { id: 'openaiApiKey', name: 'OpenAI', icon: '💚', placeholder: 'sk-...', testProvider: 'openai' },
    { id: 'openrouterApiKey', name: 'OpenRouter', icon: '🔀', placeholder: 'sk-or-...', testProvider: 'openrouter' },
    { id: 'groqApiKey', name: 'Groq', icon: '⚡', placeholder: 'gsk_...', testProvider: 'groq' },
    { id: 'ollamaCloudApiKey', name: 'Ollama Cloud', icon: '☁️', placeholder: 'ollama-...', testProvider: 'ollama-cloud' },
  ];

  const testApiKey = async (provider) => {
    const apiKey = settings.ai[provider.id];
    if (!apiKey) return;
    
    setTestStatus(prev => ({ ...prev, [provider.id]: 'testing' }));
    
    try {
      const config = {
        claudeApiKey: provider.id === 'claudeApiKey' ? apiKey : '',
        openaiApiKey: provider.id === 'openaiApiKey' ? apiKey : '',
        groqApiKey: provider.id === 'groqApiKey' ? apiKey : '',
        openrouterApiKey: provider.id === 'openrouterApiKey' ? apiKey : '',
        ollamaCloudApiKey: provider.id === 'ollamaCloudApiKey' ? apiKey : '',
      };
      
      const result = await ipcRenderer.invoke('fetch-models', provider.testProvider, config);
      setTestStatus(prev => ({ ...prev, [provider.id]: result.success ? 'success' : 'error' }));
      
      // Reset after 3 seconds
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, [provider.id]: null }));
      }, 3000);
    } catch (error) {
      setTestStatus(prev => ({ ...prev, [provider.id]: 'error' }));
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, [provider.id]: null }));
      }, 3000);
    }
  };

  const testOllama = async () => {
    setTestStatus(prev => ({ ...prev, ollama: 'testing' }));
    try {
      const config = { ollamaUrl: settings.ai.ollamaUrl || 'http://localhost:11434' };
      const result = await ipcRenderer.invoke('fetch-models', 'ollama', config);
      setTestStatus(prev => ({ ...prev, ollama: result.success ? 'success' : 'error' }));
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, ollama: null }));
      }, 3000);
    } catch (error) {
      setTestStatus(prev => ({ ...prev, ollama: 'error' }));
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, ollama: null }));
      }, 3000);
    }
  };

  const getTestButtonStyle = (status) => ({
    padding: '8px 12px',
    background: status === 'success' ? 'rgba(34,197,94,0.2)' : 
                status === 'error' ? 'rgba(239,68,68,0.2)' : 
                theme.colors.secondary,
    border: `1px solid ${status === 'success' ? '#22c55e' : 
                         status === 'error' ? '#ef4444' : 
                         theme.colors.border}`,
    borderRadius: 8,
    cursor: status === 'testing' ? 'wait' : 'pointer',
    fontSize: 12,
    fontWeight: 500,
    color: status === 'success' ? '#22c55e' : 
           status === 'error' ? '#ef4444' : 
           theme.colors.foreground,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  return (
    <div style={{ width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Key size={32} style={{ color: theme.colors.primary, marginBottom: 12 }} />
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: theme.colors.foreground }}>
          Configure AI Providers
        </h2>
        <p style={{ color: theme.colors.mutedForeground }}>
          Add API keys for AI features (optional)
        </p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {providers.map(provider => (
          <div
            key={provider.id}
            style={{
              padding: 16,
              background: theme.colors.card,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 12,
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 10 
            }}>
              <span style={{ fontSize: 18 }}>{provider.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.colors.foreground }}>
                {provider.name}
              </span>
              {settings.ai[provider.id] && testStatus[provider.id] !== 'success' && testStatus[provider.id] !== 'error' && (
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: 10, 
                  padding: '2px 8px', 
                  borderRadius: 10, 
                  background: 'rgba(34,197,94,0.1)', 
                  color: '#22c55e' 
                }}>
                  Configured
                </span>
              )}
              {testStatus[provider.id] === 'success' && (
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: 10, 
                  padding: '2px 8px', 
                  borderRadius: 10, 
                  background: 'rgba(34,197,94,0.2)', 
                  color: '#22c55e' 
                }}>
                  ✓ Working
                </span>
              )}
              {testStatus[provider.id] === 'error' && (
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: 10, 
                  padding: '2px 8px', 
                  borderRadius: 10, 
                  background: 'rgba(239,68,68,0.2)', 
                  color: '#ef4444' 
                }}>
                  ✗ Failed
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKeys[provider.id] ? 'text' : 'password'}
                value={settings.ai[provider.id] || ''}
                onChange={(e) => onApiKeyChange(provider.id, e.target.value)}
                placeholder={provider.placeholder}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: theme.colors.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: theme.colors.foreground,
                  outline: 'none',
                }}
              />
              <motion.button
                whileHover={{ background: theme.colors.muted }}
                onClick={() => toggleShowKey(provider.id)}
                style={{
                  width: 40,
                  background: theme.colors.secondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.mutedForeground,
                }}
              >
                {showKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
              </motion.button>
              <motion.button
                whileHover={{ opacity: 0.8 }}
                onClick={() => testApiKey(provider)}
                disabled={!settings.ai[provider.id] || testStatus[provider.id] === 'testing'}
                style={getTestButtonStyle(testStatus[provider.id])}
              >
                {testStatus[provider.id] === 'testing' ? 'Testing...' : 
                 testStatus[provider.id] === 'success' ? '✓ Valid' : 
                 testStatus[provider.id] === 'error' ? '✗ Invalid' : 'Test'}
              </motion.button>
            </div>
          </div>
        ))}
        
        {/* Ollama Local */}
        <div
          style={{
            padding: 16,
            background: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🦙</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.colors.foreground }}>
              Ollama (Local)
            </span>
            {testStatus.ollama === 'success' && (
              <span style={{ 
                marginLeft: 'auto',
                fontSize: 10, 
                padding: '2px 8px', 
                borderRadius: 10, 
                background: 'rgba(34,197,94,0.2)', 
                color: '#22c55e' 
              }}>
                ✓ Connected
              </span>
            )}
            {testStatus.ollama === 'error' && (
              <span style={{ 
                marginLeft: 'auto',
                fontSize: 10, 
                padding: '2px 8px', 
                borderRadius: 10, 
                background: 'rgba(239,68,68,0.2)', 
                color: '#ef4444' 
              }}>
                ✗ Not Running
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={settings.ai.ollamaUrl || 'http://localhost:11434'}
              onChange={(e) => onApiKeyChange('ollamaUrl', e.target.value)}
              placeholder="http://localhost:11434"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: theme.colors.secondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 8,
                fontSize: 13,
                color: theme.colors.foreground,
                outline: 'none',
              }}
            />
            <motion.button
              whileHover={{ opacity: 0.8 }}
              onClick={testOllama}
              disabled={testStatus.ollama === 'testing'}
              style={getTestButtonStyle(testStatus.ollama)}
            >
              {testStatus.ollama === 'testing' ? 'Testing...' : 
               testStatus.ollama === 'success' ? '✓ Connected' : 
               testStatus.ollama === 'error' ? '✗ Failed' : 'Test'}
            </motion.button>
          </div>
          <p style={{ fontSize: 11, color: theme.colors.mutedForeground, marginTop: 8 }}>
            Run AI models locally with Ollama
          </p>
        </div>
      </div>
    </div>
  );
}

function CompleteStep({ theme, settings }) {
  const configuredProviders = [
    settings.ai.claudeApiKey && 'Claude',
    settings.ai.openaiApiKey && 'OpenAI',
    settings.ai.openrouterApiKey && 'OpenRouter',
    settings.ai.groqApiKey && 'Groq',
    settings.ai.ollamaCloudApiKey && 'Ollama Cloud',
    'Ollama',
  ].filter(Boolean);

  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <CheckCircle2 size={40} style={{ color: 'white' }} />
      </motion.div>
      
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: theme.colors.foreground }}>
        You're All Set!
      </h2>
      <p style={{ color: theme.colors.mutedForeground, marginBottom: 32 }}>
        IDEC is ready to help you build amazing things
      </p>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 20,
        background: theme.colors.card,
        borderRadius: 12,
        border: `1px solid ${theme.colors.border}`,
        textAlign: 'left',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: theme.colors.mutedForeground }}>Theme</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: theme.colors.foreground }}>
            {themes[settings.theme]?.name || 'IDEC Dark'}
          </span>
        </div>
        <div style={{ height: 1, background: theme.colors.border }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: theme.colors.mutedForeground }}>AI Providers</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: theme.colors.foreground }}>
            {configuredProviders.join(', ')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SetupWizard;
