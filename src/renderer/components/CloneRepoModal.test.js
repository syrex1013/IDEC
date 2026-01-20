import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CloneRepoModal from './CloneRepoModal';

// Use the global mock from setup.js
const mockInvoke = global.__mockInvoke;

describe('CloneRepoModal', () => {
  const defaultProps = {
    onClose: jest.fn(),
    onCloneComplete: jest.fn(),
    initialUrl: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
  });

  it('renders modal with title', () => {
    render(<CloneRepoModal {...defaultProps} />);
    expect(screen.getByText('Clone Repository')).toBeInTheDocument();
  });

  it('renders repository URL input', () => {
    render(<CloneRepoModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/https:\/\/github.com/)).toBeInTheDocument();
  });

  it('renders clone to input with browse button', () => {
    render(<CloneRepoModal {...defaultProps} />);
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('pre-fills URL when initialUrl is provided', () => {
    render(<CloneRepoModal {...defaultProps} initialUrl="https://github.com/test/repo.git" />);
    const input = screen.getByPlaceholderText(/https:\/\/github.com/);
    expect(input.value).toBe('https://github.com/test/repo.git');
  });

  it('calls onClose when close button is clicked', () => {
    render(<CloneRepoModal {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(<CloneRepoModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('updates URL on input', () => {
    render(<CloneRepoModal {...defaultProps} />);
    const input = screen.getByPlaceholderText(/https:\/\/github.com/);
    fireEvent.change(input, { target: { value: 'https://github.com/user/repo.git' } });
    expect(input.value).toBe('https://github.com/user/repo.git');
  });

  it('calls select-directory when Browse is clicked', async () => {
    mockInvoke.mockResolvedValue('/test/path');
    render(<CloneRepoModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Browse'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
  });

  it('disables clone button when URL and path are empty', () => {
    render(<CloneRepoModal {...defaultProps} />);
    
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    expect(cloneButton).toBeDisabled();
  });

  it('shows error for invalid URL format', async () => {
    mockInvoke.mockResolvedValueOnce('/test/path');
    render(<CloneRepoModal {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/https:\/\/github.com/);
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } });
    
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
    
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    fireEvent.click(cloneButton);
    
    // Error is set synchronously
    expect(screen.getByText(/Invalid repository URL/)).toBeInTheDocument();
  });

  it('accepts shorthand GitHub URL format', async () => {
    mockInvoke
      .mockResolvedValueOnce('/test/path')
      .mockResolvedValueOnce({ success: true, path: '/test/path/react' });
    
    const onCloneComplete = jest.fn();
    render(<CloneRepoModal {...defaultProps} onCloneComplete={onCloneComplete} />);
    
    const urlInput = screen.getByPlaceholderText(/https:\/\/github.com/);
    fireEvent.change(urlInput, { target: { value: 'facebook/react' } });
    
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
    
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    fireEvent.click(cloneButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git-clone',
        'https://github.com/facebook/react.git',
        '/test/path/react'
      );
    });
  });

  it('clones repository successfully', async () => {
    mockInvoke
      .mockResolvedValueOnce('/test/path')
      .mockResolvedValueOnce({ success: true, path: '/test/path/repo' });
    
    const onCloneComplete = jest.fn();
    render(<CloneRepoModal {...defaultProps} onCloneComplete={onCloneComplete} />);
    
    const urlInput = screen.getByPlaceholderText(/https:\/\/github.com/);
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
    
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    fireEvent.click(cloneButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'git-clone',
        'https://github.com/user/repo.git',
        '/test/path/repo'
      );
    });
  });

  it('shows error on clone failure', async () => {
    mockInvoke
      .mockResolvedValueOnce('/test/path')
      .mockResolvedValueOnce({ success: false, error: 'Clone failed' });
    
    render(<CloneRepoModal {...defaultProps} />);
    
    const urlInput = screen.getByPlaceholderText(/https:\/\/github.com/);
    fireEvent.change(urlInput, { target: { value: 'https://github.com/user/repo.git' } });
    
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
    
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    fireEvent.click(cloneButton);
    
    await waitFor(() => {
      expect(screen.getByText('Clone failed')).toBeInTheDocument();
    });
  });

  it('validates URL is required', () => {
    render(<CloneRepoModal {...defaultProps} />);
    
    // Clone button should be disabled without URL/path
    const cloneButton = screen.getByRole('button', { name: /clone/i });
    expect(cloneButton).toBeDisabled();
  });
});
