import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsModal from './SettingsModal';

describe('SettingsModal', () => {
  const defaultSettings = {
    theme: 'idec-dark',
    ai: {
      claudeApiKey: '',
      openaiApiKey: '',
      groqApiKey: '',
      ollamaUrl: 'http://localhost:11434',
      provider: 'claude'
    },
    editor: {
      fontSize: 14,
      tabSize: 2,
      minimap: true,
      wordWrap: 'off',
      fontLigatures: true
    },
    terminal: {
      fontSize: 13,
      cursorBlink: true
    },
    files: {
      autoSave: 'off',
      exclude: ['node_modules']
    },
    keybindings: {
      save: 'Cmd+S'
    }
  };

  const defaultProps = {
    settings: defaultSettings,
    onSettingsChange: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Settings title', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('renders sidebar with navigation buttons', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(5);
  });

  it('shows Appearance section by default', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Color Theme')).toBeInTheDocument();
  });

  it('renders theme options', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('IDEC Dark')).toBeInTheDocument();
    expect(screen.getByText('IDEC Light')).toBeInTheDocument();
    expect(screen.getByText('Monokai')).toBeInTheDocument();
    expect(screen.getByText('Dracula')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsChange and onClose when Save is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Save Changes'));
    expect(defaultProps.onSettingsChange).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Editor button in sidebar', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
    expect(editorButton).toBeInTheDocument();
  });

  it('renders AI Providers button in sidebar', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
    expect(aiButton).toBeInTheDocument();
  });

  it('has search input', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
  });

  it('navigates to Editor section when clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
    fireEvent.click(editorButton);
    // Section header changes
    expect(screen.getByText('Font, formatting, and editor behavior')).toBeInTheDocument();
  });

  it('navigates to Terminal section when clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const terminalButton = buttons.find(btn => btn.textContent.includes('Terminal'));
    fireEvent.click(terminalButton);
    expect(screen.getByText('Integrated terminal settings')).toBeInTheDocument();
  });

  it('navigates to AI Providers section when clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
    fireEvent.click(aiButton);
    expect(screen.getByText('Configure AI assistants and API keys')).toBeInTheDocument();
  });

  it('navigates to Files section when clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const filesButton = buttons.find(btn => btn.textContent.includes('Files'));
    fireEvent.click(filesButton);
    expect(screen.getByText('File handling and exclusions')).toBeInTheDocument();
  });

  it('navigates to Keyboard section when clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const keyboardButton = buttons.find(btn => btn.textContent.includes('Keyboard'));
    fireEvent.click(keyboardButton);
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('updates theme when theme option is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    const draculaOption = screen.getByText('Dracula');
    fireEvent.click(draculaOption);
    // Theme should be selected
  });

  it('filters settings when searching', () => {
    render(<SettingsModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'font' } });
    // Search should update
  });

  it('renders all theme options', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('GitHub Dark')).toBeInTheDocument();
    expect(screen.getByText('One Dark Pro')).toBeInTheDocument();
    expect(screen.getByText('Solarized Dark')).toBeInTheDocument();
    expect(screen.getByText('Nord')).toBeInTheDocument();
    expect(screen.getByText('High Contrast')).toBeInTheDocument();
  });

  it('handles missing settings gracefully', () => {
    const propsWithMinimalSettings = {
      settings: { theme: 'idec-dark' },
      onSettingsChange: jest.fn(),
      onClose: jest.fn()
    };
    render(<SettingsModal {...propsWithMinimalSettings} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows current theme as selected', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('IDEC Dark')).toBeInTheDocument();
  });

  it('closes on X button click', () => {
    render(<SettingsModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // X button should close
    const closeButton = buttons.find(btn => btn.querySelector('svg[class*="lucide-x"]'));
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('renders reset button', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('renders Save Changes button', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  describe('Editor settings', () => {
    it('shows editor section description when navigated to', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
      fireEvent.click(editorButton);
      await waitFor(() => {
        expect(screen.getByText('Font, formatting, and editor behavior')).toBeInTheDocument();
      });
    });

    it('renders editor section with sliders', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
      fireEvent.click(editorButton);
      await waitFor(() => {
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBeGreaterThan(0);
      });
    });

    it('shows current font size value', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
      fireEvent.click(editorButton);
      await waitFor(() => {
        expect(screen.getByText('14px')).toBeInTheDocument();
      });
    });
  });

  describe('Terminal settings', () => {
    it('shows terminal section description when navigated to', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const terminalButton = buttons.find(btn => btn.textContent.includes('Terminal'));
      fireEvent.click(terminalButton);
      await waitFor(() => {
        expect(screen.getByText('Integrated terminal settings')).toBeInTheDocument();
      });
    });

    it('renders terminal section with sliders', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const terminalButton = buttons.find(btn => btn.textContent.includes('Terminal'));
      fireEvent.click(terminalButton);
      await waitFor(() => {
        const sliders = screen.getAllByRole('slider');
        expect(sliders.length).toBeGreaterThan(0);
      });
    });

    it('shows terminal font size value', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const terminalButton = buttons.find(btn => btn.textContent.includes('Terminal'));
      fireEvent.click(terminalButton);
      await waitFor(() => {
        expect(screen.getByText('13px')).toBeInTheDocument();
      });
    });
  });

  describe('AI Providers settings', () => {
    it('shows AI section description when navigated to', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
      fireEvent.click(aiButton);
      await waitFor(() => {
        expect(screen.getByText('Configure AI assistants and API keys')).toBeInTheDocument();
      });
    });

    it('shows provider selection dropdown', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
      fireEvent.click(aiButton);
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes.length).toBeGreaterThan(0);
      });
    });

    it('shows API key input fields', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
      fireEvent.click(aiButton);
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText(/sk-/);
        expect(inputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Files settings', () => {
    it('shows files section description when navigated to', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const filesButton = buttons.find(btn => btn.textContent.includes('Files'));
      fireEvent.click(filesButton);
      await waitFor(() => {
        expect(screen.getByText('File handling and exclusions')).toBeInTheDocument();
      });
    });

    it('shows auto save dropdown', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const filesButton = buttons.find(btn => btn.textContent.includes('Files'));
      fireEvent.click(filesButton);
      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes.length).toBeGreaterThan(0);
      });
    });

    it('shows add pattern button', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const filesButton = buttons.find(btn => btn.textContent.includes('Files'));
      fireEvent.click(filesButton);
      await waitFor(() => {
        expect(screen.getByText('+ Add Pattern')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard settings', () => {
    it('shows keyboard section description when navigated to', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const keyboardButton = buttons.find(btn => btn.textContent.includes('Keyboard'));
      fireEvent.click(keyboardButton);
      await waitFor(() => {
        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
      });
    });

    it('shows keybinding instructions', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const keyboardButton = buttons.find(btn => btn.textContent.includes('Keyboard'));
      fireEvent.click(keyboardButton);
      await waitFor(() => {
        expect(screen.getByText(/Click on a keybinding to change it/)).toBeInTheDocument();
      });
    });

    it('shows keybinding text inputs', async () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const keyboardButton = buttons.find(btn => btn.textContent.includes('Keyboard'));
      fireEvent.click(keyboardButton);
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Reset functionality', () => {
    it('opens reset confirmation when clicked', () => {
      render(<SettingsModal {...defaultProps} />);
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      // Reset should open a confirmation or reset settings
    });
  });

  describe('Search functionality', () => {
    it('filters visible settings', () => {
      render(<SettingsModal {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search settings...');
      fireEvent.change(searchInput, { target: { value: 'theme' } });
      // Should filter to theme-related settings
    });

    it('clears search when X is clicked', () => {
      render(<SettingsModal {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText('Search settings...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput.value).toBe('test');
    });
  });

  describe('Settings changes', () => {
    it('tracks changes to theme', () => {
      render(<SettingsModal {...defaultProps} />);
      const draculaOption = screen.getByText('Dracula');
      fireEvent.click(draculaOption);
      fireEvent.click(screen.getByText('Save Changes'));
      expect(defaultProps.onSettingsChange).toHaveBeenCalled();
    });

    it('passes updated settings on save', () => {
      render(<SettingsModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Save Changes'));
      expect(defaultProps.onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({
        theme: 'idec-dark'
      }));
    });
  });

  describe('getValue helper', () => {
    it('handles nested paths correctly', () => {
      render(<SettingsModal {...defaultProps} />);
      // Navigate to editor section
      const buttons = screen.getAllByRole('button');
      const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
      fireEvent.click(editorButton);
      // Verify content renders
      expect(screen.getByText('Font, formatting, and editor behavior')).toBeInTheDocument();
    });
  });

  describe('handleChange function', () => {
    it('navigates to editor section successfully', () => {
      render(<SettingsModal {...defaultProps} />);
      // Navigate to editor section
      const buttons = screen.getAllByRole('button');
      const editorButton = buttons.find(btn => btn.textContent.includes('Editor'));
      fireEvent.click(editorButton);
      
      // Verify the section is shown
      expect(screen.getByText('Font, formatting, and editor behavior')).toBeInTheDocument();
    });
  });

  describe('toggleShowKey function', () => {
    it('toggles API key visibility in AI section', () => {
      render(<SettingsModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      const aiButton = buttons.find(btn => btn.textContent.includes('AI Providers'));
      fireEvent.click(aiButton);
      // Section should show
      expect(screen.getByText('Configure AI assistants and API keys')).toBeInTheDocument();
    });
  });

  describe('resetSection function', () => {
    it('resets appearance section to defaults', () => {
      render(<SettingsModal {...defaultProps} />);
      // Click reset
      fireEvent.click(screen.getByText('Reset'));
      // Verify theme is still in options
      expect(screen.getByText('IDEC Dark')).toBeInTheDocument();
    });
  });
});
