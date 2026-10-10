import { describe, expect, it } from 'vitest';
import { buildProxyConfig } from '../../src/core/config-builder';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile } from '../../src/core/types';

describe('Config Builder (Task 5)', () => {
  const p1: ProxyProfile = {
    id: 'p-1',
    name: 'HTTP Proxy',
    color: '#112233',
    scheme: 'http',
    host: 'proxy.corp',
    port: 8080,
    bypassList: ['corp.internal', '*.company.com'],
  };

  const pSocks: ProxyProfile = {
    id: 'p-socks',
    name: 'SOCKS5 Proxy',
    color: '#445566',
    scheme: 'socks5',
    host: 'socks.corp',
    port: 1080,
    bypassList: [],
  };

  it('builds direct mode config correctly', () => {
    const state: AppState = {
      ...createDefaultState(),
      mode: { kind: 'direct' },
    };

    const res = buildProxyConfig(state);
    expect(res.config).toEqual({ mode: 'direct' });
    expect(res.warnings).toEqual([]);
  });

  it('builds system mode config correctly', () => {
    const state: AppState = {
      ...createDefaultState(),
      mode: { kind: 'system' },
    };

    const res = buildProxyConfig(state);
    expect(res.config).toEqual({ mode: 'system' });
    expect(res.warnings).toEqual([]);
  });

  it('builds fixed mode with valid profile and injects <local> when bypassLocal is true', () => {
    const state: AppState = {
      ...createDefaultState(),
      profiles: [p1],
      mode: { kind: 'fixed', profileId: 'p-1' },
      settings: {
        ...createDefaultState().settings,
        bypassLocal: true,
      },
    };

    const res = buildProxyConfig(state);
    expect(res.warnings).toEqual([]);
    expect(res.config.mode).toBe('fixed_servers');
    expect(res.config.rules?.singleProxy).toEqual({
      scheme: 'http',
      host: 'proxy.corp',
      port: 8080,
    });
    expect(res.config.rules?.bypassList).toEqual(['<local>', 'corp.internal', '*.company.com']);
  });

  it('builds fixed mode without injecting <local> when bypassLocal is false', () => {
    const state: AppState = {
      ...createDefaultState(),
      profiles: [p1],
      mode: { kind: 'fixed', profileId: 'p-1' },
      settings: {
        ...createDefaultState().settings,
        bypassLocal: false,
      },
    };

    const res = buildProxyConfig(state);
    expect(res.config.rules?.bypassList).toEqual(['corp.internal', '*.company.com']);
  });

  it('does not duplicate <local> in bypassList if profile already includes it', () => {
    const profileWithLocal: ProxyProfile = {
      ...p1,
      bypassList: ['<local>', 'api.internal'],
    };

    const state: AppState = {
      ...createDefaultState(),
      profiles: [profileWithLocal],
      mode: { kind: 'fixed', profileId: 'p-1' },
      settings: {
        ...createDefaultState().settings,
        bypassLocal: true,
      },
    };

    const res = buildProxyConfig(state);
    expect(res.config.rules?.bypassList).toEqual(['<local>', 'api.internal']);
  });

  it('builds fixed mode with SOCKS5 scheme', () => {
    const state: AppState = {
      ...createDefaultState(),
      profiles: [pSocks],
      mode: { kind: 'fixed', profileId: 'p-socks' },
    };

    const res = buildProxyConfig(state);
    expect(res.config.rules?.singleProxy).toEqual({
      scheme: 'socks5',
      host: 'socks.corp',
      port: 1080,
    });
  });

  it('falls back to direct mode with warning when fixed profileId does not exist', () => {
    const state: AppState = {
      ...createDefaultState(),
      profiles: [p1],
      mode: { kind: 'fixed', profileId: 'non-existent-profile' },
    };

    const res = buildProxyConfig(state);
    expect(res.config).toEqual({ mode: 'direct' });
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toContain('non-existent-profile');
  });

  it('builds auto mode config containing generated PAC script', () => {
    const state: AppState = {
      ...createDefaultState(),
      profiles: [p1],
      mode: { kind: 'auto', defaultTarget: { type: 'profile', profileId: 'p-1' } },
      rules: [
        {
          id: 'r-1',
          enabled: true,
          matchType: 'domain',
          pattern: 'test.com',
          target: { type: 'direct' },
        },
      ],
    };

    const res = buildProxyConfig(state);
    expect(res.warnings).toEqual([]);
    expect(res.config.mode).toBe('pac_script');
    expect(res.config.pacScript?.data).toContain('function FindProxyForURL(url, host)');
    expect(res.config.pacScript?.data).toContain('test.com');
  });
});
