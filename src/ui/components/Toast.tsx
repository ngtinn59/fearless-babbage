import { useEffect } from 'preact/hooks';
import type { JSX } from 'preact';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
  isOpen?: boolean;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  isOpen = true,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen || duration <= 0 || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen || !message) return null;

  const typeStyles: Record<string, JSX.CSSProperties> = {
    info: {
      backgroundColor: 'var(--color-info-bg)',
      color: 'var(--color-info-text)',
      borderColor: 'var(--color-info)',
    },
    success: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success-text)',
      borderColor: 'var(--color-success)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-warning-text)',
      borderColor: 'var(--color-warning)',
    },
    error: {
      backgroundColor: 'var(--color-danger-bg)',
      color: 'var(--color-danger-text)',
      borderColor: 'var(--color-danger)',
    },
  };

  const toastStyle: JSX.CSSProperties = {
    position: 'fixed',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2000,
    minWidth: '220px',
    maxWidth: '90%',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    border: '1px solid',
    transition: 'all var(--transition-fast)',
    ...typeStyles[type],
  };

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      style={toastStyle}
      className={`toast toast-${type}`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '16px',
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
