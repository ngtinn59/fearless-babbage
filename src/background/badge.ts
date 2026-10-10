import type { AppState } from '../core/types';

/**
 * Cập nhật badge trên icon extension theo AppState và trạng thái lỗi:
 * - có lỗi: '!' nền đỏ
 * - direct: không text (xóa badge)
 * - system: 'SYS' nền xám trung tính
 * - fixed: 3 ký tự đầu của tên profile, nền màu của profile
 * - auto: 'AUTO' nền xanh lá
 */
export async function updateBadge(state: AppState, hasError = false): Promise<void> {
  if (hasError) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    try {
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ color: '#ffffff' });
      }
    } catch {
      // setBadgeTextColor might not be available on older Chrome
    }
    return;
  }

  const { mode, profiles } = state;

  switch (mode.kind) {
    case 'direct':
      await chrome.action.setBadgeText({ text: '' });
      break;

    case 'system':
      await chrome.action.setBadgeText({ text: 'SYS' });
      await chrome.action.setBadgeBackgroundColor({ color: '#475569' });
      try {
        if (chrome.action.setBadgeTextColor) {
          await chrome.action.setBadgeTextColor({ color: '#ffffff' });
        }
      } catch {
        // ignore
      }
      break;

    case 'fixed': {
      const profile = profiles.find((p) => p.id === mode.profileId);
      if (!profile) {
        await chrome.action.setBadgeText({ text: '' });
      } else {
        const text = profile.name.trim().slice(0, 3).toUpperCase() || 'PRX';
        const color = profile.color || '#2563eb';
        await chrome.action.setBadgeText({ text });
        await chrome.action.setBadgeBackgroundColor({ color });
        try {
          if (chrome.action.setBadgeTextColor) {
            await chrome.action.setBadgeTextColor({ color: '#ffffff' });
          }
        } catch {
          // ignore
        }
      }
      break;
    }

    case 'auto':
      await chrome.action.setBadgeText({ text: 'AUTO' });
      await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
      try {
        if (chrome.action.setBadgeTextColor) {
          await chrome.action.setBadgeTextColor({ color: '#ffffff' });
        }
      } catch {
        // ignore
      }
      break;

    default:
      await chrome.action.setBadgeText({ text: '' });
      break;
  }
}
