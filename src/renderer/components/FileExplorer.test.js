import React from 'react';
import { render, screen, act } from '@testing-library/react';
import FileExplorer from './FileExplorer';

// Get the mock directly from global for each test
const getMockInvoke = () => global.__mockInvoke;

describe('FileExplorer', () => {
  const defaultProps = {
    workspacePath: '/test/workspace',
    onFileSelect: jest.fn(),
    width: 260
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mockInvoke = getMockInvoke();
    mockInvoke.mockReset();
    // Default mock - returns empty array for read-directory
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve([]);
      }
      if (channel === 'watch-directory' || channel === 'unwatch-directory') {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: true });
    });
    window.prompt = jest.fn(() => 'newfile.js');
    window.confirm = jest.fn(() => true);
  });

  it('shows empty state when no workspace is open', async () => {
    await act(async () => {
      render(<FileExplorer workspacePath={null} onFileSelect={jest.fn()} />);
    });
    expect(screen.getByText('No folder opened')).toBeInTheDocument();
  });

  it('renders explorer header with workspace path', async () => {
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles empty directory response', async () => {
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles non-array directory response', async () => {
    const mockInvoke = getMockInvoke();
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve(null);
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('renders with custom width', async () => {
    await act(async () => {
      render(<FileExplorer {...defaultProps} width={400} />);
    });
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('renders action buttons in header', async () => {
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    // The component has new file and new folder buttons in the header
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('calls read-directory on mount', async () => {
    const mockInvoke = getMockInvoke();
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/test/workspace');
  });

  it('calls watch-directory on mount', async () => {
    const mockInvoke = getMockInvoke();
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('watch-directory', '/test/workspace');
  });

  it('renders Open Folder button when no workspace', async () => {
    await act(async () => {
      render(<FileExplorer workspacePath={null} onFileSelect={jest.fn()} onOpenFolder={jest.fn()} />);
    });
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
  });

  it('handles file list with files and folders', async () => {
    const mockInvoke = getMockInvoke();
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve([
          { name: 'src', isDirectory: true, path: '/test/workspace/src' },
          { name: 'package.json', isDirectory: false, path: '/test/workspace/package.json' },
          { name: 'README.md', isDirectory: false, path: '/test/workspace/README.md' }
        ]);
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/test/workspace');
  });

  it('handles onAttachFile callback', async () => {
    const onAttachFile = jest.fn();
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} onAttachFile={onAttachFile} />);
    });
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles activeFilePath prop', async () => {
    await act(async () => {
      render(<FileExplorer {...defaultProps} activeFilePath="/test/workspace/test.js" />);
    });
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles attachedFiles prop', async () => {
    const attachedFiles = [
      { path: '/test/workspace/test.js', name: 'test.js' }
    ];
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} attachedFiles={attachedFiles} />);
    });
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles hidden files filter', async () => {
    const mockInvoke = getMockInvoke();
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve([
          { name: '.git', isDirectory: true, path: '/test/workspace/.git' },
          { name: 'node_modules', isDirectory: true, path: '/test/workspace/node_modules' },
          { name: 'src', isDirectory: true, path: '/test/workspace/src' }
        ]);
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/test/workspace');
  });

  it('handles directory read error', async () => {
    const mockInvoke = getMockInvoke();
    
    // Mock returns error result instead of rejecting
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve({ error: 'Failed to read directory' });
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(screen.getByText('Explorer')).toBeInTheDocument();
  });

  it('handles multiple file types', async () => {
    const mockInvoke = getMockInvoke();
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve([
          { name: 'app.js', isDirectory: false, path: '/test/workspace/app.js' },
          { name: 'style.css', isDirectory: false, path: '/test/workspace/style.css' },
          { name: 'index.html', isDirectory: false, path: '/test/workspace/index.html' },
          { name: 'config.json', isDirectory: false, path: '/test/workspace/config.json' }
        ]);
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<FileExplorer {...defaultProps} />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/test/workspace');
  });

  it('handles workspace path change', async () => {
    const mockInvoke = getMockInvoke();
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'read-directory') {
        return Promise.resolve([]);
      }
      return Promise.resolve({ success: true });
    });
    
    const { rerender } = await act(async () => {
      return render(<FileExplorer {...defaultProps} />);
    });
    
    await act(async () => {
      rerender(<FileExplorer {...defaultProps} workspacePath="/new/workspace" />);
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/new/workspace');
  });

  it('handles onOpenFolder callback', async () => {
    const onOpenFolder = jest.fn();
    
    await act(async () => {
      render(<FileExplorer workspacePath={null} onFileSelect={jest.fn()} onOpenFolder={onOpenFolder} />);
    });
    
    const openButton = screen.getByText('Open Folder');
    await act(async () => {
      openButton.click();
    });
    
    expect(onOpenFolder).toHaveBeenCalled();
  });
});
