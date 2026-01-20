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
});
