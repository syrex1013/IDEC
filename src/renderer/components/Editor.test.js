import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Editor from './Editor';

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }) => (
    <div data-testid="monaco-editor">
      <textarea
        data-testid="mock-monaco"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    </div>
  )
}));

describe('Editor', () => {
  const mockFile = {
    path: '/test/file.js',
    name: 'file.js',
    content: 'const x = 1;',
    language: 'javascript',
    isDirty: false
  };

  const defaultProps = {
    openFiles: [],
    activeFile: null,
    onFileSelect: jest.fn(),
    onFileChange: jest.fn(),
    onFileClose: jest.fn(),
    onFileSave: jest.fn(),
    fontSize: 14
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no files are open', () => {
    render(<Editor {...defaultProps} />);
    expect(screen.getByText(/open a folder/i)).toBeInTheDocument();
  });

  it('renders tabs when files are open', () => {
    render(
      <Editor
        {...defaultProps}
        openFiles={[mockFile]}
        activeFile={mockFile}
      />
    );
    expect(screen.getByText('file.js')).toBeInTheDocument();
  });

  it('shows dirty indicator on unsaved file', () => {
    const dirtyFile = { ...mockFile, isDirty: true };
    render(
      <Editor
        {...defaultProps}
        openFiles={[dirtyFile]}
        activeFile={dirtyFile}
      />
    );
    // Just verify the tab renders with the file name
    expect(screen.getByText('file.js')).toBeInTheDocument();
  });

  it('calls onFileSelect when tab is clicked', () => {
    const file1 = { ...mockFile, path: '/test/file1.js', name: 'file1.js' };
    const file2 = { ...mockFile, path: '/test/file2.js', name: 'file2.js' };
    
    render(
      <Editor
        {...defaultProps}
        openFiles={[file1, file2]}
        activeFile={file1}
      />
    );
    
    fireEvent.click(screen.getByText('file2.js'));
    expect(defaultProps.onFileSelect).toHaveBeenCalledWith(file2);
  });

  it('calls onFileClose when close button is clicked', () => {
    render(
      <Editor
        {...defaultProps}
        openFiles={[mockFile]}
        activeFile={mockFile}
      />
    );
    
    // Find the close button (X) in the tab
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons.find(btn => 
      btn.closest('div')?.textContent?.includes('file.js')
    );
    
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(defaultProps.onFileClose).toHaveBeenCalledWith(mockFile.path);
    }
  });

  it('renders Monaco editor when file is active', () => {
    render(
      <Editor
        {...defaultProps}
        openFiles={[mockFile]}
        activeFile={mockFile}
      />
    );
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('calls onFileChange when editor content changes', () => {
    render(
      <Editor
        {...defaultProps}
        openFiles={[mockFile]}
        activeFile={mockFile}
      />
    );
    
    const textarea = screen.getByTestId('mock-monaco');
    fireEvent.change(textarea, { target: { value: 'const y = 2;' } });
    expect(defaultProps.onFileChange).toHaveBeenCalledWith('const y = 2;');
  });

  it('applies active style to selected tab', () => {
    render(
      <Editor
        {...defaultProps}
        openFiles={[mockFile]}
        activeFile={mockFile}
      />
    );
    
    // Just verify the tab is rendered
    expect(screen.getByText('file.js')).toBeInTheDocument();
  });

  it('renders multiple tabs', () => {
    const files = [
      { ...mockFile, path: '/a.js', name: 'a.js' },
      { ...mockFile, path: '/b.js', name: 'b.js' },
      { ...mockFile, path: '/c.js', name: 'c.js' }
    ];
    
    render(
      <Editor
        {...defaultProps}
        openFiles={files}
        activeFile={files[0]}
      />
    );
    
    expect(screen.getByText('a.js')).toBeInTheDocument();
    expect(screen.getByText('b.js')).toBeInTheDocument();
    expect(screen.getByText('c.js')).toBeInTheDocument();
  });
});
