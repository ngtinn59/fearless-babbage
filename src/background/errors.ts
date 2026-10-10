import { getState } from '../shared/storage';
import { updateBadge } from './badge';

export const SESSION_ERRORS_KEY = 'errors';
export const MAX_ERROR_ENTRIES = 50;
export const NOTIFICATION_THROTTLE_MS = 30_000;

export interface ProxyErrorEntry {
  at: string;
  error: string;
  details: string;
  fatal: boolean;
}

// Biến lưu mốc thời gian lần cuối gửi thông báo
let lastNotificationTimestamp = 0;

/**
 * Đặt lại mốc thời gian thông báo (dùng cho test hoặc reset).
 */
export function _setLastNotificationTimestamp(ts: number): void {
  lastNotificationTimestamp = ts;
}

export function _getLastNotificationTimestamp(): number {
  return lastNotificationTimestamp;
}

/**
 * Ghi nhận một lỗi proxy mới vào ring buffer 50 mục trong storage.session,
 * cập nhật badge '!' và gửi notification nếu thỏa điều kiện.
 */
export async function recordProxyError(
  error: string,
  details: string,
  fatal: boolean,
): Promise<void> {
  const at = new Date().toISOString();
  const newEntry: ProxyErrorEntry = {
    at,
    error: error || 'UNKNOWN_ERROR',
    details: details || '',
    fatal: Boolean(fatal),
  };

  // 1. Đọc danh sách errors hiện tại từ storage.session
  const rawSession = await chrome.storage.session.get(SESSION_ERRORS_KEY);
  const currentList: ProxyErrorEntry[] = Array.isArray(rawSession[SESSION_ERRORS_KEY])
    ? (rawSession[SESSION_ERRORS_KEY] as ProxyErrorEntry[])
    : [];

  // Ring buffer: thêm vào cuối và giữ tối đa 50 mục gần nhất
  const updatedList = [...currentList, newEntry].slice(-MAX_ERROR_ENTRIES);
  await chrome.storage.session.set({ [SESSION_ERRORS_KEY]: updatedList });

  // 2. Đọc state để lấy settings và cập nhật badge '!'
  const state = await getState();
  await updateBadge(state, true);

  // 3. Nếu notifyOnError bật và lỗi fatal -> gửi thông báo Chrome (tối đa 1 thông báo / 30s)
  if (state.settings.notifyOnError && fatal) {
    const now = Date.now();
    if (now - lastNotificationTimestamp >= NOTIFICATION_THROTTLE_MS) {
      lastNotificationTimestamp = now;
      try {
        const title = chrome.i18n.getMessage('extName') || 'Smart Proxy';
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title,
          message: `Lỗi kết nối proxy (${error}): ${details || 'Kết nối thất bại'}`,
        });
      } catch (e) {
        console.error('Không thể tạo thông báo Chrome:', e);
      }
    }
  }
}

/**
 * Xóa danh sách lỗi trong storage.session và gỡ bỏ badge '!'.
 */
export async function clearErrors(): Promise<void> {
  await chrome.storage.session.set({ [SESSION_ERRORS_KEY]: [] });
  const state = await getState();
  await updateBadge(state, false);
}

/**
 * Đăng ký listener chrome.proxy.onProxyError đồng bộ ở top-level service worker.
 */
export function registerErrorHandler(): void {
  chrome.proxy.onProxyError.addListener((details) => {
    recordProxyError(details.error, details.details, details.fatal).catch((err) => {
      console.error('Lỗi khi ghi nhận proxy error:', err);
    });
  });
}
