import { describe, it, expect, beforeEach } from 'vitest';
import { installChromeMock } from '../setup/chrome-mock';
import {
  extractHostname,
  rebuildContextMenu,
  handleContextMenuClick,
  registerContextMenu,
} from '../../src/background/context-menu';
import { registerCommands } from '../../src/background/commands';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile } from '../../src/core/types';
import { getState, setState } from '../../src/shared/storage';

describe('Background: Context Menu & Shortcuts (Task 15)', () => {
  let mock: ReturnType<typeof installChromeMock>;

  const profileA: ProxyProfile = {
    id: 'prof-test-1',
    name: 'Singapore Proxy',
    color: '#0077ff',
    scheme: 'http',
    host: 'sg.proxy.com',
    port: 8080,
    bypassList: [],
  };

  const profileB: ProxyProfile = {
    id: 'prof-test-2',
    name: 'US Proxy',
    color: '#00cc66',
    scheme: 'https',
    host: 'us.proxy.com',
    port: 8443,
    bypassList: [],
  };

  beforeEach(() => {
    mock = installChromeMock();
    mock.reset();
  });

  describe('extractHostname()', () => {
    it('extracts valid domain from http and https URLs', () => {
      expect(extractHostname('https://github.com/trending')).toBe('github.com');
      expect(extractHostname('http://example.org:8080/path?q=1')).toBe('example.org');
    });

    it('returns null for non-web schemes or malformed URLs', () => {
      expect(extractHostname('chrome://extensions')).toBeNull();
      expect(extractHostname('about:blank')).toBeNull();
      expect(extractHostname('not a valid url')).toBeNull();
      expect(extractHostname(undefined)).toBeNull();
    });
  });

  describe('rebuildContextMenu()', () => {
    it('creates root menu, submenus for profiles, separator, and direct option', async () => {
      await rebuildContextMenu([profileA, profileB]);

      const menus = mock.contextMenus.getMenus();
      expect(menus.length).toBe(5);

      expect(menus[0]).toMatchObject({
        id: 'smart-proxy-root',
        title: 'Smart Proxy: Thêm domain này',
      });
      expect(menus[1]).toMatchObject({
        id: 'smart-proxy-profile:prof-test-1',
        parentId: 'smart-proxy-root',
        title: 'Đi qua Singapore Proxy',
      });
      expect(menus[2]).toMatchObject({
        id: 'smart-proxy-profile:prof-test-2',
        parentId: 'smart-proxy-root',
        title: 'Đi qua US Proxy',
      });
      expect(menus[3]).toMatchObject({
        id: 'smart-proxy-sep',
        parentId: 'smart-proxy-root',
        type: 'separator',
      });
      expect(menus[4]).toMatchObject({
        id: 'smart-proxy-direct',
        parentId: 'smart-proxy-root',
        title: 'Luôn trực tiếp',
      });
    });
  });

  describe('handleContextMenuClick()', () => {
    it('adds a new domain rule to the top pointing to profile and notifies if mode is not auto', async () => {
      const initialState: AppState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: 'prof-test-1' },
        profiles: [profileA],
        rules: [
          {
            id: 'rule-old',
            enabled: true,
            matchType: 'domain',
            pattern: 'old.example.com',
            target: { type: 'direct' },
          },
        ],
      };

      await setState(initialState);

      const clickInfo: chrome.contextMenus.OnClickData = {
        menuItemId: 'smart-proxy-profile:prof-test-1',
        editable: false,
        pageUrl: 'https://news.ycombinator.com/item?id=123',
      };

      await handleContextMenuClick(clickInfo);

      const updated = await getState();
      expect(updated.rules.length).toBe(2);
      expect(updated.rules[0].pattern).toBe('news.ycombinator.com');
      expect(updated.rules[0].target).toEqual({ type: 'profile', profileId: 'prof-test-1' });

      // Check notification sent because mode was fixed, not auto
      const notifications = mock.notifications.getCreated();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toContain('news.ycombinator.com');
      expect(notifications[0].message).toContain('Tự động (Auto)');
    });

    it('does not send notification when already in auto mode', async () => {
      const initialState: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
        profiles: [profileA],
        rules: [],
      };

      await setState(initialState);

      const clickInfo: chrome.contextMenus.OnClickData = {
        menuItemId: 'smart-proxy-direct',
        editable: false,
        pageUrl: 'https://reddit.com/r/programming',
      };

      await handleContextMenuClick(clickInfo);

      const updated = await getState();
      expect(updated.rules.length).toBe(1);
      expect(updated.rules[0].pattern).toBe('reddit.com');
      expect(updated.rules[0].target).toEqual({ type: 'direct' });

      // No notification because mode is already auto
      const notifications = mock.notifications.getCreated();
      expect(notifications.length).toBe(0);
    });

    it('moves existing rule to the top and updates target when re-adding domain', async () => {
      const initialState: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
        profiles: [profileA],
        rules: [
          {
            id: 'r1',
            enabled: true,
            matchType: 'domain',
            pattern: 'target.com',
            target: { type: 'direct' },
          },
          {
            id: 'r2',
            enabled: true,
            matchType: 'domain',
            pattern: 'other.com',
            target: { type: 'direct' },
          },
        ],
      };

      await setState(initialState);

      const clickInfo: chrome.contextMenus.OnClickData = {
        menuItemId: 'smart-proxy-profile:prof-test-1',
        editable: false,
        pageUrl: 'https://target.com/test',
      };

      await handleContextMenuClick(clickInfo);

      const updated = await getState();
      expect(updated.rules.length).toBe(2);
      expect(updated.rules[0].pattern).toBe('target.com');
      expect(updated.rules[0].target).toEqual({ type: 'profile', profileId: 'prof-test-1' });
      expect(updated.rules[1].pattern).toBe('other.com');
    });
  });

  describe('registerCommands()', () => {
    it('toggles proxy state on toggle-proxy shortcut', async () => {
      registerCommands();

      const initialState: AppState = {
        ...createDefaultState(),
        mode: { kind: 'fixed', profileId: 'prof-test-1' },
        profiles: [profileA],
      };

      await setState(initialState);

      // Dispatch shortcut Alt+Shift+P
      mock.commands.dispatchCommand('toggle-proxy');

      // Wait a tick for async storage update
      await new Promise((r) => setTimeout(r, 50));

      const updated = await getState();
      expect(updated.mode).toEqual({ kind: 'direct' });
      expect(updated.lastActiveMode).toEqual({ kind: 'fixed', profileId: 'prof-test-1' });

      // Dispatch again to turn back ON
      mock.commands.dispatchCommand('toggle-proxy');
      await new Promise((r) => setTimeout(r, 50));

      const restored = await getState();
      expect(restored.mode).toEqual({ kind: 'fixed', profileId: 'prof-test-1' });
    });
  });

  describe('registerContextMenu()', () => {
    it('automatically rebuilds context menu when profiles are updated in storage', async () => {
      await setState({
        ...createDefaultState(),
        profiles: [profileA],
      });

      registerContextMenu();

      // Wait initial build
      await new Promise((r) => setTimeout(r, 50));
      expect(mock.contextMenus.getMenus().length).toBe(4);

      // Add a second profile and update state
      await setState({
        ...createDefaultState(),
        profiles: [profileA, profileB],
      });

      await new Promise((r) => setTimeout(r, 50));
      const updatedMenus = mock.contextMenus.getMenus();
      expect(updatedMenus.length).toBe(5);
      expect(updatedMenus.some((m) => m.id === 'smart-proxy-profile:prof-test-2')).toBe(true);
    });
  });
});
