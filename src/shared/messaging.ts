import type { Mode } from '../core/types';
import type { ProxyErrorEntry } from '../background/errors';

export type RequestMessage =
  | { type: 'GET_STATUS' }
  | { type: 'TEST_CONNECTION' }
  | { type: 'CLEAR_ERRORS' };

export interface StatusResponse {
  levelOfControl: string;
  mode: Mode;
  errors: ProxyErrorEntry[];
  warnings: string[];
}

export interface TestConnectionResponse {
  ok: boolean;
  latencyMs?: number;
  ip?: string;
  error?: string;
}

export interface ClearErrorsResponse {
  ok: true;
}

export type ResponseFor<T extends RequestMessage> =
  T extends { type: 'GET_STATUS' }
    ? StatusResponse
    : T extends { type: 'TEST_CONNECTION' }
      ? TestConnectionResponse
      : T extends { type: 'CLEAR_ERRORS' }
        ? ClearErrorsResponse
        : never;

/**
 * Gửi message từ UI (Popup/Options) tới background service worker với type safety.
 */
export async function sendMessage<R extends RequestMessage>(
  message: R
): Promise<ResponseFor<R>> {
  return chrome.runtime.sendMessage(message) as Promise<ResponseFor<R>>;
}
