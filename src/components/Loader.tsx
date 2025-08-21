import React from 'react';
import './Loader.css'; // We'll extract the CSS into a separate file

interface LoaderProps {
  text?: string;
  size?: number;
  color?: string;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({
  text = 'Loading',
  size = 150,
  color = '#0066ff',
  className = ''
}) => {
  const loaderStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    lineHeight: `${size}px`,
    color: color,
    textShadow: `0 0 10px ${color}`,
  };

  const spanStyle: React.CSSProperties = {
    height: `${Math.max(4, size * 0.0267)}px`, // Maintain proportional height
  };

  const spanBeforeStyle: React.CSSProperties = {
    width: `${Math.max(16, size * 0.1067)}px`, // Maintain proportional size
    height: `${Math.max(16, size * 0.1067)}px`,
    background: color,
    boxShadow: `0 0 20px 5px ${color}`,
  };

  const loaderBeforeStyle: React.CSSProperties = {
    borderTop: `3px solid ${color}`,
    borderRight: `3px solid ${color}`,
  };

  return (
    <div className={`loader ${className}`} style={loaderStyle}>
      {text}
      <span style={spanStyle}>
        <span style={spanBeforeStyle}></span>
      </span>
      <style>{`
        .loader::before {
          border-top: 3px solid ${color};
          border-right: 3px solid ${color};
        }
      `}</style>
    </div>
  );
};

export default Loader;