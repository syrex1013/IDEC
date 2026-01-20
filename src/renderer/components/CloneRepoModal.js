import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Github, Download, FolderOpen, AlertCircle } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

function CloneRepoModal({ onClose, onCloneComplete, initialUrl = '' }) {
  const [repoUrl, setRepoUrl] = useState(initialUrl);
  const [targetPath, setTargetPath] = useState('');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (initialUrl) setRepoUrl(initialUrl);
  }, [initialUrl]);

  const handleSelectLocation = async () => {
    const path = await ipcRenderer.invoke('select-directory');
    if (path) setTargetPath(path);
  };

  const extractRepoName = (url) => {
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    return match ? match[1].replace('.git', '') : 'repo';
  };

  const handleClone = async () => {
    if (!repoUrl.trim() || !targetPath) {
      setError('Please enter a repository URL and select a location');
      return;
    }

    // Validate URL format
    const isValidUrl = repoUrl.match(/^(https?:\/\/|git@).+\.(git|com|org|io)/i) || 
                       repoUrl.match(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+$/);
    if (!isValidUrl) {
      setError('Invalid repository URL. Use HTTPS URL or owner/repo format');
      return;
    }

    setCloning(true);
    setError('');
    setProgress('Cloning repository...');

    let url = repoUrl;
    // Convert shorthand to full URL
    if (repoUrl.match(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+$/)) {
      url = `https://github.com/${repoUrl}.git`;
    }

    const repoName = extractRepoName(url);
    const fullPath = `${targetPath}/${repoName}`;

    const result = await ipcRenderer.invoke('git-clone', url, fullPath);

    if (result.success) {
      setProgress('Clone complete!');
      setTimeout(() => {
        onCloneComplete(result.path);
        onClose();
      }, 500);
    } else {
      setError(result.error || 'Failed to clone repository');
      setProgress('');
    }
    setCloning(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          background: 'var(--card)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Github size={20} style={{ color: 'var(--foreground)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              Clone Repository
            </h2>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              padding: 4
            }}
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {/* Repository URL */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 12, 
              fontWeight: 500, 
              color: 'var(--muted-foreground)',
              marginBottom: 6
            }}>
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo.git or owner/repo"
              className="input"
              autoFocus
            />
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
              Enter HTTPS URL or GitHub shorthand (e.g., facebook/react)
            </p>
          </div>

          {/* Clone Location */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 12, 
              fontWeight: 500, 
              color: 'var(--muted-foreground)',
              marginBottom: 6
            }}>
              Clone to
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="Select a folder..."
                className="input"
                style={{ flex: 1 }}
                readOnly
              />
              <motion.button
                onClick={handleSelectLocation}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-secondary"
              >
                <FolderOpen size={14} style={{ marginRight: 6 }} />
                Browse
              </motion.button>
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Download size={14} className={cloning ? 'spin' : ''} />
              {progress}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--destructive)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-secondary"
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleClone}
              disabled={cloning || !repoUrl || !targetPath}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary"
              style={{ minWidth: 100 }}
            >
              <Download size={14} style={{ marginRight: 6 }} />
              {cloning ? 'Cloning...' : 'Clone'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CloneRepoModal;
