import { describe, it, expect } from 'vitest';
import { toggleProxyMode } from '../../src/core/toggle';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile } from '../../src/core/types';

describe('Core: Toggle Proxy Mode (Task 15)', () => {
  const profileA: ProxyProfile = {
    id: 'prof-a',
    name: 'Proxy A',
    color: '#0055ff',
    scheme: 'http',
    host: 'proxy-a.com',
    port: 8080,
    bypassList: [],
  };

  const profileB: ProxyProfile = {
    id: 'prof-b',
    name: 'Proxy B',
    color: '#00aa55',
    scheme: 'socks5',
    host: 'proxy-b.com',
    port: 1080,
    bypassList: [],
  };

  it('switches from active fixed mode to direct and remembers lastActiveMode', () => {
    const activeState: AppState = {
      ...createDefaultState(),
      mode: { kind: 'fixed', profileId: 'prof-a' },
      profiles: [profileA],
    };

    const res = toggleProxyMode(activeState);

    expect(res.shouldOpenOptions).toBe(false);
    expect(res.nextState.mode).toEqual({ kind: 'direct' });
    expect(res.nextState.lastActiveMode).toEqual({ kind: 'fixed', profileId: 'prof-a' });
  });

  it('switches from active auto mode to direct and remembers lastActiveMode', () => {
    const activeState: AppState = {
      ...createDefaultState(),
      mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
      profiles: [profileA],
    };

    const res = toggleProxyMode(activeState);

    expect(res.shouldOpenOptions).toBe(false);
    expect(res.nextState.mode).toEqual({ kind: 'direct' });
    expect(res.nextState.lastActiveMode).toEqual({
      kind: 'auto',
      defaultTarget: { type: 'direct' },
    });
  });

  it('turns back ON by restoring lastActiveMode when previously set', () => {
    const offState: AppState = {
      ...createDefaultState(),
      mode: { kind: 'direct' },
      lastActiveMode: { kind: 'fixed', profileId: 'prof-b' },
      profiles: [profileA, profileB],
    };

    const res = toggleProxyMode(offState);

    expect(res.shouldOpenOptions).toBe(false);
    expect(res.nextState.mode).toEqual({ kind: 'fixed', profileId: 'prof-b' });
  });

  it('turns ON to the first available profile if lastActiveMode is null', () => {
    const initialOffState: AppState = {
      ...createDefaultState(),
      mode: { kind: 'direct' },
      lastActiveMode: null,
      profiles: [profileA, profileB],
    };

    const res = toggleProxyMode(initialOffState);

    expect(res.shouldOpenOptions).toBe(false);
    expect(res.nextState.mode).toEqual({ kind: 'fixed', profileId: 'prof-a' });
  });

  it('returns shouldOpenOptions true when turning ON with 0 profiles configured', () => {
    const emptyState: AppState = {
      ...createDefaultState(),
      mode: { kind: 'direct' },
      lastActiveMode: null,
      profiles: [],
    };

    const res = toggleProxyMode(emptyState);

    expect(res.shouldOpenOptions).toBe(true);
    expect(res.nextState.mode).toEqual({ kind: 'direct' });
  });
});
