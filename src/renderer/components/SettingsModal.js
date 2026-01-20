import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Eye, EyeOff, Bot, Settings, Palette, Code, TerminalSquare, 
  Files, Keyboard, Cloud, ChevronRight, Check, Monitor, Sun, Moon,
  Search, RotateCcw
} from 'lucide-react';
import { themes } from '../lib/themes';
import { defaultSettings, settingsSections } from '../lib/settings';

const icons = {
  Palette, Code, TerminalSquare, Bot, Files, Keyboard, Settings
};

function SettingsModal({ settings, onSettingsChange, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeSection, setActiveSection] = useState('appearance');
  const [showKeys, setShowKeys] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const handleSave = () => { 
    onSettingsChange(localSettings); 
    onClose(); 
  };

  const handleChange = (path, value) => {
    setLocalSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return newSettings;
    });
  };

  const getValue = (path) => {
    if (!path) return undefined;
    const keys = path.split('.');
    let current = localSettings;
    for (const key of keys) {
      if (current === undefined) return undefined;
      current = current[key];
    }
    return current;
  };

  const resetSection = (section) => {
    if (section === 'appearance') {
      handleChange('theme', defaultSettings.theme);
    } else if (defaultSettings[section]) {
      setLocalSettings(prev => ({ ...prev, [section]: { ...defaultSettings[section] } }));
    }
  };

  const toggleShowKey = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          width: '90%', maxWidth: 900, height: '80vh', maxHeight: 700,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Settings</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ 
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--muted-foreground)' 
              }} />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: 200, padding: '8px 12px 8px 32px',
                  background: 'var(--secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 13, color: 'var(--foreground)', outline: 'none'
                }}
              />
            </div>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, backgroundColor: 'var(--muted)' }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 32, height: 32, background: 'transparent', border: 'none',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--muted-foreground)'
              }}
            >
              <X size={16} />
            </motion.button>
          </div>
        </div>
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ 
            width: 220, borderRight: '1px solid var(--border)', 
            padding: '12px 8px', overflow: 'auto' 
          }}>
            {settingsSections.map(section => {
              const Icon = icons[section.icon] || Settings;
              return (
                <motion.button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  whileHover={{ x: 2 }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', marginBottom: 2, borderRadius: 8, border: 'none',
                    background: activeSection === section.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                    color: activeSection === section.id ? 'var(--primary)' : 'var(--foreground)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left'
                  }}
                >
                  <Icon size={16} />
                  {section.label}
                  {activeSection === section.id && (
                    <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                  )}
                </motion.button>
              );
            })}
          </div>
          
          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              marginBottom: 20 
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                  {settingsSections.find(s => s.id === activeSection)?.label}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  {settingsSections.find(s => s.id === activeSection)?.description}
                </p>
              </div>
              <motion.button
                onClick={() => resetSection(activeSection)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, color: 'var(--muted-foreground)'
                }}
              >
                <RotateCcw size={12} /> Reset
              </motion.button>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {activeSection === 'appearance' && (
                  <AppearanceSettings 
                    settings={localSettings} 
                    onChange={handleChange} 
                    getValue={getValue}
                  />
                )}
                {activeSection === 'editor' && (
                  <EditorSettings 
                    settings={localSettings} 
                    onChange={handleChange}
                    getValue={getValue}
                  />
                )}
                {activeSection === 'terminal' && (
                  <TerminalSettings 
                    settings={localSettings} 
                    onChange={handleChange}
                    getValue={getValue}
                  />
                )}
                {activeSection === 'ai' && (
                  <AISettings 
                    settings={localSettings} 
                    onChange={handleChange}
                    getValue={getValue}
                    showKeys={showKeys}
                    toggleShowKey={toggleShowKey}
                  />
                )}
                {activeSection === 'files' && (
                  <FilesSettings 
                    settings={localSettings} 
                    onChange={handleChange}
                    getValue={getValue}
                  />
                )}
                {activeSection === 'keybindings' && (
                  <KeybindingsSettings 
                    settings={localSettings} 
                    onChange={handleChange}
                    getValue={getValue}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 12,
          padding: '12px 20px', borderTop: '1px solid var(--border)', 
          background: 'rgba(255,255,255,0.02)'
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AppearanceSettings({ settings, onChange, getValue }) {
  const currentTheme = getValue('theme') || 'idec-dark';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Theme Selection */}
      <SettingGroup title="Color Theme">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
          gap: 12 
        }}>
          {Object.values(themes).map(theme => (
            <motion.button
              key={theme.id}
              onClick={() => onChange('theme', theme.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: 12, borderRadius: 10,
                border: currentTheme === theme.id 
                  ? '2px solid var(--primary)' 
                  : '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <div style={{ 
                display: 'flex', gap: 4, marginBottom: 8, borderRadius: 4, 
                overflow: 'hidden', height: 24 
              }}>
                <div style={{ flex: 1, background: theme.colors.background }} />
                <div style={{ flex: 1, background: theme.colors.primary }} />
                <div style={{ flex: 1, background: theme.colors.accent }} />
                <div style={{ flex: 1, background: theme.syntax.keyword }} />
              </div>
              <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
              }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
                  {theme.name}
                </span>
                {currentTheme === theme.id && (
                  <Check size={14} style={{ color: 'var(--primary)' }} />
                )}
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>
                {theme.type === 'light' ? <Sun size={10} /> : <Moon size={10} />}
              </span>
            </motion.button>
          ))}
        </div>
      </SettingGroup>
    </div>
  );
}

