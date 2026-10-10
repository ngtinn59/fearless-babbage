import { useEffect, useState } from 'preact/hooks';
import type { AppState } from '../../core/types';
import { getState, subscribe, updateState as persistUpdateState } from '../../shared/storage';

export interface UseAppStateResult {
  state: AppState | null;
  loading: boolean;
  error: string | null;
  updateState: (updater: (prev: AppState) => AppState | Promise<AppState>) => Promise<boolean>;
  clearError: () => void;
}

export function useAppState(): UseAppStateResult {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Tải state ban đầu
    getState()
      .then((s) => {
        if (mounted) {
          setState(s);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Không thể tải cấu hình');
          setLoading(false);
        }
      });

    // 2. Lắng nghe thay đổi storage từ background hoặc trang khác
    const unsubscribe = subscribe((newState) => {
      if (mounted) {
        setState(newState);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // 3. Đồng bộ giao diện Dark/Light mode theo settings.theme
  useEffect(() => {
    if (typeof document === 'undefined' || !state) return;
    const theme = state.settings.theme;
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [state?.settings.theme]);

  const update = async (
    updater: (prev: AppState) => AppState | Promise<AppState>
  ): Promise<boolean> => {
    try {
      setError(null);
      const newState = await persistUpdateState(updater);
      setState(newState);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật cấu hình';
      setError(msg);
      return false;
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    state,
    loading,
    error,
    updateState: update,
    clearError,
  };
}
