import type { JSX } from 'preact';

export interface BadgeProps {
  text: string;
  color?: string; // Tùy chỉnh màu hex của Profile
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export function Badge({
  text,
  color,
  variant = 'neutral',
  size = 'md',
  className = '',
  title,
}: BadgeProps) {
  const baseStyle: JSX.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const sizeStyle: JSX.CSSProperties =
    size === 'sm'
      ? { padding: '2px 5px', fontSize: '10px' }
      : { padding: '3px 8px', fontSize: '11px' };

  let colorStyle: JSX.CSSProperties;

  if (color) {
    colorStyle = {
      backgroundColor: color,
      color: '#ffffff',
    };
  } else {
    switch (variant) {
      case 'info':
        colorStyle = {
          backgroundColor: 'var(--color-info-bg)',
          color: 'var(--color-info-text)',
        };
        break;
      case 'success':
        colorStyle = {
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success-text)',
        };
        break;
      case 'warning':
        colorStyle = {
          backgroundColor: 'var(--color-warning-bg)',
          color: 'var(--color-warning-text)',
        };
        break;
      case 'danger':
        colorStyle = {
          backgroundColor: 'var(--color-danger-bg)',
          color: 'var(--color-danger-text)',
        };
        break;
      case 'neutral':
      default:
        colorStyle = {
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
        };
        break;
    }
  }

  return (
    <span
      title={title}
      style={{ ...baseStyle, ...sizeStyle, ...colorStyle }}
      className={`badge badge-${variant} ${className}`}
    >
      {text}
    </span>
  );
}
