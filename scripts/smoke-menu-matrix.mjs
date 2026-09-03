import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3196;
const BASE = `http://localhost:${PORT}`;
const PROFILES = [
  { name: 'desktop-member', width: 1366, height: 768, guest: false },
  { name: 'desktop-guest', width: 1366, height: 768, guest: true },
  { name: 'mobile-member', width: 390, height: 844, guest: false },
  { name: 'mobile-guest', width: 390, height: 844, guest: true }
];

function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (Date.now() - startedAt >= timeoutMs) return reject(new Error('server startup timeout'));
      const req = http.get(`${BASE}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(); else setTimeout(poll, 100);
      });
      req.on('error', () => setTimeout(poll, 100));
      req.setTimeout(700, () => req.destroy());
    };
    poll();
  });
}

function flattenMenu(root) {
  const rows = [];
  const walk = (node, parentPath = []) => {
    const go = String(node?.go || '').trim();
    if (!go || go === 'top') {
      for (const child of node?.children || []) walk(child, []);
      return;
    }
    const path = [...parentPath, go];
    rows.push({
      go,
      type: String(node?.type || ''),
      name: String(node?.name || ''),
      parentPath,
      path
    });
    for (const child of node?.children || []) walk(child, path);
  };
  walk(root);
  return rows;
}

async function settle(page) {
  await page.waitForTimeout(300);
  return page.evaluate(() => ({
    screen: window.__debugState?.screen || document.body.dataset.screen || '',
    url: `${location.pathname}${location.search}`
  }));
}

async function createPage(browser, profile, failures) {
  const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height } });
  page.on('pageerror', (error) => failures.push(`${profile.name}: pageerror ${error.message}`));
  await page.route('**/api/auth/session*', async (route) => {
    const user = profile.guest
      ? { userId: 'guest', nickName: '손님', level: 1, isGuest: true }
      : { userId: `menu-${profile.name}`, nickName: 'QA', level: 1, isGuest: false };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user } })
    });
  });
  return page;
}

async function openParent(page, parentPath) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await settle(page);
  for (const segment of parentPath) {
    const hotspot = page.locator(`.ansi-hotspot[data-node-key="${segment}"]`).first();
    await hotspot.waitFor({ state: 'visible', timeout: 3000 });
    await hotspot.click();
    await settle(page);
  }
}

async function assertKeyboardContract(page, node, profile, failures) {
  const hotspot = page.locator(`.ansi-hotspot[data-node-key="${node.go}"]`).first();
  const contract = await hotspot.evaluate((el) => ({
    role: el.getAttribute('role'),
    tabIndex: el.tabIndex,
    label: el.getAttribute('aria-label') || ''
  }));
  if (contract.role !== 'button' || contract.tabIndex < 0 || !contract.label) {
    failures.push(`${profile.name}: ${node.path.join('/')}: hotspot is not keyboard accessible (${JSON.stringify(contract)})`);
  }
}

async function runProfile(browser, profile, failures) {
  const page = await createPage(browser, profile, failures);
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await settle(page);
    const menu = await page.evaluate(() => window.__debugState?.menuTree || null);
    const nodes = flattenMenu(menu);
    if (!nodes.length) throw new Error(`${profile.name}: menu tree did not hydrate`);
    const uniqueGo = new Map(nodes.map((node) => [node.go.toUpperCase(), node]));
    const keyboardParents = new Set();

    for (const node of nodes) {
      try {
        await openParent(page, node.parentPath);
        const hotspot = page.locator(`.ansi-hotspot[data-node-key="${node.go}"]`).first();
        await hotspot.waitFor({ state: 'visible', timeout: 3000 });
        await assertKeyboardContract(page, node, profile, failures);
        const parentKey = node.parentPath.join('/');
        if (!keyboardParents.has(parentKey)) {
          keyboardParents.add(parentKey);
          await hotspot.focus();
          await page.keyboard.press('Enter');
        } else {
          await hotspot.click();
        }
        const clicked = await settle(page);
        if (!clicked.screen || clicked.screen === 'main') {
          failures.push(`${profile.name}: click ${node.path.join('/')}: unexpected screen=${clicked.screen} url=${clicked.url}`);
          continue;
        }

        await page.goto(`${BASE}${clicked.url}`, { waitUntil: 'networkidle' });
        const restored = await settle(page);
        if (!restored.screen || restored.screen === 'main') {
          failures.push(`${profile.name}: reload ${node.path}: unexpected screen=${restored.screen} url=${restored.url}`);
        }
      } catch (error) {
        failures.push(`${profile.name}: click ${node.path.join('/')}: ${error.message}`);
      }
    }

    for (const node of uniqueGo.values()) {
      try {
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        await settle(page);
        const input = page.locator('#cmd-input');
        await input.fill(`GO ${node.go}`);
        await input.press('Enter');
        const result = await settle(page);
        if (!result.screen || result.screen === 'main') {
          failures.push(`${profile.name}: GO ${node.go}: unexpected screen=${result.screen} url=${result.url}`);
        }
      } catch (error) {
        failures.push(`${profile.name}: GO ${node.go}: ${error.message}`);
      }
    }

    return { nodes: nodes.length, uniqueGo: uniqueGo.size };
  } finally {
    await page.close();
  }
}

async function main() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', RATE_LIMIT_MAX_REQUESTS: '10000' },
    stdio: 'ignore'
  });
  let browser;
  const failures = [];
  const summary = [];
  try {
    await waitForServer();
    const launchOptions = { headless: true };
    if (fs.existsSync('/opt/pw-browsers/chromium')) launchOptions.executablePath = '/opt/pw-browsers/chromium';
    browser = await chromium.launch(launchOptions);
    for (const profile of PROFILES) {
      const result = await runProfile(browser, profile, failures);
      summary.push({ profile: profile.name, ...result });
    }
    const result = { ok: failures.length === 0, profiles: summary, checked: summary.reduce((n, item) => n + item.nodes + item.uniqueGo, 0), failures };
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
