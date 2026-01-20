import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Search, Download, Trash2, Check, Star, RefreshCw,
  ExternalLink, Settings, AlertCircle, CheckCircle, Clock,
  Filter, Grid, List, X, Upload, FolderOpen
} from 'lucide-react';

const { ipcRenderer } = window.require('electron');

// Popular extensions from Open VSX registry
const featuredExtensions = [
  { 
    id: 'esbenp.prettier-vscode', 
    name: 'Prettier', 
    publisher: 'esbenp',
    description: 'Code formatter using prettier', 
    downloads: '38M',
    rating: 4.5,
    icon: '✨'
  },
  { 
    id: 'dbaeumer.vscode-eslint', 
    name: 'ESLint', 
    publisher: 'dbaeumer',
    description: 'Integrates ESLint JavaScript into VS Code', 
    downloads: '32M',
    rating: 4.6,
    icon: '🔍'
  },
  { 
    id: 'eamodio.gitlens', 
    name: 'GitLens', 
    publisher: 'eamodio',
    description: 'Supercharge Git within VS Code', 
    downloads: '25M',
    rating: 4.7,
    icon: '🔮'
  },
  { 
    id: 'ms-python.python', 
    name: 'Python', 
    publisher: 'Microsoft',
    description: 'Python language support', 
    downloads: '95M',
    rating: 4.5,
    icon: '🐍'
  },
  { 
    id: 'bradlc.vscode-tailwindcss', 
    name: 'Tailwind CSS IntelliSense', 
    publisher: 'bradlc',
    description: 'Intelligent Tailwind CSS tooling', 
    downloads: '8M',
    rating: 4.8,
    icon: '🎨'
  },
  {
    id: 'formulahendry.auto-rename-tag',
    name: 'Auto Rename Tag',
    publisher: 'formulahendry',
    description: 'Auto rename paired HTML/XML tag',
    downloads: '15M',
    rating: 4.4,
    icon: '🏷️'
  },
  {
    id: 'christian-kohler.path-intellisense',
    name: 'Path Intellisense',
    publisher: 'christian-kohler',
    description: 'Visual Studio Code plugin that autocompletes filenames',
    downloads: '12M',
    rating: 4.5,
    icon: '📁'
  },
  {
    id: 'streetsidesoftware.code-spell-checker',
    name: 'Code Spell Checker',
    publisher: 'streetsidesoftware',
    description: 'Spelling checker for source code',
    downloads: '10M',
    rating: 4.6,
    icon: '📝'
  },
];

