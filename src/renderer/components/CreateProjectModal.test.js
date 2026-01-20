import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateProjectModal from './CreateProjectModal';

// Use the global mock from setup.js
const mockInvoke = global.__mockInvoke;

describe('CreateProjectModal', () => {
  const defaultProps = {
    onClose: jest.fn(),
    onProjectCreated: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ success: true });
  });

  it('renders modal with title', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByText('Create New Project')).toBeInTheDocument();
  });

  it('renders project name input', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('my-project')).toBeInTheDocument();
  });

  it('renders location input with browse button', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('renders all project templates', () => {
    render(<CreateProjectModal {...defaultProps} />);
    expect(screen.getByText('Empty Project')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<CreateProjectModal {...defaultProps} />);
    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(<CreateProjectModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('updates project name on input', () => {
    render(<CreateProjectModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('my-project');
    fireEvent.change(input, { target: { value: 'test-project' } });
    expect(input.value).toBe('test-project');
  });

  it('filters invalid characters from project name', () => {
    render(<CreateProjectModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('my-project');
    fireEvent.change(input, { target: { value: 'test project!' } });
    expect(input.value).toBe('testproject');
  });

  it('calls select-directory when Browse is clicked', async () => {
    mockInvoke.mockResolvedValue('/test/path');
    render(<CreateProjectModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Browse'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
  });

  it('disables create button when name and path are empty', () => {
    render(<CreateProjectModal {...defaultProps} />);
    
    const createButton = screen.getByText('Create');
    expect(createButton).toBeDisabled();
  });

  it('creates project successfully', async () => {
    mockInvoke
      .mockResolvedValueOnce('/test/path')
      .mockResolvedValueOnce({ success: true, path: '/test/path/my-project' });
    
    const onProjectCreated = jest.fn();
    render(<CreateProjectModal {...defaultProps} onProjectCreated={onProjectCreated} />);
    
    const input = screen.getByPlaceholderText('my-project');
    fireEvent.change(input, { target: { value: 'my-project' } });
    
    fireEvent.click(screen.getByText('Browse'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('select-directory');
    });
    
    fireEvent.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create-project', '/test/path/my-project', 'empty');
    });
  });

  it('selects different project templates', () => {
    render(<CreateProjectModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('JavaScript'));
    const jsButton = screen.getByText('JavaScript').closest('button');
    expect(jsButton).toHaveStyle({ border: '1px solid var(--primary)' });
  });
});
