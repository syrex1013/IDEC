import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, GitCommit, GitPullRequest, Plus, Minus, Check, X, 
  RefreshCw, Upload, Download, ChevronDown, ChevronRight, History,
  FileCode, Trash2
} from 'lucide-react';

const { ipcRenderer } = window.require('electron');

function GitPanel({ workspacePath, onClose }) {
  const [isRepo, setIsRepo] = useState(false);
  const [branch, setBranch] = useState('');
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('changes');
  const [expandedSections, setExpandedSections] = useState({ staged: true, unstaged: true });

  const stagedFiles = files.filter(f => ['A', 'M', 'D', 'R'].includes(f.status[0]) && f.status[0] !== '?');
  const unstagedFiles = files.filter(f => f.status.includes('?') || f.status[1] !== ' ');

  const refresh = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    
    const repoCheck = await ipcRenderer.invoke('git-is-repo', workspacePath);
    setIsRepo(repoCheck.isRepo);
    
    if (repoCheck.isRepo) {
      const status = await ipcRenderer.invoke('git-status', workspacePath);
      if (status.success) {
        setBranch(status.branch);
        setFiles(status.files);
      }
      
      const logResult = await ipcRenderer.invoke('git-log', workspacePath, 20);
      if (logResult.success) {
        setCommits(logResult.commits);
      }
    }
    setLoading(false);
  }, [workspacePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInit = async () => {
    const result = await ipcRenderer.invoke('git-init', workspacePath);
    if (result.success) refresh();
  };

  const handleStage = async (filePath) => {
    await ipcRenderer.invoke('git-stage', workspacePath, filePath);
    refresh();
  };

  const handleUnstage = async (filePath) => {
    await ipcRenderer.invoke('git-unstage', workspacePath, filePath);
    refresh();
  };

  const handleStageAll = async () => {
    await ipcRenderer.invoke('git-stage-all', workspacePath);
    refresh();
  };

  const handleDiscard = async (filePath) => {
    if (confirm(`Discard changes to ${filePath}?`)) {
      await ipcRenderer.invoke('git-discard', workspacePath, filePath);
      refresh();
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    const result = await ipcRenderer.invoke('git-commit', workspacePath, commitMessage);
    if (result.success) {
      setCommitMessage('');
      refresh();
    }
  };

  const handlePush = async () => {
    setLoading(true);
    await ipcRenderer.invoke('git-push', workspacePath);
    setLoading(false);
  };

  const handlePull = async () => {
    setLoading(true);
    await ipcRenderer.invoke('git-pull', workspacePath);
    refresh();
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusIcon = (status) => {
    if (status.includes('?')) return <Plus size={12} style={{ color: '#22c55e' }} />;
    if (status.includes('M')) return <FileCode size={12} style={{ color: '#eab308' }} />;
    if (status.includes('D')) return <Minus size={12} style={{ color: '#ef4444' }} />;
    if (status.includes('A')) return <Plus size={12} style={{ color: '#22c55e' }} />;
    return <FileCode size={12} />;
  };

  if (!workspacePath) {
    return (
      <Panel onClose={onClose}>
        <EmptyState message="Open a folder to use Git" />
      </Panel>
    );
  }

  if (!isRepo) {
    return (
      <Panel onClose={onClose}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <GitBranch size={48} style={{ color: 'var(--muted-foreground)', opacity: 0.5, marginBottom: 16 }} />
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 16 }}>
            This folder is not a Git repository
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInit}
            className="btn btn-primary"
          >
            Initialize Repository
          </motion.button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{branch || 'main'}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton onClick={handlePull} icon={<Download size={14} />} title="Pull" disabled={loading} />
            <IconButton onClick={handlePush} icon={<Upload size={14} />} title="Push" disabled={loading} />
            <IconButton onClick={refresh} icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />} title="Refresh" />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <TabButton active={activeTab === 'changes'} onClick={() => setActiveTab('changes')}>
            Changes {files.length > 0 && <Badge>{files.length}</Badge>}
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            History
          </TabButton>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'changes' ? (
            <div>
              {/* Commit Input */}
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 8,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--foreground)',
                    fontSize: 13,
                    resize: 'none',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || stagedFiles.length === 0}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <Check size={14} style={{ marginRight: 4 }} />
                    Commit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStageAll}
                    className="btn btn-secondary btn-sm"
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Stage All
                  </motion.button>
                </div>
              </div>

              {/* Staged Files */}
              <FileSection
                title="Staged Changes"
                files={stagedFiles}
                expanded={expandedSections.staged}
                onToggle={() => toggleSection('staged')}
                renderActions={(file) => (
                  <IconButton onClick={() => handleUnstage(file.path)} icon={<Minus size={12} />} small />
                )}
                getStatusIcon={getStatusIcon}
              />

              {/* Unstaged Files */}
              <FileSection
                title="Changes"
                files={unstagedFiles}
                expanded={expandedSections.unstaged}
                onToggle={() => toggleSection('unstaged')}
                renderActions={(file) => (
                  <>
                    <IconButton onClick={() => handleStage(file.path)} icon={<Plus size={12} />} small />
                    <IconButton onClick={() => handleDiscard(file.path)} icon={<Trash2 size={12} />} small destructive />
                  </>
                )}
                getStatusIcon={getStatusIcon}
              />
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {commits.map((commit, i) => (
                <motion.div
                  key={commit.hash}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    marginBottom: 4,
                    cursor: 'pointer'
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <GitCommit size={14} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ 
                        fontSize: 13, 
                        color: 'var(--foreground)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {commit.message}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {commit.shortHash} • {commit.author} • {commit.relative}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {commits.length === 0 && (
                <EmptyState message="No commits yet" />
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Panel({ children, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ 
          fontSize: 11, 
          fontWeight: 600, 
          color: 'var(--muted-foreground)', 
          textTransform: 'uppercase',
          letterSpacing: 0.8
        }}>
          Source Control
        </span>
        {onClose && (
          <IconButton onClick={onClose} icon={<X size={14} />} />
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </div>
    </motion.div>
  );
}

function FileSection({ title, files, expanded, onToggle, renderActions, getStatusIcon }) {
  if (files.length === 0) return null;
  
  return (
    <div>
      <motion.div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--muted-foreground)'
        }}
        whileHover={{ color: 'var(--foreground)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        <Badge>{files.length}</Badge>
      </motion.div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {files.map((file) => (
              <motion.div
                key={file.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px 6px 32px',
                  fontSize: 12,
                  color: 'var(--muted-foreground)'
                }}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--foreground)' }}
              >
                {getStatusIcon(file.status)}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.path}
                </span>
                <div style={{ display: 'flex', gap: 2, opacity: 0.7 }} className="file-actions">
                  {renderActions(file)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ children, active, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }}
      whileHover={{ color: 'var(--foreground)' }}
    >
      {children}
    </motion.button>
  );
}

function IconButton({ onClick, icon, title, disabled, small, destructive }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: small ? 20 : 24,
        height: small ? 20 : 24,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: destructive ? 'var(--destructive)' : 'var(--muted-foreground)',
        opacity: disabled ? 0.5 : 1
      }}
    >
      {icon}
    </motion.button>
  );
}

function Badge({ children }) {
  return (
    <span style={{
      padding: '1px 6px',
      background: 'var(--muted)',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--muted-foreground)'
    }}>
      {children}
    </span>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ 
      padding: 24, 
      textAlign: 'center', 
      color: 'var(--muted-foreground)',
      fontSize: 13
    }}>
      {message}
    </div>
  );
}

export default GitPanel;
