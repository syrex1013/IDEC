import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, AlertCircle, FileText, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';
import Terminal from './Terminal';

function BottomPanel({ workspacePath, settings, problems = [], onClose }) {
  const [activeTab, setActiveTab] = useState('terminal');
  const [isMinimized, setIsMinimized] = useState(false);
  const [outputLogs, setOutputLogs] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('all');
  
  // Listen for output logs from main process
  useEffect(() => {
    const handleOutputLog = (log) => {
      setOutputLogs(prev => [...prev.slice(-500), { // Keep last 500 logs
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        ...log
      }]);
    };
    
    // Use preload-exposed electronAPI
    const cleanup = window.electronAPI?.onOutputLog?.(handleOutputLog);
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);
  
  const clearOutput = () => {
    setOutputLogs([]);
  };
  
  const channels = ['all', ...new Set(outputLogs.map(l => l.channel).filter(Boolean))];
  
  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
    { 
      id: 'problems', 
      label: 'Problems', 
      icon: AlertCircle,
      badge: errorCount + warningCount > 0 ? errorCount + warningCount : null
    },
    { id: 'output', label: 'Output', icon: FileText },
  ];

  if (isMinimized) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: 32,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        cursor: 'pointer'
      }}
      onClick={() => setIsMinimized(false)}
      >
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          {tabs.map(tab => (
            <span 
              key={tab.id}
              style={{ 
                color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <tab.icon size={12} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  background: errorCount > 0 ? '#ef4444' : '#eab308',
                  color: '#fff',
                  fontSize: 10,
                  padding: '0 4px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  {tab.badge}
                </span>
              )}
            </span>
          ))}
        </div>
        <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background)',
      borderTop: '1px solid var(--border)'
    }}>
      {/* Tab Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        height: 36,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: activeTab === tab.id ? 'var(--background)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  background: errorCount > 0 ? '#ef4444' : '#eab308',
                  color: '#fff',
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontWeight: 600
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton onClick={() => setIsMinimized(true)} icon={<ChevronDown size={14} />} />
          {onClose && <IconButton onClick={onClose} icon={<X size={14} />} />}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'terminal' && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ height: '100%' }}
            >
              <Terminal workspacePath={workspacePath} settings={settings} />
            </motion.div>
          )}
          
          {activeTab === 'problems' && (
            <motion.div
              key="problems"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ height: '100%', overflow: 'auto' }}
            >
              <ProblemsPanel problems={problems} />
            </motion.div>
          )}
          
          {activeTab === 'output' && (
            <motion.div
              key="output"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ 
                height: '100%', 
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <OutputPanel 
                logs={outputLogs} 
                selectedChannel={selectedChannel}
                onChannelChange={setSelectedChannel}
                channels={channels}
                onClear={clearOutput}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProblemsPanel({ problems }) {
  if (problems.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--muted-foreground)',
        fontSize: 13
      }}>
        <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
        <span>No problems detected</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      {problems.map((problem, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'background 150ms ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {problem.severity === 'error' ? (
            <AlertCircle size={14} style={{ color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
          ) : (
            <AlertCircle size={14} style={{ color: '#eab308', marginTop: 2, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ 
              fontSize: 12, 
              color: 'var(--foreground)',
              wordBreak: 'break-word'
            }}>
              {problem.message}
            </div>
            <div style={{ 
              fontSize: 11, 
              color: 'var(--muted-foreground)',
              marginTop: 2
            }}>
              {problem.file}:{problem.line}:{problem.column} • {problem.source || 'typescript'}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function OutputPanel({ logs, selectedChannel, onChannelChange, channels, onClear }) {
  const scrollRef = useRef(null);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
  
  const filteredLogs = selectedChannel === 'all' 
    ? logs 
    : logs.filter(l => l.channel === selectedChannel);

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#eab308';
      case 'info': return '#3b82f6';
      case 'debug': return '#8b5cf6';
      default: return 'var(--foreground)';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Output Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)'
      }}>
        <select
          value={selectedChannel}
          onChange={(e) => onChannelChange(e.target.value)}
          style={{
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--foreground)',
            cursor: 'pointer'
          }}
        >
          {channels.map(ch => (
            <option key={ch} value={ch}>
              {ch === 'all' ? 'All Channels' : ch}
            </option>
          ))}
        </select>
        
        <button
          onClick={onClear}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--muted-foreground)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>
      
      {/* Output Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 8,
          fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
          fontSize: 12,
          lineHeight: 1.5
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--muted-foreground)'
          }}>
            <FileText size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <span>No output yet</span>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                gap: 8,
                padding: '2px 4px',
                borderRadius: 2
              }}
            >
              <span style={{ 
                color: 'var(--muted-foreground)', 
                fontSize: 10,
                minWidth: 75,
                opacity: 0.7
              }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.channel && (
                <span style={{ 
                  color: '#3b82f6',
                  fontSize: 10,
                  minWidth: 60
                }}>
                  [{log.channel}]
                </span>
              )}
              <span style={{ color: getLogColor(log.level) }}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function IconButton({ onClick, icon }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, backgroundColor: 'var(--muted)' }}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, background: 'transparent', border: 'none',
        borderRadius: 4, cursor: 'pointer', color: 'var(--muted-foreground)', transition: 'color 150ms ease'
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
    >
      {icon}
    </motion.button>
  );
}

export default BottomPanel;
