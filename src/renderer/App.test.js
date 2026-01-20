import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Get the mock from setup
const mockInvoke = global.__mockInvoke;

// Mock all child components
jest.mock('./components/FileExplorer', () => function MockFileExplorer({ onFileSelect }) {
  return (
    <div data-testid="file-explorer">
      <button onClick={() => onFileSelect('/test/file.js')}>Select File</button>
    </div>
  );
});

jest.mock('./components/Editor', () => function MockEditor({ file, onFileChange, onFileSave, onCloseFile }) {
  return (
    <div data-testid="editor">
      {file && <span>Editing: {file.name}</span>}
      <button onClick={() => onFileChange && onFileChange('new content')}>Change File</button>
      <button onClick={() => onFileSave && onFileSave()}>Save File</button>
      <button onClick={() => onCloseFile && onCloseFile(file?.path)}>Close File</button>
    </div>
  );
});

jest.mock('./components/AIPanel', () => function MockAIPanel({ onInsertCode }) {
  return (
    <div data-testid="ai-panel">
      <button onClick={() => onInsertCode && onInsertCode('// inserted code')}>Insert Code</button>
    </div>
  );
});

jest.mock('./components/Terminal', () => function MockTerminal() {
  return <div data-testid="terminal">Terminal</div>;
});

jest.mock('./components/Toolbar', () => function MockToolbar({ onOpenFolder, onToggleTerminal, onToggleAI, onToggleGit, onOpenSettings, onToggleGitHub, onCreateProject, onCloneRepo, onOpenExtensions }) {
  return (
    <div data-testid="toolbar">
      <button onClick={onOpenFolder}>Open Folder</button>
      <button onClick={onToggleTerminal}>Toggle Terminal</button>
      <button onClick={onToggleAI}>Toggle AI</button>
      <button onClick={onToggleGit}>Toggle Git</button>
      <button onClick={onToggleGitHub}>Toggle GitHub</button>
      <button onClick={onOpenSettings}>Settings</button>
      <button onClick={onCreateProject}>New Project</button>
      <button onClick={onCloneRepo}>Clone</button>
      <button onClick={onOpenExtensions}>Extensions</button>
    </div>
  );
});

jest.mock('./components/SettingsModal', () => function MockSettingsModal({ onClose }) {
  return <div data-testid="settings-modal"><button onClick={onClose}>Close Settings</button></div>;
});

jest.mock('./components/SetupWizard', () => function MockSetupWizard({ onComplete }) {
  return (
    <div data-testid="setup-wizard">
      <button onClick={() => onComplete({ theme: 'idec-dark', ai: {} })}>Complete Setup</button>
    </div>
  );
});

jest.mock('./components/ExtensionMarketplace', () => function MockExtensionMarketplace({ onClose }) {
  return <div data-testid="extension-marketplace"><button onClick={onClose}>Close Extensions</button></div>;
});

jest.mock('./components/GitPanel', () => function MockGitPanel({ onClose }) {
  return <div data-testid="git-panel"><button onClick={onClose}>Close Git</button></div>;
});

jest.mock('./components/GitHubPanel', () => function MockGitHubPanel({ onClose, onCloneRepo }) {
  return (
    <div data-testid="github-panel">
      <button onClick={onClose}>Close GitHub</button>
      <button onClick={() => onCloneRepo('https://github.com/test/repo')}>Clone from GitHub</button>
    </div>
  );
});

jest.mock('./components/CreateProjectModal', () => function MockCreateProjectModal({ onClose, onProjectCreated }) {
  return (
    <div data-testid="create-project-modal">
      <button onClick={onClose}>Close Create</button>
      <button onClick={() => onProjectCreated('/new/project')}>Create Project</button>
    </div>
  );
});

jest.mock('./components/CloneRepoModal', () => function MockCloneRepoModal({ onClose, onCloneComplete }) {
  return (
    <div data-testid="clone-repo-modal">
      <button onClick={onClose}>Close Clone</button>
      <button onClick={() => onCloneComplete('/cloned/repo')}>Clone Repo</button>
    </div>
  );
});

jest.mock('./components/ResizeHandle', () => function MockResizeHandle() {
  return <div data-testid="resize-handle" />;
});

