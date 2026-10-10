import type { JSX } from 'preact';

export interface TextFieldProps {
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'password' | 'url';
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

export function TextField({
  value,
  onChange,
  type = 'text',
  label,
  placeholder,
  error,
  disabled = false,
  id,
  ariaLabel,
  className = '',
  min,
  max,
  autoFocus,
}: TextFieldProps) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;

  const handleInput = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  };

  const inputStyle: JSX.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border-color)'}`,
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'text',
    opacity: disabled ? 0.6 : 1,
    transition: 'border-color var(--transition-fast)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} className={`text-field ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        min={min}
        max={max}
        autoFocus={autoFocus}
        style={inputStyle}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: '11px', color: 'var(--color-danger)' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
