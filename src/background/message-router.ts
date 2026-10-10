import { getState } from '../shared/storage';
import { clearErrors, type ProxyErrorEntry, SESSION_ERRORS_KEY } from './errors';
import { testConnection } from './health-check';
import { type ProxyControllerStatus, SESSION_STATUS_KEY } from './proxy-controller';
import type {
  ClearErrorsResponse,
  RequestMessage,
  StatusResponse,
  TestConnectionResponse,
} from '../shared/messaging';

/**
 * Xử lý các request message gửi từ UI (Popup / Options).
 */
export async function handleMessage(
  message: unknown
): Promise<StatusResponse | TestConnectionResponse | ClearErrorsResponse | { ok: false; error: string }> {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return { ok: false, error: 'Tin nhắn không hợp lệ' };
  }

  const req = message as RequestMessage;

  switch (req.type) {
    case 'GET_STATUS': {
      const state = await getState();

      // Đọc trạng thái controller từ storage.session
      let levelOfControl = 'controllable_by_this_extension';
      let sessionWarnings: string[] = [];

      try {
        const sessionData = await chrome.storage.session.get([
          SESSION_STATUS_KEY,
          SESSION_ERRORS_KEY,
        ]);
        const status = sessionData[SESSION_STATUS_KEY] as ProxyControllerStatus | undefined;
        if (status) {
          levelOfControl = status.levelOfControl;
          if (Array.isArray(status.warnings)) {
            sessionWarnings = status.warnings;
          }
        }
      } catch (err) {
        console.warn('Không thể đọc status từ session storage:', err);
      }

      // Đọc danh sách lỗi từ storage.session
      let errors: ProxyErrorEntry[] = [];
      try {
        const sessionData = await chrome.storage.session.get(SESSION_ERRORS_KEY);
        const storedErrors = sessionData[SESSION_ERRORS_KEY];
        if (Array.isArray(storedErrors)) {
          errors = storedErrors;
        }
      } catch (err) {
        console.warn('Không thể đọc errors từ session storage:', err);
      }

      // Tính toán danh sách cảnh báo
      const warnings: string[] = [...sessionWarnings];

      if (levelOfControl === 'controlled_by_other_extensions') {
        warnings.push('Cài đặt proxy đang bị điều khiển bởi tiện ích mở rộng khác.');
      } else if (levelOfControl === 'not_controllable') {
        warnings.push('Cài đặt proxy không thể điều khiển (bị khóa bởi chính sách hệ thống).');
      }

      // Kiểm tra orphan rules (quy tắc trỏ tới profile không tồn tại)
      const orphanCount = state.rules.filter((r) => {
        const target = r.target;
        return (
          target.type === 'profile' &&
          !state.profiles.some((p) => p.id === target.profileId)
        );
      }).length;
      if (orphanCount > 0) {
        warnings.push(`Phát hiện ${orphanCount} quy tắc trỏ tới profile không tồn tại.`);
      }

      // Kiểm tra mode fixed trỏ tới profile không tồn tại
      if (state.mode.kind === 'fixed') {
        const targetId = state.mode.profileId;
        if (!state.profiles.some((p) => p.id === targetId)) {
          warnings.push('Profile đang chọn không tồn tại, proxy đang fallback về direct.');
        }
      }

      // Loại bỏ trùng lặp cảnh báo
      const uniqueWarnings = Array.from(new Set(warnings));

      return {
        levelOfControl,
        mode: state.mode,
        errors,
        warnings: uniqueWarnings,
      };
    }

    case 'TEST_CONNECTION': {
      const state = await getState();
      return await testConnection(state);
    }

    case 'CLEAR_ERRORS': {
      await clearErrors();
      return { ok: true };
    }

    default:
      return { ok: false, error: `Loại tin nhắn không hỗ trợ: ${(req as { type: string }).type}` };
  }
}

/**
 * Đăng ký listener chrome.runtime.onMessage đồng bộ ở top-level service worker.
 */
export function registerMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message)
      .then((res) => {
        sendResponse(res);
      })
      .catch((err) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    // Trả về true để cho phép sendResponse gọi bất đồng bộ
    return true;
  });
}
