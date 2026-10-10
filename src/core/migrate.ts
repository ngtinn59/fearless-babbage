import { createDefaultSettings, createDefaultState } from './defaults';
import { validateProfile, validateRule, validateSettings, validateState } from './schema';
import type { AppState, Mode, ProxyProfile, Rule, Settings } from './types';

/**
 * Migrate unknown or legacy data into a valid AppState.
 * Guaranteed never to throw; corrupted/empty data safely falls back to defaults.
 */
export function migrate(raw: unknown): AppState {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return createDefaultState();
    }

    // Fast path: if state is already fully valid schema v1, return it
    const quickValidation = validateState(raw);
    if (quickValidation.ok) {
      return quickValidation.value;
    }

    const data = raw as Record<string, unknown>;

    // 1. Sanitize Settings
    let settings: Settings;
    const settingsValidation = validateSettings(data.settings);
    if (settingsValidation.ok) {
      settings = settingsValidation.value;
    } else {
      const defaultSettings = createDefaultSettings();
      const rawSettings = (typeof data.settings === 'object' && data.settings !== null
        ? data.settings
        : {}) as Record<string, unknown>;

      settings = {
        theme:
          rawSettings.theme === 'light' || rawSettings.theme === 'dark'
            ? rawSettings.theme
            : defaultSettings.theme,
        bypassLocal:
          typeof rawSettings.bypassLocal === 'boolean'
            ? rawSettings.bypassLocal
            : defaultSettings.bypassLocal,
        notifyOnError:
          typeof rawSettings.notifyOnError === 'boolean'
            ? rawSettings.notifyOnError
            : defaultSettings.notifyOnError,
        healthCheckUrl:
          typeof rawSettings.healthCheckUrl === 'string' &&
          rawSettings.healthCheckUrl.startsWith('https://')
            ? rawSettings.healthCheckUrl
            : defaultSettings.healthCheckUrl,
        ipCheckUrl:
          typeof rawSettings.ipCheckUrl === 'string' &&
          (rawSettings.ipCheckUrl === '' || rawSettings.ipCheckUrl.startsWith('https://'))
            ? rawSettings.ipCheckUrl
            : defaultSettings.ipCheckUrl,
      };
    }

    // 2. Sanitize Profiles
    const validProfiles: ProxyProfile[] = [];
    if (Array.isArray(data.profiles)) {
      for (const item of data.profiles) {
        const res = validateProfile(item, validProfiles);
        if (res.ok) {
          validProfiles.push(res.value);
        }
      }
    }

    // 3. Sanitize Rules (must only reference existing profiles or direct)
    const validRules: Rule[] = [];
    if (Array.isArray(data.rules)) {
      for (const item of data.rules) {
        const res = validateRule(item, validProfiles);
        if (res.ok) {
          validRules.push(res.value);
        }
      }
    }

    // 4. Sanitize Mode
    let mode: Mode = { kind: 'direct' };
    if (typeof data.mode === 'object' && data.mode !== null) {
      const rawMode = data.mode as Record<string, unknown>;
      if (rawMode.kind === 'system') {
        mode = { kind: 'system' };
      } else if (rawMode.kind === 'fixed' && typeof rawMode.profileId === 'string') {
        if (validProfiles.some((p) => p.id === rawMode.profileId)) {
          mode = { kind: 'fixed', profileId: rawMode.profileId };
        }
      } else if (rawMode.kind === 'auto' && typeof rawMode.defaultTarget === 'object' && rawMode.defaultTarget !== null) {
        const dt = rawMode.defaultTarget as Record<string, unknown>;
        if (dt.type === 'profile' && typeof dt.profileId === 'string' && validProfiles.some((p) => p.id === dt.profileId)) {
          mode = { kind: 'auto', defaultTarget: { type: 'profile', profileId: dt.profileId } };
        } else {
          mode = { kind: 'auto', defaultTarget: { type: 'direct' } };
        }
      }
    }

    // 5. Sanitize lastActiveMode
    let lastActiveMode: Exclude<Mode, { kind: 'direct' }> | null = null;
    if (typeof data.lastActiveMode === 'object' && data.lastActiveMode !== null) {
      const lam = data.lastActiveMode as Record<string, unknown>;
      if (lam.kind === 'system') {
        lastActiveMode = { kind: 'system' };
      } else if (lam.kind === 'fixed' && typeof lam.profileId === 'string') {
        if (validProfiles.some((p) => p.id === lam.profileId)) {
          lastActiveMode = { kind: 'fixed', profileId: lam.profileId };
        }
      } else if (lam.kind === 'auto' && typeof lam.defaultTarget === 'object' && lam.defaultTarget !== null) {
        const dt = lam.defaultTarget as Record<string, unknown>;
        if (dt.type === 'profile' && typeof dt.profileId === 'string' && validProfiles.some((p) => p.id === dt.profileId)) {
          lastActiveMode = { kind: 'auto', defaultTarget: { type: 'profile', profileId: dt.profileId } };
        } else {
          lastActiveMode = { kind: 'auto', defaultTarget: { type: 'direct' } };
        }
      }
    }

    const candidateState: AppState = {
      schemaVersion: 1,
      mode,
      lastActiveMode,
      profiles: validProfiles,
      rules: validRules,
      settings,
    };

    // Final verification
    const finalValidation = validateState(candidateState);
    if (finalValidation.ok) {
      return finalValidation.value;
    }

    return createDefaultState();
  } catch {
    return createDefaultState();
  }
}