function ExtensionMarketplace({ onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [installedExtensions, setInstalledExtensions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('browse'); // browse, installed
  const [installing, setInstalling] = useState({});
  const [viewMode, setViewMode] = useState('grid'); // grid, list

  useEffect(() => {
    loadInstalledExtensions();
  }, []);

  const loadInstalledExtensions = async () => {
    const result = await ipcRenderer.invoke('extensions-list');
    if (result.success) {
      setInstalledExtensions(result.extensions || []);
    }
  };

  const searchExtensions = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const result = await ipcRenderer.invoke('extensions-search', query);
      if (result.success) {
        setSearchResults(result.extensions || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchExtensions(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchExtensions]);

  const installExtension = async (ext) => {
    setInstalling(prev => ({ ...prev, [ext.id]: true }));
    try {
      const result = await ipcRenderer.invoke('extensions-install', ext.id);
      if (result.success) {
        await loadInstalledExtensions();
      }
    } catch (error) {
      console.error('Install failed:', error);
    }
    setInstalling(prev => ({ ...prev, [ext.id]: false }));
  };

  const uninstallExtension = async (extId) => {
    const result = await ipcRenderer.invoke('extensions-uninstall', extId);
    if (result.success) {
      await loadInstalledExtensions();
    }
  };

  const installFromFile = async () => {
    const result = await ipcRenderer.invoke('extensions-install-vsix');
    if (result.success) {
      await loadInstalledExtensions();
    }
  };

  const isInstalled = (extId) => {
    return installedExtensions.some(e => e.id === extId);
  };

  const displayExtensions = searchQuery ? searchResults : featuredExtensions;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        style={{
          width: '90%',
          maxWidth: 900,
          height: '80vh',
          maxHeight: 700,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Extensions</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={installFromFile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--foreground)',
              }}
            >
              <Upload size={14} /> Install from VSIX
            </motion.button>
            
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, backgroundColor: 'var(--muted)' }}
              whileTap={{ scale: 0.9 }}
              style={{
                width: 32,
                height: 32,
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
              }}
            >
              <X size={16} />
            </motion.button>
          </div>
        </div>

        {/* Search and Tabs */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ 
              position: 'absolute', 
              left: 10, 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--muted-foreground)' 
            }} />
            <input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
            {isSearching && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <RefreshCw size={14} style={{ color: 'var(--muted-foreground)' }} />
              </motion.div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 4 }}>
            {['browse', 'installed'].map(tab => (
              <motion.button
                key={tab}
                whileHover={{ backgroundColor: activeTab === tab ? undefined : 'var(--muted)' }}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 12px',
                  background: activeTab === tab ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: activeTab === tab ? 'white' : 'var(--muted-foreground)',
                }}
              >
                {tab === 'browse' ? 'Browse' : `Installed (${installedExtensions.length})`}
              </motion.button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 2 }}>
            <IconButton 
              icon={<Grid size={14} />} 
              active={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
            />
            <IconButton 
              icon={<List size={14} />} 
              active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeTab === 'browse' ? (
            <>
              {!searchQuery && (
                <h3 style={{ 
                  fontSize: 12, 
                  fontWeight: 600, 
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12,
                }}>
                  Featured Extensions
                </h3>
              )}
              
              <div style={{
                display: viewMode === 'grid' 
                  ? 'grid' 
                  : 'flex',
                gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined,
                flexDirection: viewMode === 'list' ? 'column' : undefined,
                gap: 12,
              }}>
                {displayExtensions.map(ext => (
                  <ExtensionCard
                    key={ext.id}
                    extension={ext}
                    installed={isInstalled(ext.id)}
                    installing={installing[ext.id]}
                    onInstall={() => installExtension(ext)}
                    onUninstall={() => uninstallExtension(ext.id)}
                    viewMode={viewMode}
                  />
                ))}
              </div>
              
              {searchQuery && displayExtensions.length === 0 && !isSearching && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 40,
                  color: 'var(--muted-foreground)',
                }}>
                  <Package size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <p>No extensions found for "{searchQuery}"</p>
                </div>
              )}
            </>
          ) : (
            <>
              {installedExtensions.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 40,
                  color: 'var(--muted-foreground)',
                }}>
                  <Package size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <p>No extensions installed</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    Browse the marketplace to find extensions
                  </p>
                </div>
              ) : (
                <div style={{
                  display: viewMode === 'grid' ? 'grid' : 'flex',
                  gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(260px, 1fr))' : undefined,
                  flexDirection: viewMode === 'list' ? 'column' : undefined,
                  gap: 12,
                }}>
                  {installedExtensions.map(ext => (
                    <ExtensionCard
                      key={ext.id}
                      extension={ext}
                      installed={true}
                      installing={installing[ext.id]}
                      onUninstall={() => uninstallExtension(ext.id)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ExtensionCard({ extension, installed, installing, onInstall, onUninstall, viewMode }) {
  const isGrid = viewMode === 'grid';
  
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      style={{
        display: 'flex',
        flexDirection: isGrid ? 'column' : 'row',
        gap: isGrid ? 12 : 16,
        padding: 16,
        background: 'var(--secondary)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        alignItems: isGrid ? 'flex-start' : 'center',
      }}
    >
      {/* Icon */}
      <div style={{
        width: isGrid ? 48 : 40,
        height: isGrid ? 48 : 40,
        borderRadius: 10,
        background: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isGrid ? 24 : 20,
        flexShrink: 0,
      }}>
        {extension.icon || '📦'}
      </div>
      
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: 'var(--foreground)',
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {extension.name}
        </div>
        <div style={{ 
          fontSize: 11, 
          color: 'var(--muted-foreground)',
          marginBottom: 6,
        }}>
          {extension.publisher}
        </div>
        <div style={{ 
          fontSize: 12, 
          color: 'var(--muted-foreground)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: isGrid ? 2 : 1,
          WebkitBoxOrient: 'vertical',
        }}>
          {extension.description}
        </div>
        
        {isGrid && (
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginTop: 8,
            fontSize: 11,
            color: 'var(--muted-foreground)',
          }}>
            {extension.downloads && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={10} /> {extension.downloads}
              </span>
            )}
            {extension.rating && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={10} style={{ color: '#fbbf24' }} /> {extension.rating}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div style={{ flexShrink: 0 }}>
        {installed ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUninstall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--destructive)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--destructive)',
            }}
          >
            <Trash2 size={12} /> Uninstall
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onInstall}
            disabled={installing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 6,
              cursor: installing ? 'wait' : 'pointer',
              fontSize: 12,
              color: 'white',
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCw size={12} />
                </motion.div>
                Installing...
              </>
            ) : (
              <>
                <Download size={12} /> Install
              </>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function IconButton({ icon, active, onClick }) {
  return (
    <motion.button
      whileHover={{ backgroundColor: active ? undefined : 'var(--muted)' }}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        background: active ? 'var(--muted)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
      }}
    >
      {icon}
    </motion.button>
  );
}

export default ExtensionMarketplace;
