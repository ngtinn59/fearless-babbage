import type { JSX } from 'preact';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  ariaLabel,
  className = '',
}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const trackStyle: JSX.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: '38px',
    height: '22px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: checked ? 'var(--color-primary)' : 'var(--border-color)',
    transition: 'background-color var(--transition-fast)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    flexShrink: 0,
  };

  const thumbStyle: JSX.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: checked ? '18px' : '2px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'left var(--transition-fast)',
  };

  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
      }}
      className={`toggle-wrapper ${className}`}
    >
      <div
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={trackStyle}
        className="toggle-track"
      >
        <div style={thumbStyle} className="toggle-thumb" />
      </div>
      {label && <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{label}</span>}
    </label>
  );
}
