import type { AppState } from './types';

export interface ToggleResult {
  nextState: AppState;
  shouldOpenOptions: boolean;
}

/**
 * Toggle proxy state between Direct and active mode.
 * - If currently active (not direct): turns OFF (switches to direct) and saves lastActiveMode.
 * - If currently direct:
 *   - Restores lastActiveMode if available.
 *   - Or switches to fixed mode with the first profile if profiles exist.
 *   - Or returns shouldOpenOptions: true if no profiles exist.
 */
export function toggleProxyMode(state: AppState): ToggleResult {
  const isProxyActive = state.mode.kind !== 'direct';

  if (isProxyActive) {
    return {
      nextState: {
        ...state,
        lastActiveMode: state.mode.kind !== 'direct' ? state.mode : state.lastActiveMode,
        mode: { kind: 'direct' },
      },
      shouldOpenOptions: false,
    };
  }

  // Currently direct -> turn ON
  if (state.lastActiveMode) {
    return {
      nextState: {
        ...state,
        mode: state.lastActiveMode,
      },
      shouldOpenOptions: false,
    };
  }

  if (state.profiles.length > 0) {
    return {
      nextState: {
        ...state,
        mode: { kind: 'fixed', profileId: state.profiles[0].id },
      },
      shouldOpenOptions: false,
    };
  }

  return {
    nextState: state,
    shouldOpenOptions: true,
  };
}
