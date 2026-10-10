import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { Server as ProxyServer } from 'proxy-chain';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { AppState } from '../../src/core/types';

test.describe.serial('Smart Proxy E2E with Playwright (Task 16)', () => {
  let unauthProxy: ProxyServer;
  let authProxy: ProxyServer;
  let badAuthProxy: ProxyServer;
  let unauthReqCount = 0;
  let authReqCount = 0;
  const unauthRequestedHosts: string[] = [];

  let context: BrowserContext;
  let serviceWorker: Worker;
  let extensionId: string;
  let tempUserDataDir: string;

  test.beforeAll(async () => {
    // 1. Setup unauthenticated proxy
    unauthProxy = new ProxyServer({
      port: 0,
      prepareRequestFunction: ({ hostname }) => {
        unauthReqCount++;
        unauthRequestedHosts.push(hostname);
        return {
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><body><h1>Unauth Proxy OK</h1></body></html>',
          }),
        };
      },
    });
    await unauthProxy.listen();

    // 2. Setup authenticated proxy (user: testuser, pass: testpass)
    authProxy = new ProxyServer({
      port: 0,
      prepareRequestFunction: ({ username, password }) => {
        if (username !== 'testuser' || password !== 'testpass') {
          return { requestAuthentication: true };
        }
        authReqCount++;
        return {
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><body><h1>Auth Proxy OK</h1></body></html>',
          }),
        };
      },
    });
    await authProxy.listen();

    // 3. Setup proxy requiring auth that will always reject our wrong password
    badAuthProxy = new ProxyServer({
      port: 0,
      prepareRequestFunction: ({ username, password }) => {
        if (username !== 'validuser' || password !== 'validpass') {
          return { requestAuthentication: true };
        }
        return {
          customResponseFunction: () => ({
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><body><h1>Should not reach here</h1></body></html>',
          }),
        };
      },
    });
    await badAuthProxy.listen();

    // 4. Launch persistent Chromium context with extension loaded
    const extPath = path.resolve(process.cwd(), 'dist');
    tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-proxy-e2e-'));

    context = await chromium.launchPersistentContext(tempUserDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }

    const swUrl = new URL(serviceWorker.url());
    extensionId = swUrl.host;
    expect(extensionId).toBeDefined();
  });

  test.afterAll(async () => {
    if (context) await context.close();
    if (unauthProxy) await unauthProxy.close(true);
    if (authProxy) await authProxy.close(true);
    if (badAuthProxy) await badAuthProxy.close(true);
    if (tempUserDataDir && fs.existsSync(tempUserDataDir)) {
      try {
        fs.rmSync(tempUserDataDir, { recursive: true, force: true });
      } catch {
        // Ignored on Windows file locks
      }
    }
  });

  const setAppState = async (state: AppState) => {
    await serviceWorker.evaluate(async (s) => {
      await chrome.storage.local.set({ state: s });
    }, state);
    // Give background controller a moment to apply settings
    await new Promise((r) => setTimeout(r, 600));
  };

  test('Scenario 1: Mode fixed (unauthenticated proxy) loads page and records requests', async () => {
    unauthReqCount = 0;

    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'fixed', profileId: 'prof-unauth' },
      lastActiveMode: null,
      profiles: [
        {
          id: 'prof-unauth',
          name: 'Unauth Proxy',
          color: '#0055ff',
          scheme: 'http',
          host: '127.0.0.1',
          port: unauthProxy.port,
          bypassList: [],
        },
      ],
      rules: [],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const page = await context.newPage();
    await page.goto('http://proxy-scenario-1.test/check');
    const content = await page.textContent('body');

    expect(content).toContain('Unauth Proxy OK');
    expect(unauthReqCount).toBeGreaterThan(0);
    await page.close();
  });

  test('Scenario 2: Mode fixed (authenticated proxy) passes credentials without login prompt', async () => {
    authReqCount = 0;

    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'fixed', profileId: 'prof-auth' },
      lastActiveMode: null,
      profiles: [
        {
          id: 'prof-auth',
          name: 'Auth Proxy',
          color: '#00aa55',
          scheme: 'http',
          host: '127.0.0.1',
          port: authProxy.port,
          auth: { username: 'testuser', password: 'testpass' },
          bypassList: [],
        },
      ],
      rules: [],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const page = await context.newPage();
    await page.goto('http://proxy-scenario-2.test/check');
    const content = await page.textContent('body');

    expect(content).toContain('Auth Proxy OK');
    expect(authReqCount).toBeGreaterThan(0);
    await page.close();
  });

  test('Scenario 3: Wrong proxy credentials cancels request, prevents infinite loop, and records error', async () => {
    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'fixed', profileId: 'prof-wrong-auth' },
      lastActiveMode: null,
      profiles: [
        {
          id: 'prof-wrong-auth',
          name: 'Wrong Auth Proxy',
          color: '#ff5500',
          scheme: 'http',
          host: '127.0.0.1',
          port: badAuthProxy.port,
          auth: { username: 'testuser', password: 'WRONG_PASSWORD_XYZ' },
          bypassList: [],
        },
      ],
      rules: [],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const page = await context.newPage();

    // Navigating with bad credentials should reject (status 407 or thrown cancel) without hanging
    const resp = await page.goto('http://proxy-scenario-3.test/fail', { timeout: 7000 }).catch(() => null);
    expect(resp === null || resp.status() === 407).toBe(true);

    // Verify session errors recorded
    const errors = await serviceWorker.evaluate(async () => {
      const data = await chrome.storage.session.get('errors');
      return (data.errors as Array<{ error: string }>) || [];
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.error.includes('đăng nhập') || e.error.includes('net::'))).toBe(true);

    await page.close();
  });

  test('Scenario 4: Mode auto routes matching domain to proxy, other domains go DIRECT', async () => {
    unauthRequestedHosts.length = 0;

    const state: AppState = {
      schemaVersion: 1,
      mode: {
        kind: 'auto',
        defaultTarget: { type: 'direct' },
      },
      lastActiveMode: null,
      profiles: [
        {
          id: 'prof-pac-1',
          name: 'PAC Proxy',
          color: '#0055ff',
          scheme: 'http',
          host: '127.0.0.1',
          port: unauthProxy.port,
          bypassList: [],
        },
      ],
      rules: [
        {
          id: 'r-match',
          enabled: true,
          matchType: 'domain',
          pattern: 'site-a.custom',
          target: { type: 'profile', profileId: 'prof-pac-1' },
        },
      ],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const page = await context.newPage();

    // 1. site-a.custom matches rule -> goes through unauthProxy
    await page.goto('http://site-a.custom/route-me');
    const content = await page.textContent('body');
    expect(content).toContain('Unauth Proxy OK');
    expect(unauthRequestedHosts).toContain('site-a.custom');

    // 2. site-b.custom does not match rule -> goes DIRECT
    try {
      await page.goto('http://site-b.custom/do-not-proxy', { timeout: 3000 });
    } catch {
      // Expected since site-b.custom is not a real domain and goes direct
    }

    // Proxy should not receive request for site-b.custom
    expect(unauthRequestedHosts).not.toContain('site-b.custom');

    await page.close();
  });

  test('Scenario 5: Toggle off (mode direct) stops all proxying', async () => {
    unauthRequestedHosts.length = 0;

    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'direct' },
      lastActiveMode: { kind: 'fixed', profileId: 'prof-pac-1' },
      profiles: [
        {
          id: 'prof-pac-1',
          name: 'PAC Proxy',
          color: '#0055ff',
          scheme: 'http',
          host: '127.0.0.1',
          port: unauthProxy.port,
          bypassList: [],
        },
      ],
      rules: [],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const page = await context.newPage();
    try {
      await page.goto('http://site-a.custom/direct-mode', { timeout: 3000 });
    } catch {
      // Expected to fail directly
    }

    // Proxy received zero requests for site-a.custom
    expect(unauthRequestedHosts).not.toContain('site-a.custom');
    await page.close();
  });

  test('Scenario 6: Popup page UI toggle interacts with service worker and changes proxy settings', async () => {
    // Initialize with direct mode and 1 profile
    const state: AppState = {
      schemaVersion: 1,
      mode: { kind: 'direct' },
      lastActiveMode: null,
      profiles: [
        {
          id: 'prof-toggle',
          name: 'Toggle Proxy',
          color: '#0055ff',
          scheme: 'http',
          host: '127.0.0.1',
          port: unauthProxy.port,
          bypassList: [],
        },
      ],
      rules: [],
      settings: {
        theme: 'system',
        bypassLocal: false,
        notifyOnError: false,
        healthCheckUrl: 'https://www.gstatic.com/generate_204',
        ipCheckUrl: '',
      },
    };

    await setAppState(state);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Verify popup loads
    await popupPage.waitForSelector('div[role="switch"]');

    // Check proxy mode in chrome settings before clicking toggle
    let chromeProxy = await serviceWorker.evaluate(async () => {
      return new Promise<chrome.proxy.ProxyConfig>((resolve) => {
        chrome.proxy.settings.get({}, (res) => resolve(res.value));
      });
    });
    expect(chromeProxy.mode).toBe('direct');

    // Click the big toggle button
    const bigToggle = popupPage.locator('div[role="switch"]').first();
    await bigToggle.click();

    // Give service worker a moment to apply fixed mode
    await new Promise((r) => setTimeout(r, 800));

    // Check that chrome proxy mode is now fixed_servers
    chromeProxy = await serviceWorker.evaluate(async () => {
      return new Promise<chrome.proxy.ProxyConfig>((resolve) => {
        chrome.proxy.settings.get({}, (res) => resolve(res.value));
      });
    });

    expect(chromeProxy.mode).toBe('fixed_servers');
    expect(chromeProxy.rules?.singleProxy?.host).toBe('127.0.0.1');
    expect(chromeProxy.rules?.singleProxy?.port).toBe(unauthProxy.port);

    await popupPage.close();
  });
});
