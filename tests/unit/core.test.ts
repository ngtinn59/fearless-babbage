import { describe, expect, it } from 'vitest';
import { createDefaultState, DEFAULT_SETTINGS } from '../../src/core/defaults';
import { migrate } from '../../src/core/migrate';
import {
  isValidHost,
  isValidIpv4Cidr,
  isValidIpv4Literal,
  validateProfile,
  validateRule,
  validateSettings,
  validateState,
} from '../../src/core/schema';
import type { AppState, ProxyProfile, Rule } from '../../src/core/types';

describe('src/core/schema - Helper functions', () => {
  it('1. identifies valid and invalid IPv4 literals', () => {
    expect(isValidIpv4Literal('127.0.0.1')).toBe(true);
    expect(isValidIpv4Literal('0.0.0.0')).toBe(true);
    expect(isValidIpv4Literal('255.255.255.255')).toBe(true);

    expect(isValidIpv4Literal('256.0.0.1')).toBe(false);
    expect(isValidIpv4Literal('1.2.3')).toBe(false);
    expect(isValidIpv4Literal('1.2.3.4.5')).toBe(false);
    expect(isValidIpv4Literal('localhost')).toBe(false);
  });

  it('2. validates IPv4 CIDR formats accurately', () => {
    expect(isValidIpv4Cidr('10.0.0.0/8')).toBe(true);
    expect(isValidIpv4Cidr('192.168.1.0/24')).toBe(true);
    expect(isValidIpv4Cidr('0.0.0.0/0')).toBe(true);
    expect(isValidIpv4Cidr('1.1.1.1/32')).toBe(true);

    expect(isValidIpv4Cidr('10.0.0.0/33')).toBe(false);
    expect(isValidIpv4Cidr('10.0.0.0/-1')).toBe(false);
    expect(isValidIpv4Cidr('999.0.0.0/8')).toBe(false);
    expect(isValidIpv4Cidr('10.0.0.0')).toBe(false);
    expect(isValidIpv4Cidr('invalid/24')).toBe(false);
  });

  it('3. validates hostnames and rejects schemes, ports, and paths', () => {
    expect(isValidHost('example.com')).toBe(true);
    expect(isValidHost('sub.domain.co.uk')).toBe(true);
    expect(isValidHost('127.0.0.1')).toBe(true);
    expect(isValidHost('localhost')).toBe(true);

    expect(isValidHost('http://example.com')).toBe(false);
    expect(isValidHost('https://example.com')).toBe(false);
    expect(isValidHost('example.com:8080')).toBe(false);
    expect(isValidHost('example.com/path')).toBe(false);
    expect(isValidHost('example .com')).toBe(false);
    expect(isValidHost('')).toBe(false);
  });
});

describe('src/core/schema - validateProfile', () => {
  const baseProfile: ProxyProfile = {
    id: 'p-1',
    name: 'Proxy 1',
    color: '#4F46E5',
    scheme: 'http',
    host: 'proxy.example.com',
    port: 8080,
    bypassList: ['localhost', '127.0.0.1'],
  };

  it('4. accepts a valid HTTP profile without auth', () => {
    const res = validateProfile(baseProfile);
    expect(res.ok).toBe(true);
  });

  it('5. accepts a valid HTTP profile with auth credentials', () => {
    const res = validateProfile({
      ...baseProfile,
      auth: { username: 'user1', password: 'pass1' },
    });
    expect(res.ok).toBe(true);
  });

  it('6. rejects socks4 and socks5 profiles with auth', () => {
    const socks4Res = validateProfile({
      ...baseProfile,
      scheme: 'socks4',
      auth: { username: 'u', password: 'p' },
    });
    expect(socks4Res.ok).toBe(false);
    if (!socks4Res.ok) {
      expect(socks4Res.errors).toContainEqual({
        path: 'auth',
        code: 'AUTH_NOT_ALLOWED_FOR_SOCKS',
      });
    }

    const socks5Res = validateProfile({
      ...baseProfile,
      scheme: 'socks5',
      auth: { username: 'u', password: 'p' },
    });
    expect(socks5Res.ok).toBe(false);
    if (!socks5Res.ok) {
      expect(socks5Res.errors).toContainEqual({
        path: 'auth',
        code: 'AUTH_NOT_ALLOWED_FOR_SOCKS',
      });
    }
  });

  it('7. rejects invalid ports (< 1, > 65535, non-integers)', () => {
    expect(validateProfile({ ...baseProfile, port: 0 }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, port: 65536 }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, port: -80 }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, port: 8080.5 }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, port: 80 }).ok).toBe(true);
    expect(validateProfile({ ...baseProfile, port: 65535 }).ok).toBe(true);
  });

  it('8. rejects invalid hex colors', () => {
    expect(validateProfile({ ...baseProfile, color: '#fff' }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, color: 'blue' }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, color: '#GGGGGG' }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, color: '#123456' }).ok).toBe(true);
  });

  it('9. prevents duplicate profile names in the same state', () => {
    const existing = [baseProfile];
    const newProfile: ProxyProfile = {
      ...baseProfile,
      id: 'p-2',
      name: 'Proxy 1', // duplicate name
    };
    const res = validateProfile(newProfile, existing);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'name',
        code: 'DUPLICATE_NAME',
      });
    }
  });

  it('10. allows updating the same profile with its existing name', () => {
    const existing = [baseProfile];
    const res = validateProfile(baseProfile, existing);
    expect(res.ok).toBe(true);
  });

  it('11. enforces profile name length (1-40 characters)', () => {
    expect(validateProfile({ ...baseProfile, name: '' }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, name: '   ' }).ok).toBe(false);
    expect(validateProfile({ ...baseProfile, name: 'a'.repeat(40) }).ok).toBe(true);
    expect(validateProfile({ ...baseProfile, name: 'a'.repeat(41) }).ok).toBe(false);
  });
});

