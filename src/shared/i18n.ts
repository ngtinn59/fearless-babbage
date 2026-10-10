/**
 * Wrapper for chrome.i18n.getMessage with safe fallback for tests/SSR.
 */
export function getMessage(key: string, substitutions?: string | string[]): string {
  if (typeof chrome !== 'undefined' && chrome?.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions);
    if (message) {
      return message;
    }
  }
  return key;
}

export const t = getMessage;
