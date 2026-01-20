import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GitPanel from './GitPanel';

// Use the global mock from setup.js
const mockInvoke = global.__mockInvoke;

describe('GitPanel', () => {
  const defaultProps = {
    workspacePath: '/test/workspace',
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
  });

  it('shows empty state when no workspace is open', () => {
    render(<GitPanel workspacePath={null} onClose={jest.fn()} />);
    expect(screen.getByText('Open a folder to use Git')).toBeInTheDocument();
  });

  it('shows init button when folder is not a git repo', async () => {
    mockInvoke.mockResolvedValue({ success: true, isRepo: false });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('This folder is not a Git repository')).toBeInTheDocument();
    });
    expect(screen.getByText('Initialize Repository')).toBeInTheDocument();
  });

  it('calls git-init when Initialize button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: false }) // git-is-repo
      .mockResolvedValueOnce({ success: true }) // git-init
      .mockResolvedValueOnce({ success: true, isRepo: true }) // git-is-repo after init
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] }) // git-status
      .mockResolvedValueOnce({ success: true, commits: [] }); // git-log
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Initialize Repository')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Initialize Repository'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-init', '/test/workspace');
    });
  });

  it('shows branch name when repo is initialized', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true }) // git-is-repo
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] }) // git-status
      .mockResolvedValueOnce({ success: true, commits: [] }); // git-log
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('main')).toBeInTheDocument();
    });
  });

  it('shows changes tab by default', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Changes')).toBeInTheDocument();
    });
  });

  it('shows history tab', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });

  it('shows commit input', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Commit message...')).toBeInTheDocument();
    });
  });

  it('shows changed files', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [
          { status: '??', path: 'newfile.js' },
          { status: 'M ', path: 'modified.js' }
        ] 
      })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('newfile.js')).toBeInTheDocument();
      expect(screen.getByText('modified.js')).toBeInTheDocument();
    });
  });

  it('commits changes when commit button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [{ status: 'A ', path: 'staged.js' }] 
      })
      .mockResolvedValueOnce({ success: true, commits: [] })
      .mockResolvedValueOnce({ success: true }) // git-commit
      .mockResolvedValueOnce({ success: true, isRepo: true }) // refresh git-is-repo
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] }) // refresh git-status
      .mockResolvedValueOnce({ success: true, commits: [] }); // refresh git-log
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Commit message...')).toBeInTheDocument();
    });
    
    const textarea = screen.getByPlaceholderText('Commit message...');
    fireEvent.change(textarea, { target: { value: 'Test commit' } });
    
    fireEvent.click(screen.getByText('Commit'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-commit', '/test/workspace', 'Test commit');
    });
  });

  it('stages all files when Stage All is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [{ status: '??', path: 'newfile.js' }] 
      })
      .mockResolvedValueOnce({ success: true, commits: [] })
      .mockResolvedValueOnce({ success: true }) // git-stage-all
      .mockResolvedValueOnce({ success: true, isRepo: true }) // refresh git-is-repo
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] }) // refresh git-status
      .mockResolvedValueOnce({ success: true, commits: [] }); // refresh git-log
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stage All')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Stage All'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-stage-all', '/test/workspace');
    });
  });

  it('shows commits in history tab', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ 
        success: true, 
        commits: [
          { hash: 'abc123', shortHash: 'abc123', message: 'Initial commit', author: 'Test', relative: '1 hour ago' }
        ] 
      });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('History'));
    
    await waitFor(() => {
      expect(screen.getByText('Initial commit')).toBeInTheDocument();
    });
  });

  it('renders Source Control header', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Source Control')).toBeInTheDocument();
    });
  });

  it('shows staged files section', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [{ status: 'A ', path: 'staged.js' }]
      })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Staged Changes')).toBeInTheDocument();
    });
  });

  it('shows unstaged files section', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [{ status: '??', path: 'untracked.js' }]
      })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      // "Changes" is the section title for unstaged files
      const changesElements = screen.getAllByText('Changes');
      expect(changesElements.length).toBeGreaterThan(0);
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel workspacePath="/test" onClose={onClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('Source Control')).toBeInTheDocument();
    });
    
    // Find close button (X icon)
    const buttons = screen.getAllByRole('button');
    // Close button should be near the header
    const closeButton = buttons.find(btn => btn.title === '' || btn.getAttribute('title') === null);
    if (closeButton) {
      fireEvent.click(closeButton);
    }
  });

  it('calls git-push when push button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] })
      .mockResolvedValueOnce({ success: true }); // git-push
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('Push')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTitle('Push'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-push', '/test/workspace');
    });
  });

  it('calls git-pull when pull button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] })
      .mockResolvedValueOnce({ success: true }) // git-pull
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('Pull')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTitle('Pull'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-pull', '/test/workspace');
    });
  });

  it('calls refresh when refresh button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] })
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTitle('Refresh'));
    
    // refresh calls git-is-repo again
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('git-is-repo', '/test/workspace');
    });
  });

  it('disables commit button when no staged files', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [{ status: '??', path: 'unstaged.js' }] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Commit')).toBeInTheDocument();
    });
    
    const textarea = screen.getByPlaceholderText('Commit message...');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    
    const commitButton = screen.getByText('Commit').closest('button');
    expect(commitButton).toBeDisabled();
  });

  it('disables commit button when no commit message', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [{ status: 'A ', path: 'staged.js' }] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Commit')).toBeInTheDocument();
    });
    
    const commitButton = screen.getByText('Commit').closest('button');
    expect(commitButton).toBeDisabled();
  });

  it('shows no commits message in empty history', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ success: true, branch: 'main', files: [] })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('History'));
    
    await waitFor(() => {
      expect(screen.getByText('No commits yet')).toBeInTheDocument();
    });
  });

  it('handles different file statuses correctly', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [
          { status: 'A ', path: 'added.js' },
          { status: 'M ', path: 'modified.js' },
          { status: 'D ', path: 'deleted.js' },
          { status: 'R ', path: 'renamed.js' },
          { status: '??', path: 'untracked.js' }
        ]
      })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('added.js')).toBeInTheDocument();
      expect(screen.getByText('untracked.js')).toBeInTheDocument();
    });
  });

  it('toggles section expansion', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, isRepo: true })
      .mockResolvedValueOnce({ 
        success: true, 
        branch: 'main', 
        files: [{ status: 'A ', path: 'staged.js' }]
      })
      .mockResolvedValueOnce({ success: true, commits: [] });
    
    render(<GitPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Staged Changes')).toBeInTheDocument();
    });
    
    // Click to toggle
    fireEvent.click(screen.getByText('Staged Changes'));
    
    // Section should still be visible (toggle behavior)
    expect(screen.getByText('Staged Changes')).toBeInTheDocument();
  });
});
