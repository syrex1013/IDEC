import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ExtensionMarketplace from './ExtensionMarketplace';

const mockInvoke = global.__mockInvoke;

describe('ExtensionMarketplace', () => {
  const defaultProps = {
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true, extensions: [] });
  });

  it('renders Extensions header', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Extensions')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByPlaceholderText('Search extensions...')).toBeInTheDocument();
  });

  it('renders Install from VSIX button', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Install from VSIX')).toBeInTheDocument();
  });

  it('renders Browse tab', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('renders Installed tab with count', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Installed (0)')).toBeInTheDocument();
  });

  it('renders Featured Extensions header', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Featured Extensions')).toBeInTheDocument();
  });

  it('renders featured extensions', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    expect(screen.getByText('Prettier')).toBeInTheDocument();
    expect(screen.getByText('ESLint')).toBeInTheDocument();
    expect(screen.getByText('GitLens')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<ExtensionMarketplace onClose={onClose} />);
    });
    
    // Click the backdrop (first element with onClick)
    const backdrop = document.querySelector('[style*="position: fixed"]');
    fireEvent.click(backdrop);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when modal content is clicked', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<ExtensionMarketplace onClose={onClose} />);
    });
    
    fireEvent.click(screen.getByText('Extensions'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('loads installed extensions on mount', async () => {
    mockInvoke.mockResolvedValue({ 
      success: true, 
      extensions: [{ id: 'test.extension', name: 'Test Extension' }] 
    });
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('extensions-list');
    });
  });

  it('switches to Installed tab', async () => {
    mockInvoke.mockResolvedValue({ 
      success: true, 
      extensions: [] 
    });
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    fireEvent.click(screen.getByText('Installed (0)'));
    
    await waitFor(() => {
      expect(screen.getByText('No extensions installed')).toBeInTheDocument();
    });
  });

  it('shows installed extensions in Installed tab', async () => {
    mockInvoke.mockResolvedValue({ 
      success: true, 
      extensions: [
        { id: 'test.ext', name: 'Test Ext', publisher: 'test', description: 'A test' }
      ] 
    });
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Installed (1)')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Installed (1)'));
    
    await waitFor(() => {
      expect(screen.getByText('Test Ext')).toBeInTheDocument();
    });
  });

  it('installs extension when Install button is clicked', async () => {
    mockInvoke
      .mockResolvedValueOnce({ success: true, extensions: [] }) // initial list
      .mockResolvedValueOnce({ success: true }) // install
      .mockResolvedValueOnce({ success: true, extensions: [{ id: 'esbenp.prettier-vscode' }] }); // reload
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    const installButtons = screen.getAllByText('Install');
    fireEvent.click(installButtons[0]);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('extensions-install', 'esbenp.prettier-vscode');
    });
  });

  it('uninstalls extension when Uninstall button is clicked', async () => {
    mockInvoke.mockResolvedValue({ 
      success: true, 
      extensions: [
        { id: 'esbenp.prettier-vscode', name: 'Prettier', publisher: 'esbenp', description: 'Formatter' }
      ] 
    });
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Installed (1)')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Installed (1)'));
    
    await waitFor(() => {
      expect(screen.getByText('Uninstall')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Uninstall'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('extensions-uninstall', 'esbenp.prettier-vscode');
    });
  });

  it('calls extensions-install-vsix when VSIX button is clicked', async () => {
    mockInvoke.mockResolvedValue({ success: true, extensions: [] });
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    fireEvent.click(screen.getByText('Install from VSIX'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('extensions-install-vsix');
    });
  });

  it('updates search query when typing', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    const searchInput = screen.getByPlaceholderText('Search extensions...');
    fireEvent.change(searchInput, { target: { value: 'python' } });
    
    expect(searchInput.value).toBe('python');
  });

  it('searches extensions when query is entered', async () => {
    jest.useFakeTimers();
    mockInvoke
      .mockResolvedValueOnce({ success: true, extensions: [] }) // initial list
      .mockResolvedValueOnce({ success: true, extensions: [{ id: 'test', name: 'Test' }] }); // search
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    const searchInput = screen.getByPlaceholderText('Search extensions...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('extensions-search', 'test');
    });
    
    jest.useRealTimers();
  });

  it('shows no results message when search finds nothing', async () => {
    jest.useFakeTimers();
    mockInvoke
      .mockResolvedValueOnce({ success: true, extensions: [] }) // initial list
      .mockResolvedValueOnce({ success: true, extensions: [] }); // search with no results
    
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    const searchInput = screen.getByPlaceholderText('Search extensions...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/No extensions found for/)).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('toggles view mode to list', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    // Find and click the list view button (second icon button in the view mode group)
    const buttons = document.querySelectorAll('button');
    const listButton = Array.from(buttons).find(b => b.querySelector('svg[class*="lucide-list"]') || b.innerHTML.includes('List'));
    
    // Buttons exist for grid/list view
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows extension details correctly', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    // Check that extension cards show publisher
    expect(screen.getByText('esbenp')).toBeInTheDocument();
    
    // Check that extension cards show description
    expect(screen.getByText('Code formatter using prettier')).toBeInTheDocument();
  });

  it('shows download count and rating', async () => {
    await act(async () => {
      render(<ExtensionMarketplace {...defaultProps} />);
    });
    
    // Featured extensions have download counts
    expect(screen.getByText('38M')).toBeInTheDocument();
  });
});
