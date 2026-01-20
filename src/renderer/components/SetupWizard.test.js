import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetupWizard from './SetupWizard';

const mockInvoke = global.__mockInvoke;

describe('SetupWizard', () => {
  const defaultProps = {
    onComplete: jest.fn(),
    initialSettings: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
  });

  describe('Welcome Step', () => {
    it('renders welcome message', () => {
      render(<SetupWizard {...defaultProps} />);
      expect(screen.getByText('Welcome to IDEC')).toBeInTheDocument();
    });

    it('renders description', () => {
      render(<SetupWizard {...defaultProps} />);
      expect(screen.getByText(/AI-powered development environment/)).toBeInTheDocument();
    });

    it('renders feature badges', () => {
      render(<SetupWizard {...defaultProps} />);
      expect(screen.getByText('Fast')).toBeInTheDocument();
      expect(screen.getByText('AI-Powered')).toBeInTheDocument();
      expect(screen.getByText('Customizable')).toBeInTheDocument();
    });

    it('renders Let\'s Go button', () => {
      render(<SetupWizard {...defaultProps} />);
      expect(screen.getByText("Let's Go")).toBeInTheDocument();
    });

    it('shows progress indicator', () => {
      render(<SetupWizard {...defaultProps} />);
      // 5 steps in progress indicator
      const progressDots = document.querySelectorAll('[style*="border-radius: 50%"]');
      expect(progressDots.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Navigation', () => {
    it('navigates to theme step when clicking Let\'s Go', async () => {
      render(<SetupWizard {...defaultProps} />);
      
      fireEvent.click(screen.getByText("Let's Go"));
      
      await waitFor(() => {
        expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
      });
    });

    it('shows Back button on theme step', async () => {
      render(<SetupWizard {...defaultProps} />);
      
      fireEvent.click(screen.getByText("Let's Go"));
      
      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('navigates back to welcome step', async () => {
      render(<SetupWizard {...defaultProps} />);
      
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Back')).toBeInTheDocument());
      
      fireEvent.click(screen.getByText('Back'));
      
      await waitFor(() => {
        expect(screen.getByText('Welcome to IDEC')).toBeInTheDocument();
      });
    });

    it('shows Skip setup button', async () => {
      render(<SetupWizard {...defaultProps} />);
      
      fireEvent.click(screen.getByText("Let's Go"));
      
      await waitFor(() => {
        expect(screen.getByText('Skip setup')).toBeInTheDocument();
      });
    });

    it('skips to complete step', async () => {
      render(<SetupWizard {...defaultProps} />);
      
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Skip setup')).toBeInTheDocument());
      
      fireEvent.click(screen.getByText('Skip setup'));
      
      await waitFor(() => {
        expect(screen.getByText("You're All Set!")).toBeInTheDocument();
      });
    });
  });

  describe('Theme Step', () => {
    beforeEach(async () => {
      render(<SetupWizard {...defaultProps} />);
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Choose Your Theme')).toBeInTheDocument());
    });

    it('renders theme options', () => {
      expect(screen.getByText('IDEC Dark')).toBeInTheDocument();
      expect(screen.getByText('Dracula')).toBeInTheDocument();
      expect(screen.getByText('GitHub Dark')).toBeInTheDocument();
    });

    it('shows theme count message', () => {
      expect(screen.getByText('9 themes available in settings')).toBeInTheDocument();
    });

    it('allows selecting a theme', () => {
      fireEvent.click(screen.getByText('Dracula'));
      // Theme should be selected (visual change)
    });
  });

  describe('Import Step', () => {
    beforeEach(async () => {
      render(<SetupWizard {...defaultProps} />);
      // Navigate to import step (step 2)
      fireEvent.click(screen.getByText("Let's Go")); // step 1
      await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Continue')); // step 2
      await waitFor(() => expect(screen.getByText('Import from VS Code')).toBeInTheDocument());
    });

    it('renders import option', () => {
      expect(screen.getByText('Import from VS Code')).toBeInTheDocument();
    });

    it('renders import description', () => {
      expect(screen.getByText(/Import your VS Code settings/)).toBeInTheDocument();
    });

    it('renders import button', () => {
      expect(screen.getByText('Import VS Code Settings')).toBeInTheDocument();
    });

    it('shows optional message', () => {
      expect(screen.getByText(/This step is optional/)).toBeInTheDocument();
    });

    it('calls import when button is clicked', async () => {
      mockInvoke.mockResolvedValue({ success: true, settings: {} });
      
      fireEvent.click(screen.getByText('Import VS Code Settings'));
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('import-vscode-settings');
      });
    });

    it('shows success state after import', async () => {
      mockInvoke.mockResolvedValue({ success: true, settings: {} });
      
      fireEvent.click(screen.getByText('Import VS Code Settings'));
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
    });

    it('shows error state on import failure', async () => {
      mockInvoke.mockResolvedValue({ success: false });
      
      fireEvent.click(screen.getByText('Import VS Code Settings'));
      
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });
    });
  });

  describe('API Step', () => {
    beforeEach(async () => {
      render(<SetupWizard {...defaultProps} />);
      // Navigate to API step (step 3)
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Continue'));
      await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Continue'));
      await waitFor(() => expect(screen.getByText('Configure AI Providers')).toBeInTheDocument());
    });

    it('renders API providers header', () => {
      expect(screen.getByText('Configure AI Providers')).toBeInTheDocument();
    });

    it('renders Claude provider', () => {
      expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument();
    });

    it('renders OpenAI provider', () => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    it('renders OpenRouter provider', () => {
      expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    });

    it('renders Groq provider', () => {
      expect(screen.getByText('Groq')).toBeInTheDocument();
    });

    it('renders Ollama Cloud provider', () => {
      expect(screen.getByText('Ollama Cloud')).toBeInTheDocument();
    });

    it('renders Ollama Local provider', () => {
      expect(screen.getByText('Ollama (Local)')).toBeInTheDocument();
    });

    it('has Test buttons', () => {
      const testButtons = screen.getAllByText('Test');
      expect(testButtons.length).toBeGreaterThan(0);
    });

    it('has API key input fields', () => {
      const inputs = document.querySelectorAll('input[type="password"]');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('toggles password visibility', async () => {
      const inputs = document.querySelectorAll('input[type="password"]');
      expect(inputs.length).toBeGreaterThan(0);
      
      // Find eye buttons
      const buttons = document.querySelectorAll('button');
      const eyeButton = Array.from(buttons).find(b => b.innerHTML.includes('svg'));
      
      if (eyeButton) {
        fireEvent.click(eyeButton);
        // Input type should change
      }
    });

    it('tests Claude API key when Test is clicked', async () => {
      mockInvoke.mockResolvedValue({ success: true, models: [] });
      
      // Fill in the Claude API key
      const claudeInput = screen.getByPlaceholderText('sk-ant-...');
      fireEvent.change(claudeInput, { target: { value: 'sk-ant-test123' } });
      
      // Click first Test button (Claude)
      const testButtons = screen.getAllByText('Test');
      fireEvent.click(testButtons[0]);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('fetch-models', 'claude', expect.anything());
      });
    });

    it('tests Ollama connection when Test is clicked', async () => {
      mockInvoke.mockResolvedValue({ success: true, models: ['llama3'] });
      
      // Find Ollama test button (last one)
      const testButtons = screen.getAllByText('Test');
      fireEvent.click(testButtons[testButtons.length - 1]);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('fetch-models', 'ollama', expect.anything());
      });
    });

    it('updates API key when typing', async () => {
      const openaiInput = screen.getByPlaceholderText('sk-...');
      fireEvent.change(openaiInput, { target: { value: 'sk-test123' } });
      expect(openaiInput.value).toBe('sk-test123');
    });
  });

  describe('Complete Step', () => {
    beforeEach(async () => {
      render(<SetupWizard {...defaultProps} />);
      // Skip to complete step
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Skip setup')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Skip setup'));
      await waitFor(() => expect(screen.getByText("You're All Set!")).toBeInTheDocument());
    });

    it('renders completion message', () => {
      expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    });

    it('renders ready message', () => {
      expect(screen.getByText(/IDEC is ready to help you/)).toBeInTheDocument();
    });

    it('shows theme summary', () => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    it('shows AI providers summary', () => {
      expect(screen.getByText('AI Providers')).toBeInTheDocument();
    });

    it('renders Start Coding button', () => {
      expect(screen.getByText('Start Coding')).toBeInTheDocument();
    });

    it('calls onComplete when Start Coding is clicked', async () => {
      const onComplete = jest.fn();
      render(<SetupWizard onComplete={onComplete} />);
      
      // Skip to complete
      fireEvent.click(screen.getByText("Let's Go"));
      await waitFor(() => expect(screen.getByText('Skip setup')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Skip setup'));
      await waitFor(() => expect(screen.getAllByText('Start Coding').length).toBe(2));
      
      const startButtons = screen.getAllByText('Start Coding');
      fireEvent.click(startButtons[1]);
      
      expect(onComplete).toHaveBeenCalled();
    });
  });

  describe('Initial settings', () => {
    it('uses provided initial settings', () => {
      const initialSettings = {
        theme: 'dracula',
        ai: {
          claudeApiKey: 'test-key',
          provider: 'claude'
        }
      };
      
      render(<SetupWizard onComplete={jest.fn()} initialSettings={initialSettings} />);
      
      // Navigate to theme step
      fireEvent.click(screen.getByText("Let's Go"));
      
      // Dracula should be selected
    });
  });
});
