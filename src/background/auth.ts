import type { ProxyProfile } from '../core/types';
import { getState } from '../shared/storage';
import { recordProxyError } from './errors';

export interface AuthChallenger {
  host: string;
  port: number;
}

export interface AuthDetails {
  requestId: string;
  isProxy: boolean;
  challenger: AuthChallenger;
}

/**
 * Tìm thông tin đăng nhập của profile khớp với host và port được yêu cầu.
 */
export function findMatchingProfileAuth(
  profiles: ProxyProfile[],
  challenger: AuthChallenger,
): { username: string; password: string } | null {
  if (!challenger || !challenger.host || !challenger.port) {
    return null;
  }

  const cHost = challenger.host.toLowerCase();
  const cPort = challenger.port;

  const matched = profiles.find(
    (p) =>
      p.host.toLowerCase() === cHost &&
      p.port === cPort &&
      p.auth &&
      typeof p.auth.username === 'string' &&
      p.auth.username.length > 0,
  );

  return matched && matched.auth ? { ...matched.auth } : null;
}

/**
 * Xử lý logic quyết định xác thực và chống vòng lặp (hàm thuần kiểm thử được).
 */
export function handleAuthRequired(
  details: AuthDetails,
  profiles: ProxyProfile[],
  attemptsMap: Map<string, number>,
): chrome.webRequest.BlockingResponse {
  if (!details.isProxy) {
    return {};
  }

  const { requestId, challenger } = details;
  const currentAttempts = (attemptsMap.get(requestId) || 0) + 1;
  attemptsMap.set(requestId, currentAttempts);

  // Lần thứ 2 trở đi cho cùng một request -> sai thông tin đăng nhập, hủy để chống lặp vô hạn
  if (currentAttempts >= 2) {
    console.warn(
      `[Smart Proxy] Sai thông tin đăng nhập proxy cho host ${challenger.host}:${challenger.port} (requestId: ${requestId}). Hủy request.`,
    );
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      recordProxyError(
        'Sai thông tin đăng nhập',
        `Máy chủ proxy ${challenger.host}:${challenger.port} từ chối thông tin đăng nhập (requestId: ${requestId})`,
        true,
      ).catch(() => {});
    }
    return { cancel: true };
  }

  const auth = findMatchingProfileAuth(profiles, challenger);
  if (auth) {
    return {
      authCredentials: {
        username: auth.username,
        password: auth.password,
      },
    };
  }

  // Không có profile khớp -> để Chrome xử lý mặc định (ví dụ hiện form hỏi người dùng)
  return {};
}

// Map lưu trữ số lần thử auth theo requestId trong bộ nhớ service worker
export const authAttempts = new Map<string, number>();

/**
 * Đăng ký listener chrome.webRequest.onAuthRequired đồng bộ ở top-level service worker.
 */
export function registerAuthHandler(): void {
  // Lắng nghe yêu cầu xác thực
  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      // Đọc AppState từ storage để lấy danh sách profiles mới nhất
      getState()
        .then((state) => {
          const res = handleAuthRequired(
            {
              requestId: details.requestId,
              isProxy: details.isProxy,
              challenger: details.challenger,
            },
            state.profiles,
            authAttempts,
          );
          if (callback) {
            callback(res);
          }
        })
        .catch((err) => {
          console.error('Lỗi khi đọc state trong onAuthRequired:', err);
          if (callback) {
            callback({});
          }
        });
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking'],
  );

  // Dọn dẹp requestId khi request hoàn tất thành công
  chrome.webRequest.onCompleted.addListener((details) => {
    authAttempts.delete(details.requestId);
  }, { urls: ['<all_urls>'] });

  // Dọn dẹp requestId khi request bị lỗi
  chrome.webRequest.onErrorOccurred.addListener((details) => {
    authAttempts.delete(details.requestId);
  }, { urls: ['<all_urls>'] });
}
