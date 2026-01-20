import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, FolderPlus, Terminal, Bot, Settings, Package, GitBranch, Github } from 'lucide-react';

function Toolbar({ 
  onOpenFolder, 
  onCreateProject,
  onCloneRepo,
  onToggleTerminal, 
  onToggleAI, 
  onToggleGit,
  onToggleGitHub,
  onOpenSettings, 
  onOpenExtensions, 
  showTerminal, 
  showAIPanel,
  showGitPanel,
  showGitHubPanel,
  gitHubUser
}) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
  
  return (
    <motion.header 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        paddingLeft: isMac ? 80 : 16,
        background: '#0f0f11',
        borderBottom: '1px solid #27272a',
        WebkitAppRegion: 'drag',
        color: '#fafafa'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' }}>
        <motion.div 
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8 }}
          whileHover={{ backgroundColor: 'var(--muted)' }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
          >
            <Bot size={20} style={{ color: 'var(--primary)' }} />
          </motion.div>
          <span style={{ 
            fontSize: 14, 
            fontWeight: 600,
            background: 'linear-gradient(135deg, var(--foreground), var(--muted-foreground))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            IDEC
          </span>
        </motion.div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' }}>
        <ToolbarButton onClick={onCreateProject} icon={<FolderPlus size={16} />} label="New" />
        <ToolbarButton onClick={onOpenFolder} icon={<FolderOpen size={16} />} label="Open" />
        <ToolbarButton onClick={onCloneRepo} icon={<Github size={16} />} label="Clone" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' }}>
        <ToolbarButton onClick={onToggleGit} icon={<GitBranch size={16} />} active={showGitPanel} />
        <ToolbarButton 
          onClick={onToggleGitHub} 
          icon={gitHubUser ? (
            <img 
              src={gitHubUser.avatar_url} 
              alt="" 
              style={{ width: 18, height: 18, borderRadius: '50%' }}
            />
          ) : <Github size={16} />} 
          active={showGitHubPanel}
        />
        <ToolbarButton onClick={onToggleTerminal} icon={<Terminal size={16} />} active={showTerminal} />
        <ToolbarButton onClick={onToggleAI} icon={<Bot size={16} />} active={showAIPanel} />
        <ToolbarButton onClick={onOpenExtensions} icon={<Package size={16} />} />
        <ToolbarButton onClick={onOpenSettings} icon={<Settings size={16} />} />
      </div>
    </motion.header>
  );
}

function ToolbarButton({ onClick, icon, label, active }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: label ? '8px 12px' : 8,
        background: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        transition: 'all 150ms ease'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--muted)';
          e.currentTarget.style.color = 'var(--foreground)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--muted-foreground)';
        }
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </motion.button>
  );
}

export default Toolbar;
