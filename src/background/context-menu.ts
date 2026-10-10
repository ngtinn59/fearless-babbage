import type { ProxyProfile, Rule, Target } from '../core/types';
import { getState, subscribe, updateState } from '../shared/storage';

export function extractHostname(urlStr?: string): string | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

let rebuildQueue = Promise.resolve();

/**
 * Rebuild context menus sequentially.
 */
export function rebuildContextMenu(profiles: ProxyProfile[]): Promise<void> {
  rebuildQueue = rebuildQueue.then(async () => {
    if (typeof chrome === 'undefined' || !chrome.contextMenus) return;
    try {
      await chrome.contextMenus.removeAll();

      chrome.contextMenus.create({
        id: 'smart-proxy-root',
        title: 'Smart Proxy: Thêm domain này',
        contexts: ['page'],
      });

      for (const profile of profiles) {
        chrome.contextMenus.create({
          id: `smart-proxy-profile:${profile.id}`,
          parentId: 'smart-proxy-root',
          title: `Đi qua ${profile.name}`,
          contexts: ['page'],
        });
      }

      chrome.contextMenus.create({
        id: 'smart-proxy-sep',
        type: 'separator',
        parentId: 'smart-proxy-root',
        contexts: ['page'],
      });

      chrome.contextMenus.create({
        id: 'smart-proxy-direct',
        parentId: 'smart-proxy-root',
        title: 'Luôn trực tiếp',
        contexts: ['page'],
      });
    } catch (err) {
      console.error('[Smart Proxy] Lỗi khi tạo context menu:', err);
    }
  });

  return rebuildQueue;
}

/**
 * Handle clicking on a context menu item.
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  const hostname = extractHostname(info.pageUrl || tab?.url);
  if (!hostname) return;

  let target: Target | null = null;
  if (info.menuItemId === 'smart-proxy-direct') {
    target = { type: 'direct' };
  } else if (
    typeof info.menuItemId === 'string' &&
    info.menuItemId.startsWith('smart-proxy-profile:')
  ) {
    const profileId = info.menuItemId.replace('smart-proxy-profile:', '');
    target = { type: 'profile', profileId };
  }

  if (!target) return;

  let isNotAuto = false;

  await updateState((prev) => {
    isNotAuto = prev.mode.kind !== 'auto';

    // Remove existing domain rule for this hostname to bring newest rule to the top
    const otherRules = prev.rules.filter(
      (r) => !(r.matchType === 'domain' && r.pattern.toLowerCase() === hostname.toLowerCase()),
    );

    const newRule: Rule = {
      id: crypto.randomUUID(),
      enabled: true,
      matchType: 'domain',
      pattern: hostname,
      target: target!,
      note: 'Thêm từ menu ngữ cảnh',
    };

    return {
      ...prev,
      rules: [newRule, ...otherRules],
    };
  });

  if (isNotAuto) {
    if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon48.png',
        title: 'Smart Proxy',
        message: `Đã thêm quy tắc cho ${hostname}. Hãy chuyển sang chế độ Tự động (Auto) để áp dụng quy tắc.`,
      });
    }
  }
}

/**
 * Register context menu creation and listeners.
 */
export function registerContextMenu(): void {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

  // 1. Initial build
  getState()
    .then((state) => rebuildContextMenu(state.profiles))
    .catch(() => {});

  // 2. Rebuild on storage change when profiles change
  let lastProfilesSignature = '';
  subscribe((state) => {
    const signature = JSON.stringify(
      state.profiles.map((p) => ({ id: p.id, name: p.name })),
    );
    if (signature !== lastProfilesSignature) {
      lastProfilesSignature = signature;
      rebuildContextMenu(state.profiles);
    }
  });

  // 3. Register click listener
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleContextMenuClick(info, tab).catch((err) => {
      console.error('[Smart Proxy] Lỗi khi xử lý click context menu:', err);
    });
  });
}
