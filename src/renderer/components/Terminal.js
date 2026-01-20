import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal as TerminalIcon, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { themes } from '../lib/themes';

const { ipcRenderer } = window.require('electron');

function Terminal({ workspacePath, settings }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [terminalId] = useState(() => `term-${Date.now()}`);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const terminalSettings = settings?.terminal || {};
  const currentTheme = themes[settings?.theme] || themes['idec-dark'];

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: currentTheme.colors.background,
        foreground: currentTheme.colors.foreground,
        cursor: currentTheme.colors.primary,
        cursorAccent: currentTheme.colors.background,
        selection: currentTheme.colors.primary + '40',
        black: currentTheme.colors.secondary,
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: currentTheme.colors.primary,
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: currentTheme.colors.foreground,
        brightBlack: currentTheme.colors.mutedForeground,
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa'
      },
      fontFamily: terminalSettings.fontFamily || "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
      fontSize: terminalSettings.fontSize || 13,
      fontWeight: '400',
      lineHeight: terminalSettings.lineHeight || 1.5,
      cursorBlink: terminalSettings.cursorBlink !== false,
      cursorStyle: terminalSettings.cursorStyle || 'bar',
      cursorWidth: 2,
      scrollback: terminalSettings.scrollback || 10000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Store refs before async operations
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    
    // Initial fit
    setTimeout(() => fitAddon.fit(), 50);

    // Use workspacePath or get home dir via IPC (process.env.HOME not available with contextIsolation)
    const getCwd = async () => {
      if (workspacePath) return workspacePath;
      try {
        return await ipcRenderer.invoke('get-home-dir');
      } catch {
        return '/';
      }
    };
    getCwd().then(async cwd => {
      console.log('[Terminal] Creating terminal with cwd:', cwd);
      const result = await ipcRenderer.invoke('terminal-create', terminalId, cwd);
      console.log('[Terminal] Create result:', result);
      if (result.success) {
        // Give shell time to initialize, then resize to ensure proper rendering
        setTimeout(() => {
          fitAddon.fit();
          console.log('[Terminal] Focusing terminal after init');
          // Don't auto-focus - let user click to focus
        }, 100);
      }
    });

    const handleTerminalData = (_, id, data) => { if (id === terminalId) term.write(data); };
    const handleTerminalExit = (_, id, code) => {
      if (id === terminalId) term.write(`\r\n\x1b[38;5;241m[Process exited: ${code}]\x1b[0m\r\n`);
    };

    ipcRenderer.on('terminal-data', handleTerminalData);
    ipcRenderer.on('terminal-exit', handleTerminalExit);
    term.onData((data) => {
      console.log('[Terminal] User typed, sending to pty:', data.length, 'chars');
      ipcRenderer.invoke('terminal-write', terminalId, data);
    });
    term.onResize(({ cols, rows }) => ipcRenderer.invoke('terminal-resize', terminalId, cols, rows));

    const handleResize = () => setTimeout(() => fitAddon.fit(), 50);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ipcRenderer.removeListener('terminal-data', handleTerminalData);
      ipcRenderer.removeListener('terminal-exit', handleTerminalExit);
      ipcRenderer.invoke('terminal-kill', terminalId);
      term.dispose();
    };
  }, [terminalId]);

  useEffect(() => {
    const observer = new ResizeObserver(() => setTimeout(() => fitAddonRef.current?.fit(), 50));
    if (terminalRef.current) observer.observe(terminalRef.current);
    return () => observer.disconnect();
  }, []);

  // Update terminal options when settings change (without recreating)
  useEffect(() => {
    if (!xtermRef.current) return;
    
    const term = xtermRef.current;
    term.options.fontSize = terminalSettings.fontSize || 13;
    term.options.fontFamily = terminalSettings.fontFamily || "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace";
    term.options.lineHeight = terminalSettings.lineHeight || 1.5;
    term.options.cursorBlink = terminalSettings.cursorBlink !== false;
    term.options.cursorStyle = terminalSettings.cursorStyle || 'bar';
    term.options.theme = {
      background: currentTheme.colors.background,
      foreground: currentTheme.colors.foreground,
      cursor: currentTheme.colors.primary,
      cursorAccent: currentTheme.colors.background,
      selection: currentTheme.colors.primary + '40',
      black: currentTheme.colors.secondary,
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: currentTheme.colors.primary,
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: currentTheme.colors.foreground,
      brightBlack: currentTheme.colors.mutedForeground,
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#fafafa'
    };
    
    // Refit after font changes
    setTimeout(() => fitAddonRef.current?.fit(), 50);
  }, [terminalSettings.fontSize, terminalSettings.fontFamily, terminalSettings.lineHeight, 
      terminalSettings.cursorBlink, terminalSettings.cursorStyle, currentTheme]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: currentTheme.colors.background,
      borderTop: '1px solid var(--border)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: 40,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)'
      }}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            fontSize: 12,
            fontWeight: 500
          }}
        >
          <TerminalIcon size={14} style={{ color: 'var(--primary)' }} />
          <span>Terminal</span>
        </motion.div>
        
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton onClick={() => { xtermRef.current?.clear(); xtermRef.current?.focus(); }} icon={<Trash2 size={14} />} />
          <IconButton
            onClick={() => { setIsMaximized(!isMaximized); setTimeout(() => fitAddonRef.current?.fit(), 100); }}
            icon={isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          />
        </div>
      </div>
      
      <div 
        ref={terminalRef} 
        style={{ flex: 1, padding: 12, overflow: 'hidden', cursor: 'text' }} 
        onClick={(e) => {
          // Prevent event from propagating and stealing focus
          e.stopPropagation();
          console.log('[Terminal] Container clicked, focusing terminal');
          if (xtermRef.current) {
            xtermRef.current.focus();
            // Also click the actual xterm element to ensure focus
            const xtermElement = terminalRef.current?.querySelector('.xterm-helper-textarea');
            if (xtermElement) {
              xtermElement.focus();
            }
          }
        }}
        onFocus={() => xtermRef.current?.focus()}
        tabIndex={0}
      />
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
        width: 28, height: 28, background: 'transparent', border: 'none',
        borderRadius: 6, cursor: 'pointer', color: 'var(--muted-foreground)', transition: 'color 150ms ease'
      }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
    >
      {icon}
    </motion.button>
  );
}

export default Terminal;