describe('src/core/schema - validateRule', () => {
  const profile: ProxyProfile = {
    id: 'p-1',
    name: 'Proxy 1',
    color: '#06B6D4',
    scheme: 'https',
    host: 'proxy.org',
    port: 443,
    bypassList: [],
  };

  const baseRule: Rule = {
    id: 'r-1',
    enabled: true,
    matchType: 'domain',
    pattern: 'example.com',
    target: { type: 'direct' },
  };

  it('12. validates domain rules with direct target', () => {
    expect(validateRule(baseRule).ok).toBe(true);
  });

  it('13. validates rules targeting an existing profile', () => {
    const res = validateRule(
      {
        ...baseRule,
        target: { type: 'profile', profileId: 'p-1' },
      },
      [profile],
    );
    expect(res.ok).toBe(true);
  });

  it('14. rejects rules targeting non-existent profiles', () => {
    const res = validateRule(
      {
        ...baseRule,
        target: { type: 'profile', profileId: 'ghost-id' },
      },
      [profile],
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'target.profileId',
        code: 'PROFILE_NOT_FOUND',
      });
    }
  });

  it('15. verifies regex compilation in regex rules', () => {
    const validRegexRule = {
      ...baseRule,
      matchType: 'regex' as const,
      pattern: '^https?:\\/\\/api\\.example\\.com',
    };
    expect(validateRule(validRegexRule).ok).toBe(true);

    const invalidRegexRule = {
      ...baseRule,
      matchType: 'regex' as const,
      pattern: '[a-z', // unclosed bracket
    };
    const res = validateRule(invalidRegexRule);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'pattern',
        code: 'INVALID_REGEX',
      });
    }
  });

  it('16. validates ip-cidr rules with proper CIDR check', () => {
    const validCidr = {
      ...baseRule,
      matchType: 'ip-cidr' as const,
      pattern: '10.0.0.0/8',
    };
    expect(validateRule(validCidr).ok).toBe(true);

    const invalidCidr = {
      ...baseRule,
      matchType: 'ip-cidr' as const,
      pattern: '10.0.0.0/40',
    };
    const res = validateRule(invalidCidr);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'pattern',
        code: 'INVALID_IPV4_CIDR',
      });
    }
  });

  it('17. accepts valid wildcard patterns', () => {
    const wildcardRule = {
      ...baseRule,
      matchType: 'wildcard' as const,
      pattern: '*.internal.*',
    };
    expect(validateRule(wildcardRule).ok).toBe(true);
  });
});

describe('src/core/schema - validateSettings', () => {
  it('18. accepts valid default settings', () => {
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it('19. rejects invalid themes and non-https URLs', () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, theme: 'custom' }).ok).toBe(false);
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, healthCheckUrl: 'http://insecure.com' }).ok,
    ).toBe(false);
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, ipCheckUrl: 'ftp://example.com' }).ok,
    ).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, ipCheckUrl: '' }).ok).toBe(true);
  });
});

