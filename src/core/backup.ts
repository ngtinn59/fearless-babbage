import type { AppState, ProxyProfile } from './types';
import { validateState } from './schema';

export interface BackupData {
  format: 'smart-proxy-backup';
  version: 1;
  exportedAt: string;
  state: AppState;
}

export interface ExportOptions {
  includePasswords?: boolean;
}

export interface ImportSummary {
  profileCount: number;
  ruleCount: number;
}

export type ImportResult =
  | { success: true; state: AppState; summary: ImportSummary }
  | { success: false; error: string; details?: string[] };

/**
 * Export AppState to a structured JSON string.
 * By default, passwords are removed (replaced with empty string) for security.
 */
export function exportBackup(state: AppState, options: ExportOptions = {}): string {
  const clonedState: AppState = JSON.parse(JSON.stringify(state));

  if (!options.includePasswords) {
    for (const profile of clonedState.profiles) {
      if (profile.auth) {
        profile.auth = {
          ...profile.auth,
          password: '',
        };
      }
    }
  }

  const backupData: BackupData = {
    format: 'smart-proxy-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: clonedState,
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Validate and import a backup JSON string.
 * If an imported profile does not have a password, but matches an existing profile ID
 * that already has a password, the existing password will be preserved.
 */
export function importBackup(jsonString: string, currentState: AppState): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      success: false,
      error: 'FILE_CORRUPT_NOT_VALID_JSON',
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      success: false,
      error: 'INVALID_BACKUP_STRUCTURE',
    };
  }

  const backup = parsed as Record<string, unknown>;

  if (backup.format !== 'smart-proxy-backup') {
    return {
      success: false,
      error: 'INVALID_BACKUP_FORMAT',
    };
  }

  if (backup.version !== 1) {
    return {
      success: false,
      error: 'UNSUPPORTED_BACKUP_VERSION',
    };
  }

  if (typeof backup.state !== 'object' || backup.state === null) {
    return {
      success: false,
      error: 'MISSING_STATE_DATA',
    };
  }

  const incomingState = JSON.parse(JSON.stringify(backup.state)) as Record<string, unknown>;

  // Retain existing passwords for matching profile IDs if incoming has missing/empty password
  const existingProfilesMap = new Map<string, ProxyProfile>(
    currentState.profiles.map((p) => [p.id, p]),
  );

  if (Array.isArray(incomingState.profiles)) {
    for (const profileObj of incomingState.profiles) {
      if (typeof profileObj === 'object' && profileObj !== null) {
        const p = profileObj as Record<string, unknown>;
        const existing = typeof p.id === 'string' ? existingProfilesMap.get(p.id) : undefined;

        if (existing?.auth?.password) {
          if (typeof p.auth === 'object' && p.auth !== null) {
            const authRecord = p.auth as Record<string, unknown>;
            if (!authRecord.password || typeof authRecord.password !== 'string' || authRecord.password.trim() === '') {
              authRecord.password = existing.auth.password;
            }
          }
        }
      }
    }
  }

  const validationRes = validateState(incomingState);
  if (!validationRes.ok) {
    return {
      success: false,
      error: 'INVALID_APP_STATE',
      details: validationRes.errors.map((e) => `${e.path}: ${e.code}`),
    };
  }

  const validState = validationRes.value;

  return {
    success: true,
    state: validState,
    summary: {
      profileCount: validState.profiles.length,
      ruleCount: validState.rules.length,
    },
  };
}
