import { describe, it, expect } from 'vitest';
import { exportBackup, importBackup } from '../../src/core/backup';
import type { AppState, ProxyProfile } from '../../src/core/types';
import { createDefaultState } from '../../src/core/defaults';

describe('Core: Backup & Restore (Task 14)', () => {
  const profileWithAuth: ProxyProfile = {
    id: 'prof-auth-1',
    name: 'Authenticated Profile',
    color: '#0066cc',
    scheme: 'http',
    host: 'proxy.corp.com',
    port: 8080,
    auth: { username: 'alice', password: 'secretpassword123' },
    bypassList: ['localhost', '127.0.0.1'],
  };

  const sampleState: AppState = {
    ...createDefaultState(),
    mode: { kind: 'fixed', profileId: 'prof-auth-1' },
    profiles: [profileWithAuth],
    rules: [
      {
        id: 'rule-1',
        enabled: true,
        matchType: 'domain',
        pattern: 'internal.corp.com',
        target: { type: 'profile', profileId: 'prof-auth-1' },
        note: 'Company internal sites',
      },
    ],
  };

  describe('exportBackup()', () => {
    it('strips passwords by default when exporting', () => {
      const exportedJson = exportBackup(sampleState);
      const parsed = JSON.parse(exportedJson);

      expect(parsed.format).toBe('smart-proxy-backup');
      expect(parsed.version).toBe(1);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.state.profiles[0].auth.username).toBe('alice');
      expect(parsed.state.profiles[0].auth.password).toBe('');
    });

    it('includes passwords when includePasswords is set to true', () => {
      const exportedJson = exportBackup(sampleState, { includePasswords: true });
      const parsed = JSON.parse(exportedJson);

      expect(parsed.state.profiles[0].auth.password).toBe('secretpassword123');
    });
  });

  describe('importBackup()', () => {
    it('successfully restores state from a complete round-trip backup', () => {
      const exportedJson = exportBackup(sampleState, { includePasswords: true });
      const res = importBackup(exportedJson, createDefaultState());

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.summary.profileCount).toBe(1);
        expect(res.summary.ruleCount).toBe(1);
        expect(res.state.profiles[0].auth?.password).toBe('secretpassword123');
        expect(res.state.rules[0].pattern).toBe('internal.corp.com');
      }
    });

    it('retains existing passwords when imported profile has empty/stripped password', () => {
      // Export without password
      const strippedJson = exportBackup(sampleState, { includePasswords: false });

      // Import into current state which has the original profile with password
      const res = importBackup(strippedJson, sampleState);

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.state.profiles[0].auth?.username).toBe('alice');
        expect(res.state.profiles[0].auth?.password).toBe('secretpassword123');
      }
    });

    it('fails when JSON string is corrupt', () => {
      const res = importBackup('{ invalid json', sampleState);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('FILE_CORRUPT_NOT_VALID_JSON');
      }
    });

    it('fails when format is not smart-proxy-backup', () => {
      const invalidFormat = JSON.stringify({
        format: 'wrong-format',
        version: 1,
        state: sampleState,
      });

      const res = importBackup(invalidFormat, sampleState);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('INVALID_BACKUP_FORMAT');
      }
    });

    it('fails when version is not supported', () => {
      const invalidVersion = JSON.stringify({
        format: 'smart-proxy-backup',
        version: 99,
        state: sampleState,
      });

      const res = importBackup(invalidVersion, sampleState);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('UNSUPPORTED_BACKUP_VERSION');
      }
    });

    it('fails when state schema is invalid', () => {
      const invalidSchema = JSON.stringify({
        format: 'smart-proxy-backup',
        version: 1,
        state: {
          ...sampleState,
          schemaVersion: 999, // Invalid version
        },
      });

      const res = importBackup(invalidSchema, sampleState);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('INVALID_APP_STATE');
        expect(res.details).toBeDefined();
      }
    });
  });
});