function EditorSettings({ settings, onChange, getValue }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingGroup title="Font">
        <SettingRow label="Font Size" description="Editor font size in pixels">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min="10" max="24"
              value={getValue('editor.fontSize') || 14}
              onChange={(e) => onChange('editor.fontSize', parseInt(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', minWidth: 40 }}>
              {getValue('editor.fontSize') || 14}px
            </span>
          </div>
        </SettingRow>
        
        <SettingRow label="Font Family" description="Editor font family">
          <select
            value={getValue('editor.fontFamily') || ''}
            onChange={(e) => onChange('editor.fontFamily', e.target.value)}
            className="input"
            style={{ width: 200 }}
          >
            <option value="'SF Mono', 'JetBrains Mono', 'Fira Code', monospace">SF Mono</option>
            <option value="'JetBrains Mono', 'Fira Code', monospace">JetBrains Mono</option>
            <option value="'Fira Code', monospace">Fira Code</option>
            <option value="'Cascadia Code', monospace">Cascadia Code</option>
            <option value="'Source Code Pro', monospace">Source Code Pro</option>
            <option value="Consolas, monospace">Consolas</option>
            <option value="Monaco, monospace">Monaco</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Font Ligatures" description="Enable font ligatures">
          <Toggle 
            value={getValue('editor.fontLigatures')} 
            onChange={(v) => onChange('editor.fontLigatures', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Line Height" description="Line height in pixels">
          <input
            type="number" min="16" max="36"
            value={getValue('editor.lineHeight') || 22}
            onChange={(e) => onChange('editor.lineHeight', parseInt(e.target.value))}
            className="input"
            style={{ width: 80 }}
          />
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Formatting">
        <SettingRow label="Tab Size" description="Number of spaces per tab">
          <select
            value={getValue('editor.tabSize') || 2}
            onChange={(e) => onChange('editor.tabSize', parseInt(e.target.value))}
            className="input"
            style={{ width: 80 }}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Insert Spaces" description="Use spaces instead of tabs">
          <Toggle 
            value={getValue('editor.insertSpaces')} 
            onChange={(v) => onChange('editor.insertSpaces', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Word Wrap" description="How lines should wrap">
          <select
            value={getValue('editor.wordWrap') || 'off'}
            onChange={(e) => onChange('editor.wordWrap', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
            <option value="wordWrapColumn">At Column</option>
            <option value="bounded">Bounded</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Format On Save" description="Auto-format when saving">
          <Toggle 
            value={getValue('editor.formatOnSave')} 
            onChange={(v) => onChange('editor.formatOnSave', v)} 
          />
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Display">
        <SettingRow label="Line Numbers" description="Show line numbers">
          <select
            value={getValue('editor.lineNumbers') || 'on'}
            onChange={(e) => onChange('editor.lineNumbers', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="relative">Relative</option>
            <option value="interval">Interval</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Minimap" description="Show minimap">
          <Toggle 
            value={getValue('editor.minimap')} 
            onChange={(v) => onChange('editor.minimap', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Bracket Pair Colorization" description="Colorize matching brackets">
          <Toggle 
            value={getValue('editor.bracketPairColorization')} 
            onChange={(v) => onChange('editor.bracketPairColorization', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Render Whitespace" description="Show whitespace characters">
          <select
            value={getValue('editor.renderWhitespace') || 'none'}
            onChange={(e) => onChange('editor.renderWhitespace', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="none">None</option>
            <option value="boundary">Boundary</option>
            <option value="selection">Selection</option>
            <option value="trailing">Trailing</option>
            <option value="all">All</option>
          </select>
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Cursor">
        <SettingRow label="Cursor Style" description="Cursor shape">
          <select
            value={getValue('editor.cursorStyle') || 'line'}
            onChange={(e) => onChange('editor.cursorStyle', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="line">Line</option>
            <option value="block">Block</option>
            <option value="underline">Underline</option>
            <option value="line-thin">Line Thin</option>
            <option value="block-outline">Block Outline</option>
            <option value="underline-thin">Underline Thin</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Cursor Blinking" description="Cursor animation style">
          <select
            value={getValue('editor.cursorBlinking') || 'smooth'}
            onChange={(e) => onChange('editor.cursorBlinking', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="blink">Blink</option>
            <option value="smooth">Smooth</option>
            <option value="phase">Phase</option>
            <option value="expand">Expand</option>
            <option value="solid">Solid</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Cursor Width" description="Width in pixels when using line cursor">
          <input
            type="number" min="1" max="5"
            value={getValue('editor.cursorWidth') || 2}
            onChange={(e) => onChange('editor.cursorWidth', parseInt(e.target.value))}
            className="input"
            style={{ width: 80 }}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function TerminalSettings({ settings, onChange, getValue }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingGroup title="Font">
        <SettingRow label="Font Size" description="Terminal font size">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min="10" max="20"
              value={getValue('terminal.fontSize') || 13}
              onChange={(e) => onChange('terminal.fontSize', parseInt(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', minWidth: 40 }}>
              {getValue('terminal.fontSize') || 13}px
            </span>
          </div>
        </SettingRow>
        
        <SettingRow label="Line Height" description="Terminal line height multiplier">
          <input
            type="number" min="1" max="2" step="0.1"
            value={getValue('terminal.lineHeight') || 1.2}
            onChange={(e) => onChange('terminal.lineHeight', parseFloat(e.target.value))}
            className="input"
            style={{ width: 80 }}
          />
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Cursor">
        <SettingRow label="Cursor Style" description="Terminal cursor shape">
          <select
            value={getValue('terminal.cursorStyle') || 'block'}
            onChange={(e) => onChange('terminal.cursorStyle', e.target.value)}
            className="input"
            style={{ width: 120 }}
          >
            <option value="block">Block</option>
            <option value="underline">Underline</option>
            <option value="bar">Bar</option>
          </select>
        </SettingRow>
        
        <SettingRow label="Cursor Blink" description="Enable cursor blinking">
          <Toggle 
            value={getValue('terminal.cursorBlink')} 
            onChange={(v) => onChange('terminal.cursorBlink', v)} 
          />
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Behavior">
        <SettingRow label="Scrollback" description="Number of lines to keep in history">
          <input
            type="number" min="100" max="10000" step="100"
            value={getValue('terminal.scrollback') || 1000}
            onChange={(e) => onChange('terminal.scrollback', parseInt(e.target.value))}
            className="input"
            style={{ width: 100 }}
          />
        </SettingRow>
        
        <SettingRow label="Copy On Select" description="Auto-copy selected text">
          <Toggle 
            value={getValue('terminal.copyOnSelect')} 
            onChange={(v) => onChange('terminal.copyOnSelect', v)} 
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function AISettings({ settings, onChange, getValue, showKeys, toggleShowKey }) {
  const providers = [
    { id: 'claude', name: 'Claude (Anthropic)', icon: '🤖', keyField: 'ai.claudeApiKey', placeholder: 'sk-ant-...' },
    { id: 'openai', name: 'OpenAI', icon: '💚', keyField: 'ai.openaiApiKey', placeholder: 'sk-...' },
    { id: 'openrouter', name: 'OpenRouter', icon: '🔀', keyField: 'ai.openrouterApiKey', placeholder: 'sk-or-...' },
    { id: 'groq', name: 'Groq', icon: '⚡', keyField: 'ai.groqApiKey', placeholder: 'gsk_...' },
    { id: 'ollama', name: 'Ollama (Local)', icon: '🦙', keyField: null, hasUrl: true },
    { id: 'ollama-cloud', name: 'Ollama Cloud', icon: '☁️', keyField: 'ai.ollamaCloudApiKey', placeholder: 'ollama-...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingGroup title="Default Provider">
        <select
          value={getValue('ai.provider') || 'claude'}
          onChange={(e) => onChange('ai.provider', e.target.value)}
          className="input"
          style={{ width: '100%' }}
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
          ))}
        </select>
      </SettingGroup>

      {providers.map(provider => (
        <SettingGroup key={provider.id} title={provider.name}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12
          }}>
            <span style={{ fontSize: 20 }}>{provider.icon}</span>
            {getValue(provider.keyField) && provider.keyField && (
              <span style={{ 
                fontSize: 10, padding: '2px 8px', borderRadius: 10, 
                background: 'rgba(34,197,94,0.1)', color: '#22c55e' 
              }}>
                Configured
              </span>
            )}
          </div>
          
          {provider.keyField && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKeys[provider.id] ? 'text' : 'password'}
                value={getValue(provider.keyField) || ''}
                onChange={(e) => onChange(provider.keyField, e.target.value)}
                placeholder={provider.placeholder}
                className="input"
                style={{ flex: 1 }}
              />
              <motion.button
                onClick={() => toggleShowKey(provider.id)}
                whileHover={{ backgroundColor: 'var(--muted)' }}
                style={{
                  width: 44, background: 'var(--secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--muted-foreground)'
                }}
              >
                {showKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
              </motion.button>
            </div>
          )}
          
          {provider.hasUrl && (
            <div>
              <input
                type="text"
                value={getValue('ai.ollamaUrl') || 'http://localhost:11434'}
                onChange={(e) => onChange('ai.ollamaUrl', e.target.value)}
                placeholder="http://localhost:11434"
                className="input"
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8 }}>
                Make sure Ollama is running locally or enter your remote URL
              </p>
            </div>
          )}
        </SettingGroup>
      ))}
      
      <SettingGroup title="Behavior">
        <SettingRow label="Stream Responses" description="Show AI responses as they're generated">
          <Toggle 
            value={getValue('ai.streamResponses') !== false} 
            onChange={(v) => onChange('ai.streamResponses', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Context Lines" description="Lines of code to send as context">
          <input
            type="number" min="10" max="200"
            value={getValue('ai.contextLines') || 50}
            onChange={(e) => onChange('ai.contextLines', parseInt(e.target.value))}
            className="input"
            style={{ width: 80 }}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function FilesSettings({ settings, onChange, getValue }) {
  const excludeList = getValue('files.exclude') || [];
  
  const addExclude = () => {
    const pattern = prompt('Enter pattern to exclude (e.g., node_modules, *.log):');
    if (pattern && !excludeList.includes(pattern)) {
      onChange('files.exclude', [...excludeList, pattern]);
    }
  };
  
  const removeExclude = (pattern) => {
    onChange('files.exclude', excludeList.filter(p => p !== pattern));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingGroup title="Auto Save">
        <SettingRow label="Auto Save" description="When to auto-save files">
          <select
            value={getValue('files.autoSave') || 'off'}
            onChange={(e) => onChange('files.autoSave', e.target.value)}
            className="input"
            style={{ width: 150 }}
          >
            <option value="off">Off</option>
            <option value="afterDelay">After Delay</option>
            <option value="onFocusChange">On Focus Change</option>
            <option value="onWindowChange">On Window Change</option>
          </select>
        </SettingRow>
        
        {getValue('files.autoSave') === 'afterDelay' && (
          <SettingRow label="Auto Save Delay" description="Delay in milliseconds">
            <input
              type="number" min="100" max="10000" step="100"
              value={getValue('files.autoSaveDelay') || 1000}
              onChange={(e) => onChange('files.autoSaveDelay', parseInt(e.target.value))}
              className="input"
              style={{ width: 100 }}
            />
          </SettingRow>
        )}
      </SettingGroup>
      
      <SettingGroup title="Formatting">
        <SettingRow label="Trim Trailing Whitespace" description="Remove trailing spaces on save">
          <Toggle 
            value={getValue('files.trimTrailingWhitespace')} 
            onChange={(v) => onChange('files.trimTrailingWhitespace', v)} 
          />
        </SettingRow>
        
        <SettingRow label="Insert Final Newline" description="Ensure file ends with newline">
          <Toggle 
            value={getValue('files.insertFinalNewline')} 
            onChange={(v) => onChange('files.insertFinalNewline', v)} 
          />
        </SettingRow>
        
        <SettingRow label="End of Line" description="Line ending format">
          <select
            value={getValue('files.eol') || 'auto'}
            onChange={(e) => onChange('files.eol', e.target.value)}
            className="input"
            style={{ width: 100 }}
          >
            <option value="auto">Auto</option>
            <option value="lf">LF</option>
            <option value="crlf">CRLF</option>
          </select>
        </SettingRow>
      </SettingGroup>
      
      <SettingGroup title="Excluded Files">
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          Files and folders matching these patterns will be hidden from the explorer
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {excludeList.map(pattern => (
            <motion.span
              key={pattern}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px 4px 12px', background: 'var(--muted)',
                borderRadius: 20, fontSize: 12
              }}
            >
              {pattern}
              <motion.button
                onClick={() => removeExclude(pattern)}
                whileHover={{ scale: 1.1 }}
                style={{
                  width: 18, height: 18, border: 'none', background: 'transparent',
                  borderRadius: '50%', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)'
                }}
              >
                <X size={12} />
              </motion.button>
            </motion.span>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={addExclude}>
          + Add Pattern
        </button>
      </SettingGroup>
    </div>
  );
}

function KeybindingsSettings({ settings, onChange, getValue }) {
  const keybindings = getValue('keybindings') || {};
  
  const keybindingLabels = {
    save: 'Save File',
    saveAll: 'Save All Files',
    openFile: 'Open File',
    openFolder: 'Open Folder',
    closeFile: 'Close File',
    closeAllFiles: 'Close All Files',
    newFile: 'New File',
    find: 'Find',
    findAndReplace: 'Find and Replace',
    findInFiles: 'Find in Files',
    goToLine: 'Go to Line',
    goToFile: 'Go to File',
    commandPalette: 'Command Palette',
    toggleTerminal: 'Toggle Terminal',
    toggleSidebar: 'Toggle Sidebar',
    toggleAIPanel: 'Toggle AI Panel',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    zoomReset: 'Reset Zoom',
    formatDocument: 'Format Document',
    commentLine: 'Toggle Comment',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>
        Click on a keybinding to change it. Use Cmd/Ctrl + key combinations.
      </p>
      
      {Object.entries(keybindingLabels).map(([key, label]) => (
        <SettingRow key={key} label={label}>
          <input
            type="text"
            value={keybindings[key] || ''}
            onChange={(e) => onChange(`keybindings.${key}`, e.target.value)}
            className="input"
            style={{ width: 150, textAlign: 'center', fontFamily: 'monospace' }}
            placeholder="Enter shortcut"
          />
        </SettingRow>
      ))}
    </div>
  );
}

// Utility Components
function SettingGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h4 style={{ 
        fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', 
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 
      }}>
        {title}
      </h4>
      <div style={{ 
        background: 'var(--secondary)', borderRadius: 10, 
        border: '1px solid var(--border)', padding: 16 
      }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: value ? 'var(--primary)' : 'var(--muted)',
        cursor: 'pointer', position: 'relative', padding: 2
      }}
    >
      <motion.div
        animate={{ x: value ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 20, height: 20, borderRadius: 10,
          background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </motion.button>
  );
}

export default SettingsModal;
