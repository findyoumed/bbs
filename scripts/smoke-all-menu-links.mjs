import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3197;
const BASE = `http://localhost:${PORT}`;

function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`server failed to respond on port ${PORT}`));
        return;
      }
      const req = http.get(`${BASE}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(poll, 120);
      });
      req.on('error', () => setTimeout(poll, 120));
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
  await page.waitForTimeout(450);
  return page.evaluate(() => ({
    screen: window.__debugState?.screen || document.body.dataset.screen || '',
    url: `${location.pathname}${location.search}`,
    topbar: document.querySelector('.retro-topbar-center')?.textContent?.trim() || ''
  }));
}

async function openParentMenu(page, parentPath) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await settle(page);
  for (const segment of parentPath) {
    const hotspot = page.locator(`.ansi-hotspot[data-node-key="${segment}"]`).first();
    await hotspot.waitFor({ state: 'visible', timeout: 3000 });
    await hotspot.click();
    await settle(page);
  }
}

async function createMemberPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.route('**/api/auth/session*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { user: { userId: 'all-menu-smoke', nickName: 'QA', level: 1, isGuest: false } }
      })
    });
  });
  return page;
}

async function main() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', RATE_LIMIT_MAX_REQUESTS: '10000' },
    stdio: 'ignore'
  });
  let browser;
  const failures = [];
  try {
    await waitForServer();
    const launchOptions = { headless: true };
    if (fs.existsSync('/opt/pw-browsers/chromium')) launchOptions.executablePath = '/opt/pw-browsers/chromium';
    browser = await chromium.launch(launchOptions);
    const page = await createMemberPage(browser);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await settle(page);
    const menu = await page.evaluate(() => window.__debugState?.menuTree || null);
    const nodes = flattenMenu(menu);
    if (!nodes.length) throw new Error('menu tree did not hydrate');

    const uniqueGo = new Map(nodes.map((node) => [node.go.toUpperCase(), node]));
    for (const node of nodes) {
      try {
        await openParentMenu(page, node.parentPath);
        const hotspot = page.locator(`.ansi-hotspot[data-node-key="${node.go}"]`).first();
        await hotspot.waitFor({ state: 'visible', timeout: 3000 });
        await hotspot.click();
        const clicked = await settle(page);
        if (!clicked.screen || clicked.screen === 'main' || clicked.screen === 'login') {
          failures.push(`click ${node.path.join('/')}: unexpected screen=${clicked.screen} url=${clicked.url}`);
          continue;
        }

        const clickedUrl = clicked.url;
        await page.goto(`${BASE}${clickedUrl}`, { waitUntil: 'networkidle' });
        const restored = await settle(page);
        if (!restored.screen || restored.screen === 'main' || restored.screen === 'login') {
          failures.push(`reload ${node.path}: unexpected screen=${restored.screen} url=${restored.url} (from ${clickedUrl})`);
        }
      } catch (error) {
        failures.push(`click ${node.path}: ${error.message}`);
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
        if (!result.screen || result.screen === 'main' || result.screen === 'login') {
          failures.push(`GO ${node.go}: unexpected screen=${result.screen} url=${result.url}`);
        }
      } catch (error) {
        failures.push(`GO ${node.go}: ${error.message}`);
      }
    }

    await page.close();
    const result = {
      ok: failures.length === 0,
      menuNodes: nodes.length,
      uniqueGo: uniqueGo.size,
      checked: nodes.length + uniqueGo.size,
      failures
    };
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
