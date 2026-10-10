import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage, registerMessageRouter } from '../../src/background/message-router';
import { testConnection } from '../../src/background/health-check';
import { SESSION_ERRORS_KEY, type ProxyErrorEntry } from '../../src/background/errors';
import { SESSION_STATUS_KEY, type ProxyControllerStatus } from '../../src/background/proxy-controller';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile, Rule } from '../../src/core/types';
import { sendMessage } from '../../src/shared/messaging';
import { setState, STATE_STORAGE_KEY } from '../../src/shared/storage';
import { type ChromeMockController, installChromeMock } from '../setup/chrome-mock';

describe('Messaging & Health Check (Task 9)', () => {
  let mockCtrl: ChromeMockController;

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET_STATUS message', () => {
    it('returns default status when session storage is empty', async () => {
      const state = createDefaultState();
      await setState(state);

      const res = await handleMessage({ type: 'GET_STATUS' });

      expect(res).toEqual({
        levelOfControl: 'controllable_by_this_extension',
        mode: { kind: 'direct' },
        errors: [],
        warnings: [],
      });
    });

    it('returns levelOfControl and errors from session storage', async () => {
      const state = createDefaultState();
      await setState(state);

      const status: ProxyControllerStatus = {
        levelOfControl: 'controlled_by_this_extension',
        controlled: true,
        warnings: [],
        appliedAt: new Date().toISOString(),
      };
      mockCtrl.setRaw('session', SESSION_STATUS_KEY, status);

      const errorEntry: ProxyErrorEntry = {
        at: new Date().toISOString(),
        error: 'ERR_PROXY_CONNECTION_FAILED',
        details: 'Refused',
        fatal: true,
      };
      mockCtrl.setRaw('session', SESSION_ERRORS_KEY, [errorEntry]);

      const res = (await handleMessage({ type: 'GET_STATUS' })) as Record<string, unknown>;

      expect(res.levelOfControl).toBe('controlled_by_this_extension');
      expect(res.errors).toEqual([errorEntry]);
    });

    it('adds warning when controlled by another extension', async () => {
      const state = createDefaultState();
      await setState(state);

      const status: ProxyControllerStatus = {
        levelOfControl: 'controlled_by_other_extensions',
        controlled: false,
        warnings: [],
        appliedAt: new Date().toISOString(),
      };
      mockCtrl.setRaw('session', SESSION_STATUS_KEY, status);

      const res = (await handleMessage({ type: 'GET_STATUS' })) as { warnings: string[] };

      expect(res.warnings).toContain(
        'Cài đặt proxy đang bị điều khiển bởi tiện ích mở rộng khác.'
      );
    });

    it('adds warning when not controllable', async () => {
      const state = createDefaultState();
      await setState(state);

      const status: ProxyControllerStatus = {
        levelOfControl: 'not_controllable',
        controlled: false,
        warnings: [],
        appliedAt: new Date().toISOString(),
      };
      mockCtrl.setRaw('session', SESSION_STATUS_KEY, status);

      const res = (await handleMessage({ type: 'GET_STATUS' })) as { warnings: string[] };

      expect(res.warnings).toContain(
        'Cài đặt proxy không thể điều khiển (bị khóa bởi chính sách hệ thống).'
      );
    });

    it('warns about orphan rules pointing to non-existent profiles', async () => {
      const orphanRule: Rule = {
        id: 'rule-orphan',
        pattern: 'example.com',
        matchType: 'wildcard',
        target: { type: 'profile', profileId: 'non-existent-profile' },
        enabled: true,
      };

      const state: AppState = {
        ...createDefaultState(),
        rules: [orphanRule],
      };
      mockCtrl.setRaw('local', STATE_STORAGE_KEY, state);

      const res = (await handleMessage({ type: 'GET_STATUS' })) as { warnings: string[] };

      expect(res.warnings.some((w) => w.includes('quy tắc trỏ tới profile không tồn tại'))).toBe(
        true
      );
    });

    it('warns when fixed mode points to non-existent profile', async () => {
      const status: ProxyControllerStatus = {
        levelOfControl: 'controllable_by_this_extension',
        controlled: true,
        warnings: ['Profile "missing-p" không tồn tại, proxy đang fallback về direct.'],
        appliedAt: new Date().toISOString(),
      };
      mockCtrl.setRaw('session', SESSION_STATUS_KEY, status);

      const res = (await handleMessage({ type: 'GET_STATUS' })) as { warnings: string[] };

      expect(res.warnings.some((w) => w.includes('Profile "missing-p" không tồn tại'))).toBe(true);
    });
  });

  describe('Health Check (testConnection & TEST_CONNECTION message)', () => {
    it('returns ok: true with latency when health check succeeds (204)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
      });
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      state.settings.ipCheckUrl = ''; // không check IP

      const result = await testConnection(state);

      expect(result.ok).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.ip).toBeUndefined();
    });

    it('fetches and resolves public IP when ipCheckUrl returns JSON', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          statusText: 'No Content',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ ip: '203.0.113.195' }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      state.settings.ipCheckUrl = 'https://api.ipify.org?format=json';

      const result = await testConnection(state);

      expect(result.ok).toBe(true);
      expect(result.ip).toBe('203.0.113.195');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('fetches and resolves public IP when ipCheckUrl returns plain text', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          statusText: 'No Content',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: async () => '198.51.100.42\n',
        });
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      state.settings.ipCheckUrl = 'https://checkip.amazonaws.com';

      const result = await testConnection(state);

      expect(result.ok).toBe(true);
      expect(result.ip).toBe('198.51.100.42');
    });

    it('returns ok: false when healthCheckUrl returns HTTP error (e.g. 502)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      const result = await testConnection(state);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('HTTP 502');
    });

    it('handles network error cleanly', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch (DNS error)'));
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      const result = await testConnection(state);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Failed to fetch (DNS error)');
    });

    it('handles timeout (AbortError)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const fetchMock = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      const result = await testConnection(state);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Hết thời gian chờ');
    });
  });

  describe('CLEAR_ERRORS message', () => {
    it('clears session errors and returns ok: true', async () => {
      await setState(createDefaultState());
      mockCtrl.setRaw('session', SESSION_ERRORS_KEY, [
        { at: new Date().toISOString(), error: 'ERR_FAIL', details: '', fatal: true },
      ]);
      await chrome.action.setBadgeText({ text: '!' });

      const res = await handleMessage({ type: 'CLEAR_ERRORS' });

      expect(res).toEqual({ ok: true });
      expect(mockCtrl.getRaw('session')[SESSION_ERRORS_KEY]).toEqual([]);
      expect(mockCtrl.action.getBadgeText()).toBe(''); // direct mode badge
    });
  });

  describe('sendMessage() end-to-end via chrome.runtime', () => {
    it('dispatches GET_STATUS through chrome.runtime.onMessage and receives response', async () => {
      const profile: ProxyProfile = {
        id: 'p-1',
        name: 'Work Proxy',
        color: '#0088cc',
        scheme: 'http',
        host: '10.0.0.1',
        port: 8080,
        bypassList: [],
      };

      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: 'p-1' },
        profiles: [profile],
      };
      await setState(state);

      registerMessageRouter();

      const response = await sendMessage({ type: 'GET_STATUS' });

      expect(response.mode).toEqual({ kind: 'fixed', profileId: 'p-1' });
      expect(response.levelOfControl).toBe('controllable_by_this_extension');
      expect(response.errors).toEqual([]);
      expect(response.warnings).toEqual([]);
    });

    it('dispatches TEST_CONNECTION through chrome.runtime and receives health result', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', fetchMock);

      const state = createDefaultState();
      state.settings.ipCheckUrl = '';
      await setState(state);

      registerMessageRouter();

      const response = await sendMessage({ type: 'TEST_CONNECTION' });

      expect(response.ok).toBe(true);
      expect(typeof response.latencyMs).toBe('number');
    });

    it('returns error for invalid message', async () => {
      const res = await handleMessage({ type: 'UNKNOWN_ACTION' });
      expect(res).toEqual({
        ok: false,
        error: 'Loại tin nhắn không hỗ trợ: UNKNOWN_ACTION',
      });
    });
  });
});
