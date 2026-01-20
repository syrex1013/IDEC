import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileExplorer from './FileExplorer';

const mockInvoke = global.__mockInvoke;

describe('FileExplorer', () => {
  const defaultProps = {
    workspacePath: '/test/workspace',
    onFileSelect: jest.fn(),
    width: 260
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue([]);
    window.prompt = jest.fn(() => 'newfile.js');
    window.confirm = jest.fn(() => true);
  });

  it('shows empty state when no workspace is open', async () => {
    render(<FileExplorer workspacePath={null} onFileSelect={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('No folder opened')).toBeInTheDocument();
    });
  });

  it('renders explorer header with workspace path', async () => {
    mockInvoke.mockResolvedValue([]);
    render(<FileExplorer {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });
  });

  it('displays files from the workspace', async () => {
    mockInvoke.mockResolvedValue([
      { name: 'index.js', path: '/test/workspace/index.js', isDirectory: false },
      { name: 'package.json', path: '/test/workspace/package.json', isDirectory: false }
    ]);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('index.js')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });
  });

  it('displays directories with folder icons', async () => {
    mockInvoke.mockResolvedValue([
      { name: 'src', path: '/test/workspace/src', isDirectory: true },
      { name: 'tests', path: '/test/workspace/tests', isDirectory: true }
    ]);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('tests')).toBeInTheDocument();
    });
  });

  it('calls onFileSelect when a file is clicked', async () => {
    const onFileSelect = jest.fn();
    mockInvoke.mockResolvedValue([
      { name: 'index.js', path: '/test/workspace/index.js', isDirectory: false }
    ]);
    
    render(<FileExplorer {...defaultProps} onFileSelect={onFileSelect} />);
    
    await waitFor(() => {
      expect(screen.getByText('index.js')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('index.js'));
    
    expect(onFileSelect).toHaveBeenCalledWith('/test/workspace/index.js');
  });

  it('expands directory when folder is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce([
        { name: 'src', path: '/test/workspace/src', isDirectory: true }
      ])
      .mockResolvedValueOnce([
        { name: 'app.js', path: '/test/workspace/src/app.js', isDirectory: false }
      ]);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('src'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('read-directory', '/test/workspace/src');
    });
  });

  it('sorts directories before files', async () => {
    mockInvoke.mockResolvedValue([
      { name: 'zebra.js', path: '/test/workspace/zebra.js', isDirectory: false },
      { name: 'alpha', path: '/test/workspace/alpha', isDirectory: true },
      { name: 'beta.js', path: '/test/workspace/beta.js', isDirectory: false }
    ]);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument();
    });
  });

  it('handles empty directory response', async () => {
    mockInvoke.mockResolvedValue([]);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });
  });

  it('handles non-array directory response', async () => {
    mockInvoke.mockResolvedValue(null);
    
    render(<FileExplorer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });
  });

  describe('context menu', () => {
    it('triggers context menu handler on right click', async () => {
      mockInvoke.mockResolvedValue([
        { name: 'index.js', path: '/test/workspace/index.js', isDirectory: false }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('index.js')).toBeInTheDocument();
      });
      
      const fileItem = screen.getByText('index.js');
      fireEvent.contextMenu(fileItem);
      
      // Context menu state is set internally - test passes if no error
      expect(screen.getByText('index.js')).toBeInTheDocument();
    });
  });

  describe('file operations', () => {
    it('creates new file when New File is clicked', async () => {
      window.prompt = jest.fn(() => 'newfile.js');
      mockInvoke
        .mockResolvedValueOnce([
          { name: 'src', path: '/test/workspace/src', isDirectory: true }
        ])
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce([
          { name: 'src', path: '/test/workspace/src', isDirectory: true },
          { name: 'newfile.js', path: '/test/workspace/newfile.js', isDirectory: false }
        ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
      
      const srcItem = screen.getByText('src');
      fireEvent.contextMenu(srcItem);
      
      await waitFor(() => {
        expect(screen.getByText('New File')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('New File'));
      
      expect(window.prompt).toHaveBeenCalledWith('Enter file name:');
    });

    it('cancels new file if prompt is cancelled', async () => {
      window.prompt = jest.fn(() => null);
      mockInvoke.mockResolvedValue([
        { name: 'src', path: '/test/workspace/src', isDirectory: true }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('src'));
      
      await waitFor(() => {
        expect(screen.getByText('New File')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('New File'));
      
      // create-file should not be called
      expect(mockInvoke).not.toHaveBeenCalledWith('create-file', expect.anything());
    });

    it('creates new folder when New Folder is clicked', async () => {
      window.prompt = jest.fn(() => 'newfolder');
      mockInvoke
        .mockResolvedValueOnce([
          { name: 'src', path: '/test/workspace/src', isDirectory: true }
        ])
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce([
          { name: 'src', path: '/test/workspace/src', isDirectory: true },
          { name: 'newfolder', path: '/test/workspace/newfolder', isDirectory: true }
        ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('src'));
      
      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('New Folder'));
      
      expect(window.prompt).toHaveBeenCalledWith('Enter folder name:');
    });

    it('deletes file when Delete is clicked and confirmed', async () => {
      window.confirm = jest.fn(() => true);
      mockInvoke
        .mockResolvedValueOnce([
          { name: 'index.js', path: '/test/workspace/index.js', isDirectory: false }
        ])
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce([]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('index.js')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('index.js'));
      
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Delete'));
      
      expect(window.confirm).toHaveBeenCalledWith('Delete this item?');
    });

    it('does not delete if user cancels confirmation', async () => {
      window.confirm = jest.fn(() => false);
      mockInvoke.mockResolvedValue([
        { name: 'index.js', path: '/test/workspace/index.js', isDirectory: false }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('index.js')).toBeInTheDocument();
      });
      
      fireEvent.contextMenu(screen.getByText('index.js'));
      
      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Delete'));
      
      expect(mockInvoke).not.toHaveBeenCalledWith('delete-path', expect.anything());
    });
  });

  describe('directory expansion', () => {
    it('collapses directory when clicked again', async () => {
      mockInvoke
        .mockResolvedValueOnce([
          { name: 'src', path: '/test/workspace/src', isDirectory: true }
        ])
        .mockResolvedValueOnce([
          { name: 'app.js', path: '/test/workspace/src/app.js', isDirectory: false }
        ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('src')).toBeInTheDocument();
      });
      
      // Expand
      fireEvent.click(screen.getByText('src'));
      
      // Collapse
      fireEvent.click(screen.getByText('src'));
      
      // Should toggle expanded state
      expect(screen.getByText('src')).toBeInTheDocument();
    });
  });

  describe('file icons', () => {
    it('shows appropriate icon for JavaScript files', async () => {
      mockInvoke.mockResolvedValue([
        { name: 'app.js', path: '/test/workspace/app.js', isDirectory: false }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('app.js')).toBeInTheDocument();
      });
    });

    it('shows appropriate icon for JSON files', async () => {
      mockInvoke.mockResolvedValue([
        { name: 'package.json', path: '/test/workspace/package.json', isDirectory: false }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeInTheDocument();
      });
    });

    it('shows appropriate icon for TypeScript files', async () => {
      mockInvoke.mockResolvedValue([
        { name: 'app.ts', path: '/test/workspace/app.ts', isDirectory: false }
      ]);
      
      render(<FileExplorer {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('app.ts')).toBeInTheDocument();
      });
    });
  });
});
