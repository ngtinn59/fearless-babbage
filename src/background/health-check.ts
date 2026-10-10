import type { AppState } from '../core/types';
import type { TestConnectionResponse } from '../shared/messaging';

export const HEALTH_CHECK_TIMEOUT_MS = 8_000;

/**
 * Kiểm tra kết nối mạng qua proxy hiện tại bằng fetch với timeout 8s.
 */
export async function testConnection(
  state: AppState
): Promise<TestConnectionResponse> {
  const healthCheckUrl =
    state.settings.healthCheckUrl?.trim() || 'https://www.gstatic.com/generate_204';
  const ipCheckUrl = state.settings.ipCheckUrl?.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, HEALTH_CHECK_TIMEOUT_MS);

  try {
    const startTime = performance.now();
    const res = await fetch(healthCheckUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}`,
      };
    }

    let publicIp: string | undefined;

    if (ipCheckUrl) {
      try {
        const ipRes = await fetch(ipCheckUrl, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (ipRes.ok) {
          const contentType = ipRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = (await ipRes.json()) as { ip?: string };
            if (typeof data.ip === 'string') {
              publicIp = data.ip.trim();
            }
          } else {
            const text = await ipRes.text();
            // If the text looks like an IP or contains IP
            const trimmed = text.trim();
            if (trimmed) {
              publicIp = trimmed;
            }
          }
        }
      } catch (ipErr) {
        // Lỗi lấy IP không làm hỏng kết quả test kết nối chính
        console.warn('Không thể lấy địa chỉ IP công khai:', ipErr);
      }
    }

    return {
      ok: true,
      latencyMs,
      ip: publicIp,
    };
  } catch (err: unknown) {
    if (
      (err instanceof Error && err.name === 'AbortError') ||
      controller.signal.aborted
    ) {
      return {
        ok: false,
        error: `Hết thời gian chờ (${HEALTH_CHECK_TIMEOUT_MS / 1000}s)`,
      };
    }

    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối mạng',
    };
  } finally {
    clearTimeout(timer);
  }
}
