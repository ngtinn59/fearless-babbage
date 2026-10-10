import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { generatePac, targetToPacString } from '../../src/core/pac-generator';
import {
  isIpInCidr,
  matchWildcard,
  resolveTarget,
} from '../../src/core/rule-matcher';
import type { AppState, ProxyProfile } from '../../src/core/types';

function isInNetPolyfill(ip: string, pattern: string, mask: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const toInt = (addr: string): number => {
    const octets = addr.split('.').map(Number);
    return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  };
  const ipInt = toInt(ip);
  const patInt = toInt(pattern);
  const maskInt = toInt(mask);
  return (ipInt & maskInt) === (patInt & maskInt);
}

function executePac(pacCode: string, url: string, host: string): string {
  const sandbox = {
    isPlainHostName: (h: string) => !h.includes('.'),
    shExpMatch: (h: string, p: string) => matchWildcard(h, p),
    dnsDomainIs: (h: string, d: string) => h.endsWith(d),
    isInNet: isInNetPolyfill,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(pacCode, context);
  const fn = (context as unknown as { FindProxyForURL: (url: string, host: string) => string })
    .FindProxyForURL;
  return fn(url, host);
}

describe('Rule Matcher and PAC Generator (Task 4)', () => {
  const pHttp: ProxyProfile = {
    id: 'p-http',
    name: 'Corporate HTTP',
    color: '#0066cc',
    scheme: 'http',
    host: 'proxy.company.internal',
    port: 8080,
    bypassList: [],
  };

  const pHttps: ProxyProfile = {
    id: 'p-https',
    name: 'Secure HTTPS',
    color: '#00aa55',
    scheme: 'https',
    host: 'secure.company.internal',
    port: 8443,
    bypassList: [],
  };

  const pSocks5: ProxyProfile = {
    id: 'p-socks5',
    name: 'Fast SOCKS5',
    color: '#ff6600',
    scheme: 'socks5',
    host: 'socks5.company.internal',
    port: 1080,
    bypassList: [],
  };

  const pSocks4: ProxyProfile = {
    id: 'p-socks4',
    name: 'Legacy SOCKS4',
    color: '#9933cc',
    scheme: 'socks4',
    host: 'socks4.company.internal',
    port: 1080,
    bypassList: [],
  };

  const testState: AppState = {
    schemaVersion: 1,
    mode: { kind: 'auto', defaultTarget: { type: 'profile', profileId: 'p-http' } },
    lastActiveMode: null,
    profiles: [pHttp, pHttps, pSocks5, pSocks4],
    settings: {
      theme: 'system',
      bypassLocal: true,
      notifyOnError: true,
      healthCheckUrl: 'https://www.gstatic.com/generate_204',
      ipCheckUrl: 'https://api.ipify.org?format=json',
    },
    rules: [
      {
        id: 'r-domain-1',
        enabled: true,
        matchType: 'domain',
        pattern: 'example.com',
        target: { type: 'profile', profileId: 'p-http' },
      },
      {
        id: 'r-domain-2',
        enabled: true,
        matchType: 'domain',
        pattern: 'direct.internal',
        target: { type: 'direct' },
      },
      {
        id: 'r-wildcard-1',
        enabled: true,
        matchType: 'wildcard',
        pattern: '*.google.*',
        target: { type: 'profile', profileId: 'p-https' },
      },
      {
        id: 'r-regex-1',
        enabled: true,
        matchType: 'regex',
        pattern: '^api-[a-z0-9]+\\.service\\.io$',
        target: { type: 'profile', profileId: 'p-socks5' },
      },
      {
        id: 'r-cidr-1',
        enabled: true,
        matchType: 'ip-cidr',
        pattern: '10.0.0.0/8',
        target: { type: 'profile', profileId: 'p-socks4' },
      },
      {
        id: 'r-cidr-2',
        enabled: true,
        matchType: 'ip-cidr',
        pattern: '192.168.1.0/24',
        target: { type: 'direct' },
      },
      {
        id: 'r-disabled',
        enabled: false,
        matchType: 'domain',
        pattern: 'disabled.com',
        target: { type: 'profile', profileId: 'p-https' },
      },
      {
        id: 'r-orphan',
        enabled: true,
        matchType: 'domain',
        pattern: 'orphan.com',
        target: { type: 'profile', profileId: 'deleted-profile-id' },
      },
      {
        id: 'r-wildcard-2',
        enabled: true,
        matchType: 'wildcard',
        pattern: '*.corp',
        target: { type: 'profile', profileId: 'p-socks5' },
      },
    ],
  };

  const profilesMap = new Map(testState.profiles.map((p) => [p.id, p]));

  describe('isIpInCidr utility', () => {
    it('correctly calculates /8, /16, /24, /32 matches', () => {
      expect(isIpInCidr('10.254.1.2', '10.0.0.0/8')).toBe(true);
      expect(isIpInCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
      expect(isIpInCidr('192.168.1.15', '192.168.1.0/24')).toBe(true);
      expect(isIpInCidr('192.168.2.15', '192.168.1.0/24')).toBe(false);
      expect(isIpInCidr('1.2.3.4', '1.2.3.4/32')).toBe(true);
      expect(isIpInCidr('1.2.3.5', '1.2.3.4/32')).toBe(false);
    });

    it('rejects invalid inputs gracefully', () => {
      expect(isIpInCidr('not-an-ip', '10.0.0.0/8')).toBe(false);
      expect(isIpInCidr('10.0.0.1', 'invalid-cidr')).toBe(false);
      expect(isIpInCidr('10.0.0.1', '10.0.0.0/99')).toBe(false);
    });
  });

  describe('matchWildcard utility', () => {
    it('matches patterns with * and ? case-insensitively', () => {
      expect(matchWildcard('www.google.com', '*.google.*')).toBe(true);
      expect(matchWildcard('WWW.GOOGLE.COM.VN', '*.google.*')).toBe(true);
      expect(matchWildcard('google.com', '*.google.*')).toBe(false);
      expect(matchWildcard('test-1', 'test-?')).toBe(true);
      expect(matchWildcard('test-12', 'test-?')).toBe(false);
    });
  });

  describe('Test tương đương: resolveTarget vs VM PAC execution (>= 45 hosts)', () => {
    const pacCode = generatePac(testState);

    const testHosts: string[] = [
      // 1-5: Local / plain hostnames
      'localhost',
      'my-computer',
      'router',
      'app.localhost',
      '127.0.0.1',
      // 6-10: 127.0.0.0/8 subnet and IPv6
      '127.1.2.3',
      '127.255.255.254',
      '::1',
      'intranet-hub',
      'fileserver',
      // 11-15: Domain rule (example.com)
      'example.com',
      'EXAMPLE.COM',
      'sub.example.com',
      'deep.nested.sub.example.com',
      'notexample.com',
      // 16-20: Domain rule (direct.internal)
      'myexample.com',
      'direct.internal',
      'DIRECT.INTERNAL',
      'api.direct.internal',
      'nodirect.internal',
      // 21-25: Wildcard rule (*.google.*)
      'www.google.com',
      'mail.google.co.uk',
      'drive.google.com.vn',
      'GOOGLE.COM',
      'a.google.b',
      // 26-30: Regex rule (^api-[a-z0-9]+\.service\.io$)
      'api-v1.service.io',
      'api-prod12.service.io',
      'API-DEV.SERVICE.IO',
      'api-.service.io',
      'api-v1.other.io',
      // 31-35: CIDR rule (10.0.0.0/8)
      '10.0.0.1',
      '10.123.45.67',
      '10.255.255.255',
      '11.0.0.1',
      '10.0.0.1.nip.io',
      // 36-40: CIDR rule (192.168.1.0/24)
      '192.168.1.1',
      '192.168.1.254',
      '192.168.2.1',
      '192.168.1.1.nip.io',
      '192.168.0.254',
      // 41-45: Disabled rule, Orphan rule & Unmatched fallbacks
      'disabled.com',
      'sub.disabled.com',
      'orphan.com',
      'sub.orphan.com',
      'github.com',
      // 46-50: More varied domains
      'cloudflare.com',
      'sub.corp',
      'DEV.CORP',
      'corp',
      'wikipedia.org',
    ];

    it(`verifies identical behavior across all ${testHosts.length} hosts`, () => {
      expect(testHosts.length).toBeGreaterThanOrEqual(40);

      for (const host of testHosts) {
        const resolved = resolveTarget(testState, host);
        const expectedPacString = targetToPacString(resolved.target, profilesMap);
        const actualPacString = executePac(pacCode, `https://${host}/path`, host);

        expect(
          actualPacString,
          `Mismatch for host "${host}"! resolveTarget reason: ${resolved.reason}`,
        ).toBe(expectedPacString);
      }
    });

    it('handles SOCKS5 profile formatting correctly in PAC', () => {
      expect(targetToPacString({ type: 'profile', profileId: 'p-socks5' }, profilesMap)).toBe(
        'SOCKS5 socks5.company.internal:1080; SOCKS socks5.company.internal:1080',
      );
    });

    it('handles SOCKS4 profile formatting correctly in PAC', () => {
      expect(targetToPacString({ type: 'profile', profileId: 'p-socks4' }, profilesMap)).toBe(
        'SOCKS socks4.company.internal:1080',
      );
    });

    it('handles HTTPS profile formatting correctly in PAC', () => {
      expect(targetToPacString({ type: 'profile', profileId: 'p-https' }, profilesMap)).toBe(
        'HTTPS secure.company.internal:8443',
      );
    });
  });

  describe('Injection Safety in PAC generation', () => {
    it('safely handles malicious patterns without breaking JavaScript syntax or behavior', () => {
      const maliciousState: AppState = {
        ...testState,
        rules: [
          {
            id: 'inj-1',
            enabled: true,
            matchType: 'domain',
            pattern: 'malicious.com"; return "DIRECT"; var x="',
            target: { type: 'profile', profileId: 'p-https' },
          },
          {
            id: 'inj-2',
            enabled: true,
            matchType: 'wildcard',
            pattern: '*.hacked.com"); return "SOCKS evil:123"; (',
            target: { type: 'profile', profileId: 'p-http' },
          },
          {
            id: 'inj-3',
            enabled: true,
            matchType: 'regex',
            pattern: 'evil\\.com"; alert(1); //',
            target: { type: 'profile', profileId: 'p-socks5' },
          },
        ],
      };

      const pacScript = generatePac(maliciousState);

      // Verify PAC script executes in VM without syntax error
      expect(() => {
        executePac(pacScript, 'https://legit.com/', 'legit.com');
      }).not.toThrow();

      // Ensure benign domains are not hijacked
      const legitResult = executePac(pacScript, 'https://legit.com/', 'legit.com');
      expect(legitResult).toBe('PROXY proxy.company.internal:8080');

      // Ensure malicious input behaves as plain string literal
      const exactMatch = executePac(
        pacScript,
        'https://malicious.com"; return "DIRECT"; var x="/',
        'malicious.com"; return "direct"; var x="',
      );
      expect(exactMatch).toBe('HTTPS secure.company.internal:8443');
    });
  });
});
