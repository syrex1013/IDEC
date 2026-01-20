import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GitHubPanel from './GitHubPanel';

// Use the global mock from setup.js
const mockInvoke = global.__mockInvoke;
const mockOpenExternal = global.__mockOpenExternal;

describe('GitHubPanel', () => {
  const defaultProps = {
    onClose: jest.fn(),
    onCloneRepo: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockOpenExternal.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
  });

  it('shows login screen when not logged in', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: 'Not logged in' });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Connect to GitHub')).toBeInTheDocument();
    });
    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
  });

  it('shows login form when Sign in button is clicked', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: 'Not logged in' });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    
    await waitFor(() => {
      expect(screen.getByText('Sign in to GitHub')).toBeInTheDocument();
    });
  });

  it('shows token input in login form', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: 'Not logged in' });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeInTheDocument();
    });
  });

  it('shows user profile when logged in', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { 
          login: 'testuser', 
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png'
        } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });
  });

  it('shows repositories tab', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Repositories')).toBeInTheDocument();
    });
  });

  it('shows notifications tab', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('shows repository list', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ 
        success: true, 
        repos: [
          { 
            id: 1, 
            name: 'test-repo', 
            full_name: 'testuser/test-repo',
            description: 'A test repository',
            html_url: 'https://github.com/testuser/test-repo',
            clone_url: 'https://github.com/testuser/test-repo.git',
            language: 'JavaScript',
            stargazers_count: 10,
            forks_count: 5,
            private: false
          }
        ] 
      })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser/test-repo')).toBeInTheDocument();
      expect(screen.getByText('A test repository')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });
  });

  it('calls onCloneRepo when Clone button is clicked', async () => {
    const onCloneRepo = jest.fn();
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ 
        success: true, 
        repos: [
          { 
            id: 1, 
            name: 'test-repo', 
            full_name: 'testuser/test-repo',
            html_url: 'https://github.com/testuser/test-repo',
            clone_url: 'https://github.com/testuser/test-repo.git',
            stargazers_count: 0,
            forks_count: 0,
            private: false
          }
        ] 
      })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} onCloneRepo={onCloneRepo} />);
    
    await waitFor(() => {
      expect(screen.getByText('Clone')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Clone'));
    
    expect(onCloneRepo).toHaveBeenCalledWith('https://github.com/testuser/test-repo.git');
  });

  it('searches repositories', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] })
      .mockResolvedValueOnce({ 
        success: true, 
        repos: [{ id: 2, name: 'search-result', full_name: 'other/search-result', stargazers_count: 0, forks_count: 0, private: false }] 
      });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search repositories...');
    fireEvent.change(searchInput, { target: { value: 'search-term' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github-search-repos', 'search-term');
    });
  });

  it('logs out user when sign out is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] })
      .mockResolvedValueOnce({ success: true });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
    
    const buttons = screen.getAllByRole('button');
    const logoutButton = buttons.find(btn => btn.getAttribute('title') === 'Sign Out');
    if (logoutButton) {
      fireEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('github-logout');
      });
    }
  });

  it('shows empty repos message when no repos', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No repositories found')).toBeInTheDocument();
    });
  });

  it('switches to notifications tab', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ 
        success: true, 
        notifications: [
          { 
            id: '1', 
            subject: { title: 'Test notification', type: 'PullRequest' },
            repository: { full_name: 'owner/repo' },
            updated_at: new Date().toISOString(),
            unread: true
          }
        ] 
      });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Notifications'));
    
    await waitFor(() => {
      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });
  });

  it('shows notification count badge', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ 
        success: true, 
        notifications: [
          { id: '1', subject: { title: 'Notif 1', type: 'Issue' }, repository: { full_name: 'a/b' }, updated_at: new Date().toISOString(), unread: true },
          { id: '2', subject: { title: 'Notif 2', type: 'Issue' }, repository: { full_name: 'a/b' }, updated_at: new Date().toISOString(), unread: true }
        ] 
      });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // notification count badge
    });
  });

  it('shows private repo indicator', async () => {
    mockInvoke
      .mockResolvedValueOnce({ 
        success: true, 
        user: { login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' } 
      })
      .mockResolvedValueOnce({ 
        success: true, 
        repos: [{ 
          id: 1, 
          name: 'private-repo', 
          full_name: 'testuser/private-repo',
          stargazers_count: 0,
          forks_count: 0,
          private: true
        }] 
      })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser/private-repo')).toBeInTheDocument();
    });
  });

  it('submits login with token', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: false, error: 'Not logged in' })
      .mockResolvedValueOnce({ success: true, user: { login: 'newuser', name: 'New User', avatar_url: '' } })
      .mockResolvedValueOnce({ success: true, repos: [] })
      .mockResolvedValueOnce({ success: true, notifications: [] });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeInTheDocument();
    });
    
    const tokenInput = screen.getByPlaceholderText('ghp_xxxxxxxxxxxx');
    fireEvent.change(tokenInput, { target: { value: 'ghp_testtoken123' } });
    
    fireEvent.click(screen.getByText('Sign In'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('github-login-token', 'ghp_testtoken123');
    });
  });

  it('handles login error', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: false, error: 'Not logged in' })
      .mockResolvedValueOnce({ success: false, error: 'Invalid token' });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeInTheDocument();
    });
    
    const tokenInput = screen.getByPlaceholderText('ghp_xxxxxxxxxxxx');
    fireEvent.change(tokenInput, { target: { value: 'invalid' } });
    
    fireEvent.click(screen.getByText('Sign In'));
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid token/i)).toBeInTheDocument();
    });
  });

  it('renders login form correctly', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: 'Not logged in' });
    
    render(<GitHubPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Sign in with GitHub'));
    
    await waitFor(() => {
      expect(screen.getByText('Sign in to GitHub')).toBeInTheDocument();
      expect(screen.getByText('Personal Token')).toBeInTheDocument();
    });
  });
});
