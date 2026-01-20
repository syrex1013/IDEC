import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, FileCode, Hexagon, FileJson, Terminal } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

const projectTypes = [
  { id: 'empty', name: 'Empty Project', icon: FolderPlus, description: 'Start with a blank project' },
  { id: 'javascript', name: 'JavaScript', icon: FileJson, description: 'Node.js with package.json' },
  { id: 'react', name: 'React', icon: Hexagon, description: 'React application boilerplate' },
  { id: 'python', name: 'Python', icon: Terminal, description: 'Python with main.py and requirements.txt' },
];

function CreateProjectModal({ onClose, onProjectCreated }) {
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [selectedType, setSelectedType] = useState('empty');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSelectLocation = async () => {
    const path = await ipcRenderer.invoke('select-directory');
    if (path) setProjectPath(path);
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !projectPath) {
      setError('Please enter a project name and select a location');
      return;
    }

    setCreating(true);
    setError('');

    const fullPath = `${projectPath}/${projectName}`;
    const result = await ipcRenderer.invoke('create-project', fullPath, selectedType);

    if (result.success) {
      onProjectCreated(result.path);
      onClose();
    } else {
      setError(result.error || 'Failed to create project');
    }
    setCreating(false);
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
          width: 500,
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
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
            Create New Project
          </h2>
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
          {/* Project Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 12, 
              fontWeight: 500, 
              color: 'var(--muted-foreground)',
              marginBottom: 6
            }}>
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
              placeholder="my-project"
              className="input"
              autoFocus
            />
          </div>

          {/* Location */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 12, 
              fontWeight: 500, 
              color: 'var(--muted-foreground)',
              marginBottom: 6
            }}>
              Location
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
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
                Browse
              </motion.button>
            </div>
          </div>

          {/* Project Type */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              fontSize: 12, 
              fontWeight: 500, 
              color: 'var(--muted-foreground)',
              marginBottom: 8
            }}>
              Project Template
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {projectTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--secondary)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Icon size={18} style={{ color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                    <div>
                      <p style={{ 
                        fontSize: 13, 
                        fontWeight: 500, 
                        color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)'
                      }}>
                        {type.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {type.description}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--destructive)'
            }}>
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
              onClick={handleCreate}
              disabled={creating || !projectName || !projectPath}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary"
              style={{ minWidth: 100 }}
            >
              {creating ? 'Creating...' : 'Create'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CreateProjectModal;
