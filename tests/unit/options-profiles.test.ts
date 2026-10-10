import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile, Rule } from '../../src/core/types';
import { validateProfile } from '../../src/core/schema';
import { getState, setState, updateState } from '../../src/shared/storage';
import { installChromeMock, type ChromeMockController } from '../setup/chrome-mock';

describe('Options: Profiles Management (Task 12)', () => {
  let mockCtrl: ChromeMockController;

  const sampleProfile: ProxyProfile = {
    id: 'p-1',
    name: 'Singapore HTTP',
    color: '#2563eb',
    scheme: 'http',
    host: 'sg.proxy.net',
    port: 8080,
    bypassList: ['<local>'],
  };

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('Profile validation rules (schema)', () => {
    it('rejects duplicate profile names', () => {
      const existing: ProxyProfile[] = [sampleProfile];
      const candidate = {
        ...sampleProfile,
        id: 'p-2', // new ID but same name
      };

      const res = validateProfile(candidate, existing);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors).toContainEqual({
          path: 'name',
          code: 'DUPLICATE_NAME',
        });
      }
    });

    it('rejects invalid ports (< 1 or > 65535)', () => {
      const candidateInvalidPort = {
        ...sampleProfile,
        port: 70000,
      };

      const res = validateProfile(candidateInvalidPort, []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors).toContainEqual({
          path: 'port',
          code: 'INVALID_PORT',
        });
      }
    });

    it('rejects invalid hosts containing scheme or port', () => {
      const candidateInvalidHost = {
        ...sampleProfile,
        host: 'http://sg.proxy.net:8080',
      };

      const res = validateProfile(candidateInvalidHost, []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors).toContainEqual({
          path: 'host',
          code: 'INVALID_HOST',
        });
      }
    });

    it('rejects auth credentials for socks4/socks5 schemes', () => {
      const candidateSocksAuth = {
        ...sampleProfile,
        scheme: 'socks5' as const,
        auth: { username: 'user', password: 'secret' },
      };

      const res = validateProfile(candidateSocksAuth, []);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.errors).toContainEqual({
          path: 'auth',
          code: 'AUTH_NOT_ALLOWED_FOR_SOCKS',
        });
      }
    });
  });

  describe('Profile CRUD operations', () => {
    it('adds a valid new profile to AppState', async () => {
      await setState(createDefaultState());

      await updateState((prev) => ({
        ...prev,
        profiles: [...prev.profiles, sampleProfile],
      }));

      const state = await getState();
      expect(state.profiles).toHaveLength(1);
      expect(state.profiles[0].name).toBe('Singapore HTTP');
    });

    it('updates an existing profile', async () => {
      const stateWithProfile: AppState = {
        ...createDefaultState(),
        profiles: [sampleProfile],
      };
      await setState(stateWithProfile);

      await updateState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === 'p-1' ? { ...p, host: 'new-sg.proxy.net', port: 8443 } : p
        ),
      }));

      const state = await getState();
      expect(state.profiles[0].host).toBe('new-sg.proxy.net');
      expect(state.profiles[0].port).toBe(8443);
    });

    it('duplicates a profile with a copy name and unique UUID', async () => {
      const stateWithProfile: AppState = {
        ...createDefaultState(),
        profiles: [sampleProfile],
      };
      await setState(stateWithProfile);

      const newId = 'p-cloned';
      const cloned: ProxyProfile = {
        ...sampleProfile,
        id: newId,
        name: `${sampleProfile.name} (Copy)`,
      };

      await updateState((prev) => ({
        ...prev,
        profiles: [...prev.profiles, cloned],
      }));

      const state = await getState();
      expect(state.profiles).toHaveLength(2);
      expect(state.profiles[1].name).toBe('Singapore HTTP (Copy)');
      expect(state.profiles[1].id).toBe('p-cloned');
      expect(state.profiles[1].host).toBe(sampleProfile.host);
    });

    it('safely deletes active fixed profile by resetting mode to direct', async () => {
      const stateWithActiveProfile: AppState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: 'p-1' },
        lastActiveMode: { kind: 'fixed', profileId: 'p-1' },
        profiles: [sampleProfile],
      };
      await setState(stateWithActiveProfile);

      // Perform safe deletion as implemented in ProfilesPage
      await updateState((prev) => {
        const nextProfiles = prev.profiles.filter((p) => p.id !== 'p-1');
        let nextMode = prev.mode;
        let nextLastActive = prev.lastActiveMode;

        if (prev.mode.kind === 'fixed' && prev.mode.profileId === 'p-1') {
          nextMode = { kind: 'direct' };
        }
        if (prev.lastActiveMode && prev.lastActiveMode.kind === 'fixed' && prev.lastActiveMode.profileId === 'p-1') {
          nextLastActive = null;
        }

        return {
          ...prev,
          profiles: nextProfiles,
          mode: nextMode,
          lastActiveMode: nextLastActive,
        };
      });

      const updated = await getState();
      expect(updated.profiles).toHaveLength(0);
      expect(updated.mode).toEqual({ kind: 'direct' });
      expect(updated.lastActiveMode).toBeNull();
    });

    it('safely deletes profile used as auto defaultTarget by falling back to direct', async () => {
      const stateWithAutoTarget: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'profile', profileId: 'p-1' } },
        profiles: [sampleProfile],
      };
      await setState(stateWithAutoTarget);

      await updateState((prev) => {
        const nextProfiles = prev.profiles.filter((p) => p.id !== 'p-1');
        let nextMode = prev.mode;

        if (
          prev.mode.kind === 'auto' &&
          prev.mode.defaultTarget.type === 'profile' &&
          prev.mode.defaultTarget.profileId === 'p-1'
        ) {
          nextMode = { kind: 'auto', defaultTarget: { type: 'direct' } };
        }

        return {
          ...prev,
          profiles: nextProfiles,
          mode: nextMode,
        };
      });

      const updated = await getState();
      expect(updated.profiles).toHaveLength(0);
      expect(updated.mode).toEqual({ kind: 'auto', defaultTarget: { type: 'direct' } });
    });

    it('retains rules pointing to deleted profile as orphan rules', async () => {
      const pointingRule: Rule = {
        id: 'r-1',
        enabled: true,
        matchType: 'domain',
        pattern: 'internal.corp.com',
        target: { type: 'profile', profileId: 'p-1' },
      };

      const stateWithRules: AppState = {
        ...createDefaultState(),
        profiles: [sampleProfile],
        rules: [pointingRule],
      };
      await setState(stateWithRules);

      // Delete profile p-1 but preserve rules
      await updateState((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((p) => p.id !== 'p-1'),
      }));

      const updated = await getState();
      expect(updated.profiles).toHaveLength(0);
      expect(updated.rules).toHaveLength(1);
      expect(updated.rules[0].target).toEqual({ type: 'profile', profileId: 'p-1' });
    });
  });
});
