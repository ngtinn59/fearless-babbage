import { beforeEach, describe, expect, it } from 'vitest';
import { updateBadge } from '../../src/background/badge';
import {
  applyState,
  enqueueApplyState,
  registerProxyController,
  SESSION_STATUS_KEY,
} from '../../src/background/proxy-controller';
import { createDefaultState } from '../../src/core/defaults';
import type { AppState, ProxyProfile } from '../../src/core/types';
import { setState } from '../../src/shared/storage';
import {
  type ChromeMockController,
  installChromeMock,
} from '../setup/chrome-mock';

describe('Background: Proxy Controller & Badge (Task 6)', () => {
  let mockCtrl: ChromeMockController;

  const testProfile: ProxyProfile = {
    id: 'p-corp',
    name: 'Corporate Proxy',
    color: '#0284c7',
    scheme: 'http',
    host: 'proxy.corp',
    port: 8080,
    bypassList: ['<local>'],
  };

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('Badge logic (badge.ts)', () => {
    it('sets empty badge for direct mode', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'direct' },
      };
      await updateBadge(state);
      expect(mockCtrl.action.getBadgeText()).toBe('');
    });

    it('sets SYS and neutral background for system mode', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'system' },
      };
      await updateBadge(state);
      expect(mockCtrl.action.getBadgeText()).toBe('SYS');
      expect(mockCtrl.action.getBadgeBackgroundColor()).toBe('#475569');
    });

    it('sets first 3 letters and profile color for fixed mode', async () => {
      const state: AppState = {
        ...createDefaultState(),
        profiles: [testProfile],
        mode: { kind: 'fixed', profileId: 'p-corp' },
      };
      await updateBadge(state);
      expect(mockCtrl.action.getBadgeText()).toBe('COR');
      expect(mockCtrl.action.getBadgeBackgroundColor()).toBe('#0284c7');
    });

    it('sets AUTO and green background for auto mode', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
      };
      await updateBadge(state);
      expect(mockCtrl.action.getBadgeText()).toBe('AUTO');
      expect(mockCtrl.action.getBadgeBackgroundColor()).toBe('#16a34a');
    });

    it('sets ! and red background when hasError is true', async () => {
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
      };
      await updateBadge(state, true);
      expect(mockCtrl.action.getBadgeText()).toBe('!');
      expect(mockCtrl.action.getBadgeBackgroundColor()).toBe('#dc2626');
    });
  });

  describe('Proxy Controller (proxy-controller.ts)', () => {
    it('applies direct mode config and saves controllable status in session', async () => {
      await setState(createDefaultState());
      await applyState();

      const settings = mockCtrl.proxy.getSettings();
      expect(settings).toEqual({ mode: 'direct' });
      expect(mockCtrl.action.getBadgeText()).toBe('');

      const sessionStatus = mockCtrl.getRaw('session')[SESSION_STATUS_KEY] as {
        controlled: boolean;
        levelOfControl: string;
      };
      expect(sessionStatus).toBeDefined();
      expect(sessionStatus.controlled).toBe(true);
      expect(sessionStatus.levelOfControl).toBe('controllable_by_this_extension');
    });

    it('applies fixed mode config to Chrome proxy settings', async () => {
      const state: AppState = {
        ...createDefaultState(),
        profiles: [testProfile],
        mode: { kind: 'fixed', profileId: 'p-corp' },
      };
      await setState(state);
      await applyState();

      const settings = mockCtrl.proxy.getSettings();
      expect(settings?.mode).toBe('fixed_servers');
      expect(settings?.rules?.singleProxy).toEqual({
        scheme: 'http',
        host: 'proxy.corp',
        port: 8080,
      });
      expect(mockCtrl.action.getBadgeText()).toBe('COR');
    });

    it('detects when controlled by another extension and marks controlled as false', async () => {
      mockCtrl.proxy.setLevelOfControl('controlled_by_other_extensions');
      await setState(createDefaultState());
      await applyState();

      const sessionStatus = mockCtrl.getRaw('session')[SESSION_STATUS_KEY] as {
        controlled: boolean;
        levelOfControl: string;
      };
      expect(sessionStatus.controlled).toBe(false);
      expect(sessionStatus.levelOfControl).toBe('controlled_by_other_extensions');
    });

    it('runs multiple enqueueApplyState calls sequentially without race conditions', async () => {
      await setState(createDefaultState());

      const p1 = enqueueApplyState();
      const p2 = enqueueApplyState();
      const p3 = enqueueApplyState();

      await Promise.all([p1, p2, p3]);

      expect(mockCtrl.proxy.getSettings()).toEqual({ mode: 'direct' });
    });

    it('registers lifecycle and storage listeners via registerProxyController()', async () => {
      registerProxyController();

      // Update state via storage
      const state: AppState = {
        ...createDefaultState(),
        mode: { kind: 'system' },
      };
      await setState(state);

      // Allow microtask queue to process
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockCtrl.proxy.getSettings()).toEqual({ mode: 'system' });
      expect(mockCtrl.action.getBadgeText()).toBe('SYS');

      // Test runtime.onStartup dispatch
      mockCtrl.runtime.dispatchStartup();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockCtrl.action.getBadgeText()).toBe('SYS');
    });
  });
});
