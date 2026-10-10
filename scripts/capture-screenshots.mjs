import { chromium } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/c10c19bd-e3e9-4a76-8432-e252a50497ac';
const DOCS_IMG_DIR = path.resolve(process.cwd(), 'docs/images');

fs.mkdirSync(DOCS_IMG_DIR, { recursive: true });

async function capture() {
  const extPath = path.resolve(process.cwd(), 'dist');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-ext-'));

  const context = await chromium.launchPersistentContext(tempDir, {
    headless: false,
    viewport: { width: 1000, height: 800 },
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
      '--lang=vi',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }

  const swUrl = new URL(sw.url());
  const extensionId = swUrl.host;
  console.log('Extension ID:', extensionId);

  // Seed realistic demo data
  const demoProfiles = [
    {
      id: 'p-us',
      name: 'US Premium (HTTP)',
      color: '#3b82f6',
      scheme: 'http',
      host: 'us-node1.smartproxy.io',
      port: 8080,
      auth: { username: 'vip_user', password: 'mypassword123' },
      bypassList: ['localhost', '127.0.0.1'],
    },
    {
      id: 'p-sg',
      name: 'Singapore Fast (SOCKS5)',
      color: '#10b981',
      scheme: 'socks5',
      host: 'sg-fast.proxyhub.net',
      port: 1080,
      bypassList: ['192.168.1.0/24'],
    },
    {
      id: 'p-jp',
      name: 'Japan Streaming (HTTPS)',
      color: '#ec4899',
      scheme: 'https',
      host: 'jp-tokyo.securenode.org',
      port: 8443,
      bypassList: [],
    },
  ];

  const demoRules = [
    {
      id: 'r-1',
      enabled: true,
      matchType: 'domain',
      pattern: 'x.com',
      target: { type: 'profile', profileId: 'p-us' },
      note: 'Mạng xã hội X / Twitter',
    },
    {
      id: 'r-2',
      enabled: true,
      matchType: 'domain',
      pattern: 'medium.com',
      target: { type: 'profile', profileId: 'p-sg' },
      note: 'Đọc blog công nghệ',
    },
    {
      id: 'r-3',
      enabled: true,
      matchType: 'wildcard',
      pattern: '*.netflix.com',
      target: { type: 'profile', profileId: 'p-jp' },
      note: 'Xem phim Netflix Nhật Bản',
    },
    {
      id: 'r-4',
      enabled: true,
      matchType: 'domain',
      pattern: 'intranet.corp.com',
      target: { type: 'direct' },
      note: 'Cổng thông tin công ty nội bộ',
    },
  ];

  const demoState = {
    schemaVersion: 1,
    mode: { kind: 'auto', defaultTarget: { type: 'direct' } },
    lastActiveMode: { kind: 'auto', defaultTarget: { type: 'direct' } },
    profiles: demoProfiles,
    rules: demoRules,
    settings: {
      theme: 'light',
      bypassLocal: true,
      notifyOnError: true,
      healthCheckUrl: 'https://www.gstatic.com/generate_204',
      ipCheckUrl: 'https://api.ipify.org?format=json',
    },
  };

  // Write demo state to storage
  await sw.evaluate(async (state) => {
    await chrome.storage.local.set({ state });
  }, demoState);

  await new Promise((r) => setTimeout(r, 600));

  async function saveScreenshot(page, filename, clip = null) {
    const docsPath = path.join(DOCS_IMG_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);

    const opts = { path: docsPath };
    if (clip) opts.clip = clip;

    await page.screenshot(opts);
    fs.copyFileSync(docsPath, artifactPath);
    console.log(`Saved screenshot: ${filename}`);
  }

  // 1. Capture Popup Page
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 380, height: 600 });
  await popupPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await popupPage.waitForSelector('button');
  await new Promise((r) => setTimeout(r, 800));

  await saveScreenshot(popupPage, '01_popup_overview.png', {
    x: 0,
    y: 0,
    width: 360,
    height: 560,
  });
  await popupPage.close();

  // 2. Capture Options - Profiles
  const optionsPage = await context.newPage();
  await optionsPage.setViewportSize({ width: 1000, height: 820 });
  await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await optionsPage.waitForSelector('button');
  await new Promise((r) => setTimeout(r, 800));

  await saveScreenshot(optionsPage, '02_options_profiles.png');

  // 3. Capture Options - Rules (Tab 2)
  const navButtons = optionsPage.locator('nav button');
  await navButtons.nth(1).click();
  await new Promise((r) => setTimeout(r, 600));

  // Type a test host in the Rule Tester input to show how matching looks
  const testerInput = optionsPage.locator('input[placeholder*="api.github.com"]');
  if ((await testerInput.count()) > 0) {
    await testerInput.fill('x.com');
    await new Promise((r) => setTimeout(r, 500));
  }

  await saveScreenshot(optionsPage, '03_options_rules.png');

  // 4. Capture Options - General (Tab 3)
  await navButtons.nth(2).click();
  await new Promise((r) => setTimeout(r, 600));

  await saveScreenshot(optionsPage, '04_options_general.png');

  // 5. Capture Options - Backup (Tab 4)
  await navButtons.nth(3).click();
  await new Promise((r) => setTimeout(r, 600));

  await saveScreenshot(optionsPage, '05_options_backup.png');

  await optionsPage.close();
  await context.close();

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignored
  }
}

capture()
  .then(() => console.log('Tất cả ảnh chụp màn hình đã hoàn thành!'))
  .catch((err) => {
    console.error('Lỗi khi chụp màn hình:', err);
    process.exit(1);
  });
