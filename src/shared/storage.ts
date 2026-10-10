import { migrate } from '../core/migrate';
import { validateState } from '../core/schema';
import type { AppState } from '../core/types';

export const STATE_STORAGE_KEY = 'state';

/**
 * Lấy AppState hiện tại từ chrome.storage.local.
 * Tự động chuyển qua hàm migrate() để đảm bảo luôn trả về AppState hợp lệ kể cả khi storage rỗng hoặc hỏng.
 */
export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get(STATE_STORAGE_KEY);
  return migrate(result[STATE_STORAGE_KEY]);
}

/**
 * Ghi AppState mới vào chrome.storage.local.
 * Bắt buộc kiểm tra tính hợp lệ qua validateState() trước khi ghi.
 * Nếu không hợp lệ sẽ ném Error kèm danh sách mã lỗi, không ghi đè storage.
 */
export async function setState(nextState: AppState): Promise<void> {
  const validation = validateState(nextState);
  if (!validation.ok) {
    const errorDetails = validation.errors.map((e) => `${e.path || 'root'}: ${e.code}`).join(', ');
    throw new Error(`Invalid AppState: ${errorDetails}`);
  }

  await chrome.storage.local.set({ [STATE_STORAGE_KEY]: validation.value });
}

/**
 * Cập nhật AppState thông qua hàm biến đổi (updater).
 * Đảm bảo đọc state mới nhất, áp dụng hàm biến đổi, validate và ghi lại vào storage.
 */
export async function updateState(
  updater: (current: AppState) => AppState | Promise<AppState>,
): Promise<AppState> {
  const current = await getState();
  const next = await updater(current);
  await setState(next);
  return next;
}

/**
 * Lắng nghe thay đổi của key 'state' trong chrome.storage.local.
 * Trả về một hàm hủy (unsubscribe) để ngừng lắng nghe khi unmount / cleanup.
 */
export function subscribe(callback: (state: AppState) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    if (areaName === 'local' && changes[STATE_STORAGE_KEY]) {
      const { newValue } = changes[STATE_STORAGE_KEY];
      callback(migrate(newValue));
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
