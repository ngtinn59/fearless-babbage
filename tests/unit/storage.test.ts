import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile } from '../../src/core/types';
import {
  getState,
  setState,
  STATE_STORAGE_KEY,
  subscribe,
  updateState,
} from '../../src/shared/storage';
import {
  type ChromeStorageMockController,
  installChromeMock,
} from '../setup/chrome-mock';

describe('Shared Storage Layer (storage.ts)', () => {
  let mockCtrl: ChromeStorageMockController;

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('getState()', () => {
    it('returns default AppState when storage is completely empty', async () => {
      const state = await getState();
      expect(state).toEqual(createDefaultState());
      expect(state.schemaVersion).toBe(1);
      expect(state.mode).toEqual({ kind: 'direct' });
      expect(state.profiles).toEqual([]);
      expect(state.rules).toEqual([]);
    });

    it('returns default AppState when storage is corrupted with primitive string or null', async () => {
      mockCtrl.setRaw('local', STATE_STORAGE_KEY, 'corrupted string');
      let state = await getState();
      expect(state).toEqual(createDefaultState());

      mockCtrl.setRaw('local', STATE_STORAGE_KEY, null);
      state = await getState();
      expect(state).toEqual(createDefaultState());

      mockCtrl.setRaw('local', STATE_STORAGE_KEY, { invalidStructure: 123 });
      state = await getState();
      expect(state).toEqual(createDefaultState());
    });

    it('returns stored state when valid state exists in storage', async () => {
      const sampleProfile: ProxyProfile = {
        id: 'p-1',
        name: 'Work Proxy',
        color: '#123456',
        scheme: 'http',
        host: 'proxy.company.internal',
        port: 8080,
        bypassList: ['<local>'],
      };

      const customState: AppState = {
        schemaVersion: 1,
        mode: { kind: 'fixed', profileId: 'p-1' },
        lastActiveMode: { kind: 'fixed', profileId: 'p-1' },
        profiles: [sampleProfile],
        rules: [],
        settings: {
          theme: 'dark',
          bypassLocal: false,
          notifyOnError: false,
          healthCheckUrl: 'https://example.com/check',
          ipCheckUrl: 'https://example.com/ip',
        },
      };

      await chrome.storage.local.set({ [STATE_STORAGE_KEY]: customState });

      const loaded = await getState();
      expect(loaded).toEqual(customState);
    });
  });

  describe('setState()', () => {
    it('successfully persists valid state into storage', async () => {
      const validState = createDefaultState();
      validState.settings.theme = 'dark';

      await setState(validState);

      const raw = mockCtrl.getRaw('local')[STATE_STORAGE_KEY];
      expect(raw).toEqual(validState);
    });

    it('rejects invalid state and throws error without touching storage', async () => {
      const initialState = createDefaultState();
      await setState(initialState);

      // Create invalid state: mode fixed with non-existent profileId
      const invalidState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: 'ghost-id' },
      };

      await expect(setState(invalidState as AppState)).rejects.toThrow(
        /Invalid AppState.*PROFILE_NOT_FOUND/,
      );

      // Verify storage was not modified
      const currentInStorage = mockCtrl.getRaw('local')[STATE_STORAGE_KEY];
      expect(currentInStorage).toEqual(initialState);
    });

    it('rejects state with invalid profile (e.g. auth on socks5)', async () => {
      const invalidProfile: ProxyProfile = {
        id: 'p-socks',
        name: 'Socks Proxy',
        color: '#ff0000',
        scheme: 'socks5',
        host: '10.0.0.1',
        port: 1080,
        auth: { username: 'u', password: 'p' }, // SOCKS auth is not supported by Chrome API
        bypassList: [],
      };

      const invalidState: AppState = {
        ...createDefaultState(),
        profiles: [invalidProfile],
      };

      await expect(setState(invalidState)).rejects.toThrow(
        /AUTH_NOT_ALLOWED_FOR_SOCKS/,
      );
    });
  });

  describe('updateState()', () => {
    it('reads current, applies updater, and persists new state', async () => {
      const profile: ProxyProfile = {
        id: 'p-1',
        name: 'Home Proxy',
        color: '#00ff00',
        scheme: 'http',
        host: '192.168.1.1',
        port: 3128,
        bypassList: [],
      };

      const result = await updateState((curr) => ({
        ...curr,
        profiles: [...curr.profiles, profile],
      }));

      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].id).toBe('p-1');

      const loaded = await getState();
      expect(loaded.profiles).toHaveLength(1);
    });

    it('supports async updater functions', async () => {
      const result = await updateState(async (curr) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          ...curr,
          settings: {
            ...curr.settings,
            theme: 'light',
          },
        };
      });

      expect(result.settings.theme).toBe('light');
      const loaded = await getState();
      expect(loaded.settings.theme).toBe('light');
    });

    it('rolls back and leaves storage untouched if updater returns invalid state', async () => {
      const baseState = createDefaultState();
      await setState(baseState);

      await expect(
        updateState((curr) => ({
          ...curr,
          mode: { kind: 'fixed', profileId: 'unknown-profile' } as unknown as AppState['mode'],
        })),
      ).rejects.toThrow(/PROFILE_NOT_FOUND/);

      const loaded = await getState();
      expect(loaded).toEqual(baseState);
    });
  });

  describe('subscribe()', () => {
    it('notifies listener when state changes in local storage', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      const nextState = createDefaultState();
      nextState.settings.notifyOnError = false;

      await setState(nextState);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(nextState);

      unsubscribe();
    });

    it('does not notify listener after unsubscribing', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      const state1 = createDefaultState();
      await setState(state1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      const state2 = { ...createDefaultState(), settings: { ...createDefaultState().settings, theme: 'dark' as const } };
      await setState(state2);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('ignores storage changes in other areas (e.g. session)', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      await chrome.storage.session.set({ someSessionKey: 'value' });

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('ignores changes to other keys in local storage', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      await chrome.storage.local.set({ unrelatedKey: 'hello' });

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });
  });
});
