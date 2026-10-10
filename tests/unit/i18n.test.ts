import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMessage, t } from '../../src/shared/i18n';

describe('i18n helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to key when chrome.i18n is not defined', () => {
    (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
    expect(getMessage('extName')).toBe('extName');
    expect(t('missingKey')).toBe('missingKey');
  });

  it('calls chrome.i18n.getMessage when available', () => {
    const mockGetMessage = vi.fn().mockImplementation((key: string) => {
      if (key === 'extName') return 'Smart Proxy';
      return '';
    });

    (
      globalThis as unknown as {
        chrome?: { i18n?: { getMessage?: (k: string, s?: string | string[]) => string } };
      }
    ).chrome = {
      i18n: {
        getMessage: mockGetMessage,
      },
    };

    expect(t('extName')).toBe('Smart Proxy');
    expect(mockGetMessage).toHaveBeenCalledWith('extName', undefined);
    expect(t('unknownKey')).toBe('unknownKey');
  });
});
