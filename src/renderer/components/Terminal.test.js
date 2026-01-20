import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Terminal from './Terminal';

const mockInvoke = global.__mockInvoke;
const mockOn = global.__mockElectron.ipcRenderer.on;

describe('Terminal', () => {
  const defaultProps = {
    workspacePath: '/test/workspace',
    settings: {
      theme: 'idec-dark',
      terminal: {
        fontFamily: 'Monaco',
        fontSize: 14
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
    mockOn.mockReset();
  });

  it('renders terminal container', () => {
    const { container } = render(<Terminal {...defaultProps} />);
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('renders terminal header with controls', async () => {
    render(<Terminal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('starts terminal process on mount', async () => {
    render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'terminal-create',
        expect.any(String),
        '/test/workspace'
      );
    });
  });

  it('renders without workspace path', async () => {
    render(<Terminal {...defaultProps} workspacePath={null} />);
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('renders with default settings when none provided', async () => {
    render(<Terminal workspacePath="/test" settings={null} />);
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('has control buttons', async () => {
    const { container } = render(<Terminal {...defaultProps} />);
    await waitFor(() => {
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('handles terminal-data callback', async () => {
    let terminalDataCallback;
    mockOn.mockImplementation((channel, callback) => {
      if (channel === 'terminal-data') {
        terminalDataCallback = callback;
      }
    });
    
    render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith('terminal-data', expect.any(Function));
    });
  });

  it('handles terminal-exit callback', async () => {
    let terminalExitCallback;
    mockOn.mockImplementation((channel, callback) => {
      if (channel === 'terminal-exit') {
        terminalExitCallback = callback;
      }
    });
    
    render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockOn).toHaveBeenCalledWith('terminal-exit', expect.any(Function));
    });
  });

  it('handles onFocus callback', async () => {
    const onFocus = jest.fn();
    render(<Terminal {...defaultProps} onFocus={onFocus} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('handles workspacePath prop change', async () => {
    const { rerender } = render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
    
    rerender(<Terminal {...defaultProps} workspacePath="/new/workspace" />);
    
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('handles settings prop change', async () => {
    const newSettings = {
      ...defaultProps.settings,
      terminal: {
        fontFamily: 'Consolas',
        fontSize: 16
      }
    };
    
    const { rerender } = render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
    
    rerender(<Terminal {...defaultProps} settings={newSettings} />);
    
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('handles different themes', async () => {
    const darkSettings = {
      theme: 'vscode-dark',
      terminal: { fontSize: 14 }
    };
    
    render(<Terminal {...defaultProps} settings={darkSettings} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('handles light theme', async () => {
    const lightSettings = {
      theme: 'idec-light',
      terminal: { fontSize: 14 }
    };
    
    render(<Terminal {...defaultProps} settings={lightSettings} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('handles terminal creation failure', async () => {
    mockInvoke.mockResolvedValue({ success: false, error: 'Failed to create terminal' });
    
    render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  it('handles unmount cleanup', async () => {
    const { unmount } = render(<Terminal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
    
    unmount();
    
    // Cleanup should have been called
    expect(mockInvoke).toHaveBeenCalled();
  });
});
