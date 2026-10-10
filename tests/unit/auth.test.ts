import { describe, expect, it } from 'vitest';
import {
  findMatchingProfileAuth,
  handleAuthRequired,
} from '../../src/background/auth';
import type { ProxyProfile } from '../../src/core/types';

describe('Background: Proxy Authentication & Loop Prevention (Task 7)', () => {
  const p1: ProxyProfile = {
    id: 'p-1',
    name: 'Corp HTTP with Auth',
    color: '#123456',
    scheme: 'http',
    host: 'proxy.company.internal',
    port: 8080,
    auth: {
      username: 'corp-user',
      password: 'corp-password-123',
    },
    bypassList: [],
  };

  const p2: ProxyProfile = {
    id: 'p-2',
    name: 'Corp HTTP No Auth',
    color: '#654321',
    scheme: 'http',
    host: 'public-proxy.company.internal',
    port: 3128,
    bypassList: [],
  };

  describe('findMatchingProfileAuth()', () => {
    it('returns credentials when host and port match', () => {
      const res = findMatchingProfileAuth([p1, p2], {
        host: 'proxy.company.internal',
        port: 8080,
      });

      expect(res).toEqual({
        username: 'corp-user',
        password: 'corp-password-123',
      });
    });

    it('matches host case-insensitively', () => {
      const res = findMatchingProfileAuth([p1], {
        host: 'PROXY.COMPANY.INTERNAL',
        port: 8080,
      });

      expect(res).toEqual({
        username: 'corp-user',
        password: 'corp-password-123',
      });
    });

    it('returns null when port differs', () => {
      const res = findMatchingProfileAuth([p1], {
        host: 'proxy.company.internal',
        port: 8081,
      });

      expect(res).toBeNull();
    });

    it('returns null when host differs', () => {
      const res = findMatchingProfileAuth([p1], {
        host: 'other.company.internal',
        port: 8080,
      });

      expect(res).toBeNull();
    });

    it('returns null when profile does not have auth credentials', () => {
      const res = findMatchingProfileAuth([p2], {
        host: 'public-proxy.company.internal',
        port: 3128,
      });

      expect(res).toBeNull();
    });
  });

  describe('handleAuthRequired() & Loop Prevention', () => {
    it('returns empty object when isProxy is false (origin server auth)', () => {
      const map = new Map<string, number>();
      const res = handleAuthRequired(
        {
          requestId: 'req-1',
          isProxy: false,
          challenger: { host: 'proxy.company.internal', port: 8080 },
        },
        [p1],
        map,
      );

      expect(res).toEqual({});
      expect(map.size).toBe(0);
    });

    it('returns authCredentials on the first challenge attempt for matching proxy', () => {
      const map = new Map<string, number>();
      const res = handleAuthRequired(
        {
          requestId: 'req-1',
          isProxy: true,
          challenger: { host: 'proxy.company.internal', port: 8080 },
        },
        [p1],
        map,
      );

      expect(res).toEqual({
        authCredentials: {
          username: 'corp-user',
          password: 'corp-password-123',
        },
      });
      expect(map.get('req-1')).toBe(1);
    });

    it('cancels request on 2nd attempt to prevent infinite retry loops', () => {
      const map = new Map<string, number>();
      const details = {
        requestId: 'req-loop',
        isProxy: true,
        challenger: { host: 'proxy.company.internal', port: 8080 },
      };

      // 1st attempt: provides credentials
      const res1 = handleAuthRequired(details, [p1], map);
      expect(res1.authCredentials).toBeDefined();
      expect(map.get('req-loop')).toBe(1);

      // 2nd attempt: server challenged again with 407 (wrong credentials) -> CANCEL!
      const res2 = handleAuthRequired(details, [p1], map);
      expect(res2).toEqual({ cancel: true });
      expect(map.get('req-loop')).toBe(2);

      // 3rd attempt: continues to cancel
      const res3 = handleAuthRequired(details, [p1], map);
      expect(res3).toEqual({ cancel: true });
    });

    it('returns empty object on first attempt if no profile matches', () => {
      const map = new Map<string, number>();
      const res = handleAuthRequired(
        {
          requestId: 'req-unknown',
          isProxy: true,
          challenger: { host: 'unknown.proxy.com', port: 9999 },
        },
        [p1],
        map,
      );

      expect(res).toEqual({});
      expect(map.get('req-unknown')).toBe(1);
    });

    it('tracks different requestIds independently', () => {
      const map = new Map<string, number>();
      const d1 = {
        requestId: 'req-A',
        isProxy: true,
        challenger: { host: 'proxy.company.internal', port: 8080 },
      };
      const d2 = {
        requestId: 'req-B',
        isProxy: true,
        challenger: { host: 'proxy.company.internal', port: 8080 },
      };

      handleAuthRequired(d1, [p1], map);
      handleAuthRequired(d1, [p1], map); // req-A failed twice
      expect(map.get('req-A')).toBe(2);

      const resB = handleAuthRequired(d2, [p1], map); // req-B is on 1st attempt
      expect(resB.authCredentials).toBeDefined();
      expect(map.get('req-B')).toBe(1);
    });
  });
});
