import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Github, LogIn, LogOut, User, GitFork, Star, Eye, Lock, Unlock,
  Plus, Search, RefreshCw, ExternalLink, Bell, FileCode, X,
  ChevronRight, GitPullRequest, AlertCircle, Copy, Check, Key
} from 'lucide-react';

const { ipcRenderer, shell } = window.require('electron');

function GitHubPanel({ onClose, onCloneRepo }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('repos');
  const [repos, setRepos] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showLogin, setShowLogin] = useState(false);

  // Check login status on mount
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    setLoading(true);
    const result = await ipcRenderer.invoke('github-get-user');
    if (result.success) {
      setUser(result.user);
      loadUserData();
    }
    setLoading(false);
  };

  const loadUserData = async () => {
    const [reposResult, notifResult] = await Promise.all([
      ipcRenderer.invoke('github-repos'),
      ipcRenderer.invoke('github-notifications')
    ]);
    
    if (reposResult.success) setRepos(reposResult.repos);
    if (notifResult.success) setNotifications(notifResult.notifications);
  };

  const handleLogout = async () => {
    await ipcRenderer.invoke('github-logout');
    setUser(null);
    setRepos([]);
    setNotifications([]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const result = await ipcRenderer.invoke('github-search-repos', searchQuery);
    if (result.success) {
      setSearchResults(result.repos);
      setActiveTab('search');
    }
    setLoading(false);
  };

  const handleClone = (repo) => {
    onCloneRepo?.(repo.clone_url);
  };

  const openInBrowser = (url) => {
    shell.openExternal(url);
  };

  if (loading && !user) {
    return (
      <Panel onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <RefreshCw size={24} className="spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      </Panel>
    );
  }

  if (!user) {
    return (
      <Panel onClose={onClose}>
        {showLogin ? (
          <LoginForm onSuccess={(u) => { setUser(u); setShowLogin(false); loadUserData(); }} onBack={() => setShowLogin(false)} />
        ) : (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Github size={48} style={{ color: 'var(--muted-foreground)', marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Connect to GitHub</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>
              Sign in to access your repositories, create issues, and more.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLogin(true)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <LogIn size={16} style={{ marginRight: 8 }} />
              Sign in with GitHub
            </motion.button>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* User Header */}
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img 
              src={user.avatar_url} 
              alt={user.login}
              style={{ width: 32, height: 32, borderRadius: '50%' }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>{user.name || user.login}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>@{user.login}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton onClick={() => openInBrowser(`https://github.com/${user.login}`)} icon={<ExternalLink size={14} />} title="Open Profile" />
            <IconButton onClick={loadUserData} icon={<RefreshCw size={14} />} title="Refresh" />
            <IconButton onClick={handleLogout} icon={<LogOut size={14} />} title="Sign Out" />
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search repositories..."
              className="input"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSearch}
              className="btn btn-secondary btn-sm"
            >
              <Search size={14} />
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <TabButton active={activeTab === 'repos'} onClick={() => setActiveTab('repos')}>
            Repositories
          </TabButton>
          <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>
            Notifications {notifications.length > 0 && <Badge>{notifications.length}</Badge>}
          </TabButton>
          {searchResults.length > 0 && (
            <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
              Search
            </TabButton>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {activeTab === 'repos' && (
            <RepoList repos={repos} onClone={handleClone} onOpen={openInBrowser} />
          )}
          {activeTab === 'notifications' && (
            <NotificationList notifications={notifications} onOpen={openInBrowser} />
          )}
          {activeTab === 'search' && (
            <RepoList repos={searchResults} onClone={handleClone} onOpen={openInBrowser} />
          )}
        </div>
      </div>
    </Panel>
  );
}

function LoginForm({ onSuccess, onBack }) {
  const [method, setMethod] = useState('token'); // 'token' or 'device'
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleTokenLogin = async () => {
    if (!token.trim()) {
      setError('Please enter a personal access token');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await ipcRenderer.invoke('github-login-token', token);
    
    if (result.success) {
      onSuccess(result.user);
    } else {
      setError(result.error || 'Invalid token');
    }
    setLoading(false);
  };

  const copyCode = () => {
    if (deviceInfo?.userCode) {
      navigator.clipboard.writeText(deviceInfo.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}
        >
          <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
        </motion.button>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Sign in to GitHub</h3>
      </div>

      {/* Method Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <MethodButton 
          active={method === 'token'} 
          onClick={() => setMethod('token')}
          icon={<Key size={14} />}
          label="Personal Token"
        />
      </div>

      {method === 'token' && (
        <>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
            Create a <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); require('electron').shell.openExternal('https://github.com/settings/tokens/new?scopes=repo,user,read:org&description=IDEC'); }}
              style={{ color: 'var(--primary)' }}
            >personal access token</a> with repo and user scopes.
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            className="input"
            style={{ marginBottom: 12 }}
            autoFocus
          />
        </>
      )}

      {error && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 12,
          color: 'var(--destructive)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleTokenLogin}
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%' }}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </motion.button>
    </div>
  );
}

function MethodButton({ active, onClick, icon, label }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        background: active ? 'rgba(59, 130, 246, 0.1)' : 'var(--secondary)',
        border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        color: active ? 'var(--primary)' : 'var(--muted-foreground)'
      }}
    >
      {icon}
      {label}
    </motion.button>
  );
}

function RepoList({ repos, onClone, onOpen }) {
  if (repos.length === 0) {
    return <EmptyState message="No repositories found" />;
  }

  return (
    <div>
      {repos.map((repo, i) => (
        <motion.div
          key={repo.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            marginBottom: 4,
            cursor: 'pointer'
          }}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {repo.private ? <Lock size={12} style={{ color: 'var(--muted-foreground)' }} /> : <Unlock size={12} style={{ color: 'var(--muted-foreground)' }} />}
                <span 
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => onOpen(repo.html_url)}
                >
                  {repo.full_name || repo.name}
                </span>
              </div>
              {repo.description && (
                <p style={{ 
                  fontSize: 11, 
                  color: 'var(--muted-foreground)', 
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {repo.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>
                {repo.language && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getLanguageColor(repo.language) }} />
                    {repo.language}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={11} /> {repo.stargazers_count}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <GitFork size={11} /> {repo.forks_count}
                </span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onClone(repo); }}
              style={{
                padding: '4px 8px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Clone
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function NotificationList({ notifications, onOpen }) {
  if (notifications.length === 0) {
    return <EmptyState message="No notifications" />;
  }

  return (
    <div>
      {notifications.map((notif, i) => (
        <motion.div
          key={notif.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          onClick={() => onOpen(notif.subject.url?.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/'))}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            marginBottom: 4,
            cursor: 'pointer'
          }}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ marginTop: 2 }}>
              {notif.subject.type === 'PullRequest' ? (
                <GitPullRequest size={14} style={{ color: '#8b5cf6' }} />
              ) : notif.subject.type === 'Issue' ? (
                <AlertCircle size={14} style={{ color: '#22c55e' }} />
              ) : (
                <Bell size={14} style={{ color: 'var(--muted-foreground)' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{notif.subject.title}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {notif.repository.full_name}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Github size={16} style={{ color: 'var(--foreground)' }} />
          <span style={{ 
            fontSize: 11, 
            fontWeight: 600, 
            color: 'var(--muted-foreground)', 
            textTransform: 'uppercase',
            letterSpacing: 0.8
          }}>
            GitHub
          </span>
        </div>
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

function IconButton({ onClick, icon, title, disabled }) {
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
        width: 28,
        height: 28,
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--muted-foreground)',
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
      background: 'var(--primary)',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 600,
      color: 'white'
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

function getLanguageColor(language) {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    Swift: '#ffac45',
    Kotlin: '#A97BFF',
    Dart: '#00B4AB',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Vue: '#41b883',
    React: '#61dafb'
  };
  return colors[language] || '#8b8b8b';
}

export default GitHubPanel;
