import type { ComponentChildren, JSX } from 'preact';

export interface ButtonProps {
  children: ComponentChildren;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  className?: string;
  title?: string;
  autoFocus?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  ariaLabel,
  className = '',
  title,
  autoFocus,
}: ButtonProps) {
  const baseStyle: JSX.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    fontWeight: 500,
    transition: 'background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
    border: '1px solid transparent',
    userSelect: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    gap: '6px',
  };

  const sizeStyles: Record<string, JSX.CSSProperties> = {
    sm: { padding: '4px 8px', fontSize: '12px', minHeight: '26px' },
    md: { padding: '6px 12px', fontSize: '13px', minHeight: '32px' },
    lg: { padding: '8px 16px', fontSize: '14px', minHeight: '40px' },
  };

  const variantStyles: Record<string, JSX.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: '#ffffff',
      borderColor: 'var(--color-primary)',
    },
    secondary: {
      backgroundColor: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      borderColor: 'var(--border-color)',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: '#ffffff',
      borderColor: 'var(--color-danger)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      borderColor: 'transparent',
    },
  };

  const style: JSX.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      autoFocus={autoFocus}
      style={style}
      className={`btn btn-${variant} btn-${size} ${className}`}
    >
      {loading ? '...' : children}
    </button>
  );
}
