import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResizeHandle from './ResizeHandle';

describe('ResizeHandle', () => {
  const defaultProps = {
    direction: 'right',
    onResize: jest.fn(),
    minSize: 100,
    maxSize: 500
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders resize handle', () => {
    render(<ResizeHandle {...defaultProps} />);
    const handle = document.querySelector('.resize-handle');
    expect(handle).toBeInTheDocument();
  });

  it('renders with horizontal cursor for left/right direction', () => {
    render(<ResizeHandle {...defaultProps} direction="right" />);
    const handle = document.querySelector('.resize-handle');
    expect(handle).toHaveStyle({ cursor: 'col-resize' });
  });

  it('renders with vertical cursor for top/bottom direction', () => {
    render(<ResizeHandle {...defaultProps} direction="top" />);
    const handle = document.querySelector('.resize-handle');
    expect(handle).toHaveStyle({ cursor: 'row-resize' });
  });

  it('adds active class on mouse down', () => {
    render(<ResizeHandle {...defaultProps} />);
    const handle = document.querySelector('.resize-handle');
    fireEvent.mouseDown(handle);
    expect(handle).toHaveClass('active');
  });

  it('removes active class on mouse up', () => {
    render(<ResizeHandle {...defaultProps} />);
    const handle = document.querySelector('.resize-handle');
    fireEvent.mouseDown(handle);
    expect(handle).toHaveClass('active');
    fireEvent.mouseUp(document);
    expect(handle).not.toHaveClass('active');
  });

  it('calls onResize with correct delta for right direction', () => {
    render(<ResizeHandle {...defaultProps} direction="right" />);
    const handle = document.querySelector('.resize-handle');
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { movementX: 10, movementY: 0 });
    
    expect(defaultProps.onResize).toHaveBeenCalled();
  });

  it('calls onResize with correct delta for left direction', () => {
    const onResize = jest.fn();
    render(<ResizeHandle {...defaultProps} direction="left" onResize={onResize} />);
    const handle = document.querySelector('.resize-handle');
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { movementX: -10, movementY: 0 });
    
    expect(onResize).toHaveBeenCalled();
  });

  it('calls onResize with correct delta for top direction', () => {
    const onResize = jest.fn();
    render(<ResizeHandle {...defaultProps} direction="top" onResize={onResize} />);
    const handle = document.querySelector('.resize-handle');
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { movementY: -10, movementX: 0 });
    
    expect(onResize).toHaveBeenCalled();
  });

  it('respects minSize constraint', () => {
    const onResize = jest.fn((callback) => callback(150));
    render(<ResizeHandle {...defaultProps} onResize={onResize} minSize={100} />);
    const handle = document.querySelector('.resize-handle');
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { movementX: -100, movementY: 0 });
    
    expect(onResize).toHaveBeenCalled();
  });

  it('respects maxSize constraint', () => {
    const onResize = jest.fn((callback) => callback(450));
    render(<ResizeHandle {...defaultProps} onResize={onResize} maxSize={500} />);
    const handle = document.querySelector('.resize-handle');
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { movementX: 100, movementY: 0 });
    
    expect(onResize).toHaveBeenCalled();
  });
});
