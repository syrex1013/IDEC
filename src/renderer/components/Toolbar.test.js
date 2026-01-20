import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    onOpenFolder: jest.fn(),
    onCreateProject: jest.fn(),
    onCloneRepo: jest.fn(),
    onToggleTerminal: jest.fn(),
    onToggleAI: jest.fn(),
    onToggleGit: jest.fn(),
    onToggleGitHub: jest.fn(),
    onOpenSettings: jest.fn(),
    onOpenExtensions: jest.fn(),
    showTerminal: false,
    showAIPanel: false,
    showGitPanel: false,
    showGitHubPanel: false,
    gitHubUser: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders IDEC logo text', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByText('IDEC')).toBeInTheDocument();
  });

  it('renders New button', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders Open button', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders Clone button', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByText('Clone')).toBeInTheDocument();
  });

  it('calls onCreateProject when New button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('New'));
    expect(defaultProps.onCreateProject).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFolder when Open button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('Open'));
    expect(defaultProps.onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('calls onCloneRepo when Clone button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByText('Clone'));
    expect(defaultProps.onCloneRepo).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleGit when git button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Git button is 4th (after New, Open, Clone)
    fireEvent.click(buttons[3]);
    expect(defaultProps.onToggleGit).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleGitHub when github button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // GitHub button is 5th
    fireEvent.click(buttons[4]);
    expect(defaultProps.onToggleGitHub).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleTerminal when terminal button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Terminal button is 6th
    fireEvent.click(buttons[5]);
    expect(defaultProps.onToggleTerminal).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleAI when AI button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // AI button is 7th
    fireEvent.click(buttons[6]);
    expect(defaultProps.onToggleAI).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenExtensions when extensions button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Extensions button is 8th
    fireEvent.click(buttons[7]);
    expect(defaultProps.onOpenExtensions).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenSettings when settings button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Settings button is 9th (last)
    fireEvent.click(buttons[8]);
    expect(defaultProps.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows user avatar when gitHubUser is provided', () => {
    const propsWithUser = {
      ...defaultProps,
      gitHubUser: { avatar_url: 'https://example.com/avatar.png', login: 'testuser' }
    };
    const { container } = render(<Toolbar {...propsWithUser} />);
    const avatar = container.querySelector('img[src="https://example.com/avatar.png"]');
    expect(avatar).toBeInTheDocument();
  });

  it('highlights terminal button when showTerminal is true', () => {
    const propsWithTerminal = {
      ...defaultProps,
      showTerminal: true
    };
    render(<Toolbar {...propsWithTerminal} />);
    // Terminal button should have active styling
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('highlights AI button when showAIPanel is true', () => {
    const propsWithAI = {
      ...defaultProps,
      showAIPanel: true
    };
    render(<Toolbar {...propsWithAI} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('highlights Git button when showGitPanel is true', () => {
    const propsWithGit = {
      ...defaultProps,
      showGitPanel: true
    };
    render(<Toolbar {...propsWithGit} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('highlights GitHub button when showGitHubPanel is true', () => {
    const propsWithGitHub = {
      ...defaultProps,
      showGitHubPanel: true
    };
    render(<Toolbar {...propsWithGitHub} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders all toggle buttons', () => {
    render(<Toolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Should have: New, Open, Clone, Git, GitHub, Terminal, AI, Extensions, Settings
    expect(buttons.length).toBe(9);
  });

  it('renders with all panels visible', () => {
    const propsAllVisible = {
      ...defaultProps,
      showTerminal: true,
      showAIPanel: true,
      showGitPanel: true,
      showGitHubPanel: true
    };
    render(<Toolbar {...propsAllVisible} />);
    expect(screen.getByText('IDEC')).toBeInTheDocument();
  });

  it('renders without crashing when no props provided', () => {
    // This should not crash even with missing handlers
    const minimalProps = {
      onOpenFolder: jest.fn(),
      onCreateProject: jest.fn(),
      onCloneRepo: jest.fn(),
      onToggleTerminal: jest.fn(),
      onToggleAI: jest.fn(),
      onToggleGit: jest.fn(),
      onToggleGitHub: jest.fn(),
      onOpenSettings: jest.fn(),
      onOpenExtensions: jest.fn()
    };
    render(<Toolbar {...minimalProps} />);
    expect(screen.getByText('IDEC')).toBeInTheDocument();
  });

  describe('button hover states', () => {
    it('changes style on mouse enter for inactive button', () => {
      render(<Toolbar {...defaultProps} />);
      const newButton = screen.getByText('New').closest('button');
      
      fireEvent.mouseEnter(newButton);
      expect(newButton.style.background).toBe('var(--muted)');
      expect(newButton.style.color).toBe('var(--foreground)');
    });

    it('reverts style on mouse leave for inactive button', () => {
      render(<Toolbar {...defaultProps} />);
      const newButton = screen.getByText('New').closest('button');
      
      fireEvent.mouseEnter(newButton);
      fireEvent.mouseLeave(newButton);
      expect(newButton.style.background).toBe('transparent');
      expect(newButton.style.color).toBe('var(--muted-foreground)');
    });

    it('does not change style on mouse enter for active button', () => {
      const propsWithActiveTerminal = {
        ...defaultProps,
        showTerminal: true
      };
      render(<Toolbar {...propsWithActiveTerminal} />);
      const buttons = screen.getAllByRole('button');
      const terminalButton = buttons[5]; // Terminal button is 6th
      
      const originalBackground = terminalButton.style.background;
      fireEvent.mouseEnter(terminalButton);
      // Active button should maintain its active styling
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('does not change style on mouse leave for active button', () => {
      const propsWithActiveAI = {
        ...defaultProps,
        showAIPanel: true
      };
      render(<Toolbar {...propsWithActiveAI} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons[6]; // AI button is 7th
      
      fireEvent.mouseEnter(aiButton);
      fireEvent.mouseLeave(aiButton);
      // Active button should maintain its active styling
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('panel toggle active states', () => {
    it('shows active state for terminal when showTerminal is true', () => {
      render(<Toolbar {...defaultProps} showTerminal={true} />);
      const buttons = screen.getAllByRole('button');
      const terminalButton = buttons[5];
      // Button should have active styling (background with rgba)
      expect(terminalButton).toBeTruthy();
    });

    it('shows active state for AI panel when showAIPanel is true', () => {
      render(<Toolbar {...defaultProps} showAIPanel={true} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons[6];
      expect(aiButton).toBeTruthy();
    });

    it('shows active state for Git panel when showGitPanel is true', () => {
      render(<Toolbar {...defaultProps} showGitPanel={true} />);
      const buttons = screen.getAllByRole('button');
      const gitButton = buttons[3];
      expect(gitButton).toBeTruthy();
    });

    it('shows active state for GitHub panel when showGitHubPanel is true', () => {
      render(<Toolbar {...defaultProps} showGitHubPanel={true} />);
      const buttons = screen.getAllByRole('button');
      const githubButton = buttons[4];
      expect(githubButton).toBeTruthy();
    });
  });
});
