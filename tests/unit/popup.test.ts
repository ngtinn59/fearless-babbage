import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile, Rule } from '../../src/core/types';
import { getState, setState, updateState } from '../../src/shared/storage';
import { installChromeMock, type ChromeMockController } from '../setup/chrome-mock';
import { resolveTarget } from '../../src/core/rule-matcher';

describe('Popup Logic & Actions (Task 11)', () => {
  let mockCtrl: ChromeMockController;

  const testProfile: ProxyProfile = {
    id: 'p-corp',
    name: 'Corporate Proxy',
    color: '#0088cc',
    scheme: 'http',
    host: 'proxy.corp.internal',
    port: 8080,
    bypassList: [],
  };

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('Big Toggle logic (Direct <-> LastActiveMode)', () => {
    it('switches from active mode to direct and saves lastActiveMode', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: testProfile.id },
        profiles: [testProfile],
      };
      await setState(state);

      // Simulate Big Toggle click: active -> direct
      await updateState((prev) => ({
        ...prev,
        lastActiveMode: prev.mode.kind !== 'direct' ? prev.mode : prev.lastActiveMode,
        mode: { kind: 'direct' },
      }));

      const updated = await getState();
      expect(updated.mode).toEqual({ kind: 'direct' });
      expect(updated.lastActiveMode).toEqual({ kind: 'fixed', profileId: testProfile.id });
    });

    it('restores lastActiveMode when toggling back on', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'direct' },
        lastActiveMode: { kind: 'fixed', profileId: testProfile.id },
        profiles: [testProfile],
      };
      await setState(state);

      // Simulate Big Toggle click: direct -> restore lastActiveMode
      await updateState((prev) => ({
        ...prev,
        mode: prev.lastActiveMode!,
      }));

      const updated = await getState();
      expect(updated.mode).toEqual({ kind: 'fixed', profileId: testProfile.id });
    });

    it('falls back to first profile when lastActiveMode is null and profiles exist', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'direct' },
        lastActiveMode: null,
        profiles: [testProfile],
      };
      await setState(state);

      await updateState((prev) => ({
        ...prev,
        mode: { kind: 'fixed', profileId: prev.profiles[0].id },
      }));

      const updated = await getState();
      expect(updated.mode).toEqual({ kind: 'fixed', profileId: testProfile.id });
    });
  });

  describe('Quick rule creation for current tab', () => {
    it('prepends quick Direct rule to the top of rules without duplicating', async () => {
      const existingRule: Rule = {
        id: 'r-old',
        enabled: true,
        matchType: 'domain',
        pattern: 'github.com',
        target: { type: 'profile', profileId: testProfile.id },
      };

      const otherRule: Rule = {
        id: 'r-other',
        enabled: true,
        matchType: 'domain',
        pattern: 'example.com',
        target: { type: 'direct' },
      };

      const state: AppState = {
        ...createDefaultState(),
        profiles: [testProfile],
        rules: [existingRule, otherRule],
      };
      await setState(state);

      // User clicks "Luôn trực tiếp" for github.com
      const targetDomain = 'github.com';
      await updateState((prev) => {
        const newRule: Rule = {
          id: 'r-new',
          enabled: true,
          matchType: 'domain',
          pattern: targetDomain,
          target: { type: 'direct' },
        };
        const filtered = prev.rules.filter(
          (r) => !(r.matchType === 'domain' && r.pattern.toLowerCase() === targetDomain.toLowerCase())
        );
        return { ...prev, rules: [newRule, ...filtered] };
      });

      const updated = await getState();
      expect(updated.rules).toHaveLength(2);
      expect(updated.rules[0].pattern).toBe('github.com');
      expect(updated.rules[0].target).toEqual({ type: 'direct' });
      expect(updated.rules[1].id).toBe('r-other');
    });

    it('prepends quick Profile rule to the top of rules', async () => {
      const state: AppState = {
        ...createDefaultState(),
        profiles: [testProfile],
        rules: [],
      };
      await setState(state);

      const targetDomain = 'internal.corp.com';
      await updateState((prev) => {
        const newRule: Rule = {
          id: 'r-proxy',
          enabled: true,
          matchType: 'domain',
          pattern: targetDomain,
          target: { type: 'profile', profileId: testProfile.id },
        };
        const filtered = prev.rules.filter(
          (r) => !(r.matchType === 'domain' && r.pattern.toLowerCase() === targetDomain.toLowerCase())
        );
        return { ...prev, rules: [newRule, ...filtered] };
      });

      const updated = await getState();
      expect(updated.rules).toHaveLength(1);
      expect(updated.rules[0].pattern).toBe('internal.corp.com');
      expect(updated.rules[0].target).toEqual({ type: 'profile', profileId: testProfile.id });
    });
  });

  describe('Current tab target resolution', () => {
    it('correctly resolves active target in Auto mode', () => {
      const rule: Rule = {
        id: 'r-1',
        enabled: true,
        matchType: 'domain',
        pattern: 'internal.corp.com',
        target: { type: 'profile', profileId: testProfile.id },
      };

      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
        profiles: [testProfile],
        rules: [rule],
      };

      const resMatched = resolveTarget(state, 'internal.corp.com');
      expect(resMatched.target).toEqual({ type: 'profile', profileId: testProfile.id });

      const resUnmatched = resolveTarget(state, 'google.com');
      expect(resUnmatched.target).toEqual({ type: 'direct' });
    });
  });
});
