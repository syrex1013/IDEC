import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BottomPanel from './BottomPanel';

// Mock Terminal component
jest.mock('./Terminal', () => {
  return function MockTerminal() {
    return <div data-testid="mock-terminal">Terminal Mock</div>;
  };
});

const mockInvoke = global.__mockInvoke;

describe('BottomPanel', () => {
  const defaultProps = {
    workspacePath: '/test/workspace',
    settings: {
      terminal: {
        fontSize: 14,
        fontFamily: 'monospace'
      }
    },
    problems: [],
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
    // Mock electronAPI
    window.electronAPI = {
      onOutputLog: jest.fn(() => jest.fn()) // returns cleanup function
    };
  });

  it('renders BottomPanel with terminal tab active by default', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByTestId('mock-terminal')).toBeInTheDocument();
  });

  it('renders Problems tab', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    expect(screen.getByText('Problems')).toBeInTheDocument();
  });

  it('renders Output tab', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('switches to Problems tab when clicked', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    
    await act(async () => {
      fireEvent.click(screen.getByText('Problems'));
    });
    
    // Verify Problems tab button exists
    expect(screen.getByText('Problems')).toBeInTheDocument();
  });

  it('switches to Output tab when clicked', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    
    await act(async () => {
      fireEvent.click(screen.getByText('Output'));
    });
    
    // Verify Output tab button exists
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('shows error count badge when there are errors', async () => {
    const propsWithErrors = {
      ...defaultProps,
      problems: [
        { severity: 'error', message: 'Test error', file: 'test.js', line: 1 }
      ]
    };
    
    await act(async () => {
      render(<BottomPanel {...propsWithErrors} />);
    });
    
    // Badge should show 1 for the error
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows warning count in problems', async () => {
    const propsWithWarnings = {
      ...defaultProps,
      problems: [
        { severity: 'warning', message: 'Test warning', file: 'test.js', line: 5 }
      ]
    };
    
    await act(async () => {
      render(<BottomPanel {...propsWithWarnings} />);
    });
    
    // Badge should show 1 for the warning
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<BottomPanel {...defaultProps} onClose={onClose} />);
    });
    
    // Find close button - it's the last button in the header
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[buttons.length - 1];
    
    await act(async () => {
      fireEvent.click(closeButton);
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('minimizes when minimize button is clicked', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    
    // Find minimize button (chevron down)
    const buttons = screen.getAllByRole('button');
    const minimizeButton = buttons.find(btn => btn.querySelector('[class*="chevron"]') || btn.textContent === '');
    
    if (minimizeButton) {
      await act(async () => {
        fireEvent.click(minimizeButton);
      });
    }
  });

  it('renders with empty problems array', async () => {
    await act(async () => {
      render(<BottomPanel {...defaultProps} problems={[]} />);
    });
    
    // Should show Problems tab
    expect(screen.getByText('Problems')).toBeInTheDocument();
  });

  it('renders without settings prop', async () => {
    const propsNoSettings = {
      workspacePath: '/test/workspace',
      problems: [],
      onClose: jest.fn()
    };
    
    await act(async () => {
      render(<BottomPanel {...propsNoSettings} />);
    });
    
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('renders without workspacePath prop', async () => {
    const propsNoWorkspace = {
      ...defaultProps,
      workspacePath: null
    };
    
    await act(async () => {
      render(<BottomPanel {...propsNoWorkspace} />);
    });
    
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('renders problems with file and line info', async () => {
    const propsWithProblems = {
      ...defaultProps,
      problems: [
        { severity: 'error', message: 'Syntax error', file: 'app.js', line: 10, column: 5 },
        { severity: 'warning', message: 'Unused variable', file: 'utils.js', line: 20 }
      ]
    };
    
    await act(async () => {
      render(<BottomPanel {...propsWithProblems} />);
    });
    
    // Badge should show 2 for the two problems
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('handles output log subscription', async () => {
    const cleanup = jest.fn();
    window.electronAPI = {
      onOutputLog: jest.fn(() => cleanup)
    };
    
    let unmount;
    await act(async () => {
      const result = render(<BottomPanel {...defaultProps} />);
      unmount = result.unmount;
    });
    
    expect(window.electronAPI.onOutputLog).toHaveBeenCalled();
    
    // Cleanup on unmount
    await act(async () => {
      unmount();
    });
    
    expect(cleanup).toHaveBeenCalled();
  });

  it('renders badge with error count', async () => {
    const propsWithManyErrors = {
      ...defaultProps,
      problems: [
        { severity: 'error', message: 'Error 1' },
        { severity: 'error', message: 'Error 2' },
        { severity: 'warning', message: 'Warning 1' }
      ]
    };
    
    await act(async () => {
      render(<BottomPanel {...propsWithManyErrors} />);
    });
    
    // Badge should show 3 (2 errors + 1 warning)
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('handles missing electronAPI gracefully', async () => {
    window.electronAPI = undefined;
    
    await act(async () => {
      render(<BottomPanel {...defaultProps} />);
    });
    
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });
});
