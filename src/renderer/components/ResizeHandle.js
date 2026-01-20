import React, { useCallback, useEffect, useState } from 'react';

function ResizeHandle({ direction, onResize, minSize = 100, maxSize = 800 }) {
  const [isDragging, setIsDragging] = useState(false);

  const isHorizontal = direction === 'left' || direction === 'right';

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      let delta;
      if (direction === 'right') {
        delta = e.movementX;
      } else if (direction === 'left') {
        delta = -e.movementX;
      } else if (direction === 'top') {
        delta = -e.movementY;
      } else {
        delta = e.movementY;
      }
      onResize((prev) => Math.min(maxSize, Math.max(minSize, prev + delta)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, direction, onResize, minSize, maxSize]);

  const style = isHorizontal
    ? {
        width: 6,
        cursor: 'col-resize',
        position: 'absolute',
        top: 0,
        bottom: 0,
        [direction]: -3,
        zIndex: 10,
      }
    : {
        height: 6,
        cursor: 'row-resize',
        position: 'absolute',
        left: 0,
        right: 0,
        [direction]: -3,
        zIndex: 10,
      };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`resize-handle ${isDragging ? 'active' : ''}`}
      style={style}
    >
      <div
        className="resize-handle-line"
        style={
          isHorizontal
            ? { width: 2, height: '100%', margin: '0 auto' }
            : { height: 2, width: '100%', margin: 'auto 0' }
        }
      />
    </div>
  );
}

export default ResizeHandle;