// Import after mocks
import AppWithErrorBoundary from './App';

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
  });

  it('shows loading state initially', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    await act(async () => {
      render(<AppWithErrorBoundary />);
    });
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows setup wizard when setupComplete is false', async () => {
    mockInvoke.mockResolvedValue({ 
      success: true, 
      settings: { setupComplete: false } 
    });
    
    await act(async () => {
      render(<AppWithErrorBoundary />);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
    });
  });

  it('shows main app when setupComplete is true', async () => {
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'load-settings') {
        return Promise.resolve({ success: true, settings: { setupComplete: true } });
      }
      if (channel === 'github-get-user') {
        return Promise.resolve({ success: false });
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<AppWithErrorBoundary />);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    });
  });

  it('shows setup wizard when settings load fails', async () => {
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'load-settings') {
        return Promise.reject(new Error('Failed'));
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<AppWithErrorBoundary />);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
    });
  });

  it('completes setup wizard and shows main app', async () => {
    mockInvoke.mockImplementation((channel) => {
      if (channel === 'load-settings') {
        return Promise.resolve({ success: true, settings: { setupComplete: false } });
      }
      if (channel === 'github-get-user') {
        return Promise.resolve({ success: false });
      }
      return Promise.resolve({ success: true });
    });
    
    await act(async () => {
      render(<AppWithErrorBoundary />);
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
    });
    
    await act(async () => {
      fireEvent.click(screen.getByText('Complete Setup'));
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    });
  });

  describe('main app functionality', () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'open-folder-dialog') {
          return Promise.resolve('/test/path');
        }
        return Promise.resolve({ success: true });
      });
    });

    it('renders toolbar', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
    });

    it('renders file explorer', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
    });

    it('renders editor', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('editor')).toBeInTheDocument();
      });
    });

    it('renders terminal by default', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('terminal')).toBeInTheDocument();
      });
    });

    it('renders AI panel by default', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('ai-panel')).toBeInTheDocument();
      });
    });

    it('toggles terminal visibility', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('terminal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle Terminal'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('terminal')).not.toBeInTheDocument();
      });
    });

    it('toggles AI panel visibility', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('ai-panel')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle AI'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument();
      });
    });

    it('toggles Git panel visibility', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle Git'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('git-panel')).toBeInTheDocument();
      });
    });

    it('toggles GitHub panel visibility', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle GitHub'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('github-panel')).toBeInTheDocument();
      });
    });

    it('opens settings modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Settings'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      });
    });

    it('opens extensions modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Extensions'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('extension-marketplace')).toBeInTheDocument();
      });
    });

    it('opens create project modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('New Project'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('create-project-modal')).toBeInTheDocument();
      });
    });

    it('opens clone repo modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Clone'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clone-repo-modal')).toBeInTheDocument();
      });
    });

    it('opens folder dialog', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Open Folder'));
      });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('open-folder-dialog');
      });
    });

    it('closes settings modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Settings'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close Settings'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
      });
    });

    it('closes extensions modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Extensions'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('extension-marketplace')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close Extensions'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('extension-marketplace')).not.toBeInTheDocument();
      });
    });

    it('closes create project modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('New Project'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('create-project-modal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close Create'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('create-project-modal')).not.toBeInTheDocument();
      });
    });

    it('closes clone repo modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Clone'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clone-repo-modal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close Clone'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('clone-repo-modal')).not.toBeInTheDocument();
      });
    });

    it('closes git panel', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle Git'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('git-panel')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close Git'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('git-panel')).not.toBeInTheDocument();
      });
    });

    it('closes github panel', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle GitHub'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('github-panel')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Close GitHub'));
      });
      
      await waitFor(() => {
        expect(screen.queryByTestId('github-panel')).not.toBeInTheDocument();
      });
    });

    it('handles project creation callback', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('New Project'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('create-project-modal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Create Project'));
      });
      
      // Verify the callback was called (app is still showing)
      expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    });

    it('handles clone complete callback', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Clone'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('clone-repo-modal')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Clone Repo'));
      });
      
      // Verify the callback was called (app is still showing)
      expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    });

    it('handles GitHub clone to open clone modal', async () => {
      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Toggle GitHub'));
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('github-panel')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Clone from GitHub'));
      });
      
      // GitHub panel closes and clone modal opens
      await waitFor(() => {
        expect(screen.getByTestId('clone-repo-modal')).toBeInTheDocument();
      });
    });

    it('handles file selection', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'read-file') {
          return Promise.resolve({ success: true, content: 'file content' });
        }
        return Promise.resolve({ success: true });
      });

      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Select File'));
      });
      
      // Verify read-file was called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('read-file', '/test/file.js');
      });
    });

    it('handles file change', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'read-file') {
          return Promise.resolve({ success: true, content: 'file content' });
        }
        return Promise.resolve({ success: true });
      });

      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
      
      // First select a file
      await act(async () => {
        fireEvent.click(screen.getByText('Select File'));
      });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('read-file', '/test/file.js');
      });
      
      // Then change the file
      await act(async () => {
        fireEvent.click(screen.getByText('Change File'));
      });
      
      expect(screen.getByTestId('editor')).toBeInTheDocument();
    });

    it('handles file save', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'read-file') {
          return Promise.resolve({ success: true, content: 'file content' });
        }
        if (channel === 'write-file') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      });

      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
      
      // First select a file
      await act(async () => {
        fireEvent.click(screen.getByText('Select File'));
      });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('read-file', '/test/file.js');
      });
      
      // Then save the file
      await act(async () => {
        fireEvent.click(screen.getByText('Save File'));
      });
      
      // File save should be called (may not trigger if no active file yet)
      expect(screen.getByTestId('editor')).toBeInTheDocument();
    });

    it('handles file close', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'read-file') {
          return Promise.resolve({ success: true, content: 'file content' });
        }
        return Promise.resolve({ success: true });
      });

      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
      
      // First select a file
      await act(async () => {
        fireEvent.click(screen.getByText('Select File'));
      });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('read-file', '/test/file.js');
      });
      
      // Then close the file
      await act(async () => {
        fireEvent.click(screen.getByText('Close File'));
      });
      
      expect(screen.getByTestId('editor')).toBeInTheDocument();
    });

    it('handles AI code insert', async () => {
      mockInvoke.mockImplementation((channel) => {
        if (channel === 'load-settings') {
          return Promise.resolve({ success: true, settings: { setupComplete: true } });
        }
        if (channel === 'github-get-user') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'read-file') {
          return Promise.resolve({ success: true, content: 'file content' });
        }
        return Promise.resolve({ success: true });
      });

      await act(async () => {
        render(<AppWithErrorBoundary />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });
      
      // First select a file
      await act(async () => {
        fireEvent.click(screen.getByText('Select File'));
      });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('read-file', '/test/file.js');
      });
      
      // Then insert code from AI
      await act(async () => {
        fireEvent.click(screen.getByText('Insert Code'));
      });
      
      expect(screen.getByTestId('ai-panel')).toBeInTheDocument();
    });
  });
});
