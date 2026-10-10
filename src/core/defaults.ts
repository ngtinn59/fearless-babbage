import type { AppState, Settings } from './types';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'system',
  bypassLocal: true,
  notifyOnError: true,
  healthCheckUrl: 'https://www.gstatic.com/generate_204',
  ipCheckUrl: 'https://api.ipify.org?format=json',
};

export const DEFAULT_STATE: Readonly<AppState> = {
  schemaVersion: 1,
  mode: { kind: 'direct' },
  lastActiveMode: null,
  profiles: [],
  rules: [],
  settings: { ...DEFAULT_SETTINGS },
};

export function createDefaultSettings(): Settings {
  return {
    theme: 'system',
    bypassLocal: true,
    notifyOnError: true,
    healthCheckUrl: 'https://www.gstatic.com/generate_204',
    ipCheckUrl: 'https://api.ipify.org?format=json',
  };
}

export function createDefaultState(): AppState {
  return {
    schemaVersion: 1,
    mode: { kind: 'direct' },
    lastActiveMode: null,
    profiles: [],
    rules: [],
    settings: createDefaultSettings(),
  };
}
