import type { JSX } from 'preact';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

export function Select({
  options,
  value,
  onChange,
  label,
  error,
  disabled = false,
  id,
  ariaLabel,
  className = '',
}: SelectProps) {
  const inputId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;

  const handleChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    onChange(e.currentTarget.value);
  };

  const selectStyle: JSX.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border-color)'}`,
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'border-color var(--transition-fast)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} className={`select-field ${className}`}>
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
      <select
        id={inputId}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        style={selectStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
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