describe('src/core/schema - validateState', () => {
  const profile: ProxyProfile = {
    id: 'p-1',
    name: 'Proxy 1',
    color: '#10B981',
    scheme: 'http',
    host: 'proxy.local',
    port: 8080,
    bypassList: [],
  };

  it('20. accepts valid state with direct mode', () => {
    const state = createDefaultState();
    expect(validateState(state).ok).toBe(true);
  });

  it('21. validates fixed mode pointing to an existing profile', () => {
    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'fixed', profileId: 'p-1' },
      lastActiveMode: { kind: 'fixed', profileId: 'p-1' },
      profiles: [profile],
      rules: [],
      settings: { ...DEFAULT_SETTINGS },
    };
    expect(validateState(state).ok).toBe(true);
  });

  it('22. rejects fixed mode pointing to a missing profile', () => {
    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'fixed', profileId: 'missing-p' },
      lastActiveMode: null,
      profiles: [profile],
      rules: [],
      settings: { ...DEFAULT_SETTINGS },
    };
    const res = validateState(state);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'mode.profileId',
        code: 'PROFILE_NOT_FOUND',
      });
    }
  });

  it('23. rejects lastActiveMode being direct mode', () => {
    const state = {
      ...createDefaultState(),
      lastActiveMode: { kind: 'direct' } as unknown as Exclude<AppState['lastActiveMode'], null>,
    };
    const res = validateState(state);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'lastActiveMode',
        code: 'LAST_ACTIVE_MODE_CANNOT_BE_DIRECT',
      });
    }
  });

  it('24. validates auto mode with valid defaultTarget', () => {
    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'auto', defaultTarget: { type: 'profile', profileId: 'p-1' } },
      lastActiveMode: { kind: 'auto', defaultTarget: { type: 'direct' } },
      profiles: [profile],
      rules: [
        {
          id: 'r-1',
          enabled: true,
          matchType: 'domain',
          pattern: 'github.com',
          target: { type: 'profile', profileId: 'p-1' },
        },
      ],
      settings: { ...DEFAULT_SETTINGS },
    };
    expect(validateState(state).ok).toBe(true);
  });

  it('25. rejects schemaVersion other than 1', () => {
    const state = {
      ...createDefaultState(),
      schemaVersion: 2,
    };
    const res = validateState(state);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContainEqual({
        path: 'schemaVersion',
        code: 'INVALID_SCHEMA_VERSION',
      });
    }
  });
});

describe('src/core/migrate', () => {
  it('26. returns default state for null, undefined, primitives, arrays', () => {
    expect(migrate(null)).toEqual(createDefaultState());
    expect(migrate(undefined)).toEqual(createDefaultState());
    expect(migrate('corrupted string')).toEqual(createDefaultState());
    expect(migrate(12345)).toEqual(createDefaultState());
    expect(migrate([])).toEqual(createDefaultState());
  });

  it('27. handles empty object without throwing and provides default settings', () => {
    const res = migrate({});
    expect(res.schemaVersion).toBe(1);
    expect(res.mode).toEqual({ kind: 'direct' });
    expect(res.profiles).toEqual([]);
    expect(res.rules).toEqual([]);
    expect(res.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('28. preserves valid profiles and filters out corrupted ones', () => {
    const raw = {
      profiles: [
        {
          id: 'p-valid',
          name: 'Good Proxy',
          color: '#10B981',
          scheme: 'http',
          host: 'valid.host.com',
          port: 8080,
          bypassList: [],
        },
        {
          id: 'p-bad',
          name: 'Bad Proxy',
          color: 'not-hex',
          scheme: 'socks5',
          host: 'bad.host:8080', // invalid host with port
          port: -1,
        },
      ],
    };

    const migrated = migrate(raw);
    expect(migrated.profiles.length).toBe(1);
    expect(migrated.profiles[0].id).toBe('p-valid');
  });

  it('29. resets fixed mode to direct if targeted profile is invalid/missing', () => {
    const raw = {
      mode: { kind: 'fixed', profileId: 'nonexistent-profile' },
      profiles: [],
    };
    const migrated = migrate(raw);
    expect(migrated.mode).toEqual({ kind: 'direct' });
  });

  it('30. keeps fixed mode if targeted profile is valid', () => {
    const validProfile: ProxyProfile = {
      id: 'p-1',
      name: 'Proxy 1',
      color: '#4F46E5',
      scheme: 'http',
      host: 'proxy.com',
      port: 8080,
      bypassList: [],
    };
    const raw = {
      mode: { kind: 'fixed', profileId: 'p-1' },
      profiles: [validProfile],
    };
    const migrated = migrate(raw);
    expect(migrated.mode).toEqual({ kind: 'fixed', profileId: 'p-1' });
  });
});
