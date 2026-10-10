import { buildProxyConfig } from '../core/config-builder';
import { getState, STATE_STORAGE_KEY } from '../shared/storage';
import { updateBadge } from './badge';

export const SESSION_STATUS_KEY = 'status';

export interface ProxyControllerStatus {
  levelOfControl: chrome.types.LevelOfControl;
  controlled: boolean;
  warnings: string[];
  appliedAt: string;
}

/**
 * Thực hiện áp dụng cấu hình proxy từ storage vào Chrome settings:
 * 1. Đọc state hiện tại qua getState()
 * 2. Sinh ProxyConfig qua buildProxyConfig()
 * 3. Gọi chrome.proxy.settings.set()
 * 4. Kiểm tra levelOfControl; lưu status vào chrome.storage.session
 * 5. Cập nhật icon badge
 */
export async function applyState(): Promise<void> {
  const state = await getState();
  const { config, warnings } = buildProxyConfig(state);

  await chrome.proxy.settings.set({
    value: config as unknown as chrome.proxy.ProxyConfig,
    scope: 'regular',
  });

  const details = await chrome.proxy.settings.get({});
  const level = details.levelOfControl;
  const isControlled =
    level !== 'controlled_by_other_extensions' && level !== 'not_controllable';

  const status: ProxyControllerStatus = {
    levelOfControl: level,
    controlled: isControlled,
    warnings,
    appliedAt: new Date().toISOString(),
  };

  await chrome.storage.session.set({ [SESSION_STATUS_KEY]: status });
  await updateBadge(state);
}

// Hàng đợi promise để tuần tự hóa các lần gọi applyState, chống race condition
let applyQueue: Promise<void> = Promise.resolve();

export function enqueueApplyState(): Promise<void> {
  applyQueue = applyQueue.then(async () => {
    try {
      await applyState();
    } catch (err) {
      console.error('Error applying proxy state:', err);
    }
  });

  return applyQueue;
}

/**
 * Đăng ký các event listener đồng bộ ở top-level của service worker.
 */
export function registerProxyController(): void {
  // Lắng nghe khi cài đặt hoặc cập nhật extension
  chrome.runtime.onInstalled.addListener(() => {
    enqueueApplyState();
  });

  // Lắng nghe khi trình duyệt khởi động
  chrome.runtime.onStartup.addListener(() => {
    enqueueApplyState();
  });

  // Lắng nghe khi AppState trong storage thay đổi
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STATE_STORAGE_KEY]) {
      enqueueApplyState();
    }
  });

  // Áp dụng ngay khi service worker được khởi động
  enqueueApplyState();
}
