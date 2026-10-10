import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _setLastNotificationTimestamp,
  clearErrors,
  MAX_ERROR_ENTRIES,
  type ProxyErrorEntry,
  recordProxyError,
  registerErrorHandler,
  SESSION_ERRORS_KEY,
} from '../../src/background/errors';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState } from '../../src/core/types';
import { setState } from '../../src/shared/storage';
import {
  type ChromeMockController,
  installChromeMock,
} from '../setup/chrome-mock';

describe('Background: Proxy Error Handling (Task 8)', () => {
  let mockCtrl: ChromeMockController;

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
    _setLastNotificationTimestamp(0);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Ring buffer (50 items)', () => {
    it('records error with timestamp, details and fatal flag into storage.session', async () => {
      await setState(createDefaultState());

      await recordProxyError('net::ERR_PROXY_CONNECTION_FAILED', 'Connection refused', true);

      const errors = mockCtrl.getRaw('session')[SESSION_ERRORS_KEY] as ProxyErrorEntry[];
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('net::ERR_PROXY_CONNECTION_FAILED');
      expect(errors[0].details).toBe('Connection refused');
      expect(errors[0].fatal).toBe(true);
      expect(errors[0].at).toBeDefined();
      expect(mockCtrl.action.getBadgeText()).toBe('!');
    });

    it('caps ring buffer at exactly 50 entries when adding 55 errors', async () => {
      await setState(createDefaultState());

      for (let i = 1; i <= 55; i++) {
        await recordProxyError(`ERR_${i}`, `Details ${i}`, false);
      }

      const errors = mockCtrl.getRaw('session')[SESSION_ERRORS_KEY] as ProxyErrorEntry[];
      expect(errors).toHaveLength(MAX_ERROR_ENTRIES);
      expect(errors[0].error).toBe('ERR_6'); // First 5 dropped
      expect(errors[49].error).toBe('ERR_55');
    });
  });

  describe('Notification throttling (30s limit)', () => {
    it('creates Chrome notification on fatal error when notifyOnError is true', async () => {
      const state: AppState = {
        ...createDefaultState(),
        settings: {
          ...createDefaultState().settings,
          notifyOnError: true,
        },
      };
      await setState(state);

      await recordProxyError('ERR_FATAL', 'Fatal crash', true);

      const notifications = mockCtrl.notifications.getCreated();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Smart Proxy');
      expect(notifications[0].message).toContain('ERR_FATAL');
    });

    it('does not send notification for non-fatal errors', async () => {
      const state: AppState = {
        ...createDefaultState(),
        settings: {
          ...createDefaultState().settings,
          notifyOnError: true,
        },
      };
      await setState(state);

      await recordProxyError('ERR_MINOR', 'Minor issue', false);

      expect(mockCtrl.notifications.getCreated()).toHaveLength(0);
    });

    it('throttles notifications so only 1 is sent within 30 seconds', async () => {
      const state: AppState = {
        ...createDefaultState(),
        settings: {
          ...createDefaultState().settings,
          notifyOnError: true,
        },
      };
      await setState(state);

      // 1st error -> sends notification
      await recordProxyError('ERR_1', 'Details 1', true);
      expect(mockCtrl.notifications.getCreated()).toHaveLength(1);

      // Advance 10 seconds -> within throttle window, should not send another notification
      vi.advanceTimersByTime(10_000);
      await recordProxyError('ERR_2', 'Details 2', true);
      expect(mockCtrl.notifications.getCreated()).toHaveLength(1);

      // Advance another 21 seconds (total 31s > 30s) -> throttle expired, sends 2nd notification
      vi.advanceTimersByTime(21_000);
      await recordProxyError('ERR_3', 'Details 3', true);
      expect(mockCtrl.notifications.getCreated()).toHaveLength(2);
    });

    it('does not send notification when settings.notifyOnError is false', async () => {
      const state: AppState = {
        ...createDefaultState(),
        settings: {
          ...createDefaultState().settings,
          notifyOnError: false,
        },
      };
      await setState(state);

      await recordProxyError('ERR_FATAL', 'Fatal crash', true);
      expect(mockCtrl.notifications.getCreated()).toHaveLength(0);
    });
  });

  describe('clearErrors()', () => {
    it('empties session errors and clears the ! badge', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
      };
      await setState(state);

      await recordProxyError('ERR_TEST', 'Test', true);
      expect(mockCtrl.action.getBadgeText()).toBe('!');

      await clearErrors();

      const errors = mockCtrl.getRaw('session')[SESSION_ERRORS_KEY] as ProxyErrorEntry[];
      expect(errors).toEqual([]);
      expect(mockCtrl.action.getBadgeText()).toBe('AUTO'); // restored from state
    });
  });

  describe('registerErrorHandler()', () => {
    it('registers proxy error listener and responds to dispatched error', async () => {
      await setState(createDefaultState());
      registerErrorHandler();

      mockCtrl.proxy.dispatchProxyError({
        error: 'net::ERR_TUNNEL_CONNECTION_FAILED',
        details: 'Proxy tunnel refused',
        fatal: true,
      });

      // Allow async handlers to process
      await vi.advanceTimersByTimeAsync(50);

      const errors = mockCtrl.getRaw('session')[SESSION_ERRORS_KEY] as ProxyErrorEntry[];
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('net::ERR_TUNNEL_CONNECTION_FAILED');
      expect(mockCtrl.action.getBadgeText()).toBe('!');
    });
  });
});
