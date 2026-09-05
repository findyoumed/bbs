'use strict';

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3198;
const ROUTES = ['/', '/guide/tosysop', '/memo', '/board/plaza'];

function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`server failed to respond on port ${PORT}`));
        return;
      }
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(poll, 200);
      });
      req.on('error', () => setTimeout(poll, 200));
      req.setTimeout(700, () => req.destroy());
    };
    poll();
  });
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
    const bundledChromium = '/opt/pw-browsers/chromium';
    if (fs.existsSync(bundledChromium)) launchOptions.executablePath = bundledChromium;
    browser = await chromium.launch(launchOptions);
    for (const route of ROUTES) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      try {
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
        // Route restoration may transition through the loading shell (notably
        // the guest /guide/tosysop login boundary).  Allow the terminal footer
        // state to settle before measuring the final layout.
        await page.waitForTimeout(450);
        const metrics = await page.evaluate(() => {
          const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
          const screen = rect('#terminal-screen');
          const body = rect('.ansi-screen-body');
          const footerEl = document.querySelector('#terminal-footer');
          const footer = rect('#terminal-footer');
          const prompt = rect('#terminal-prompt-row');
          const wrapper = document.querySelector('#terminal-wrapper');
          return {
            screenBottom: screen?.bottom ?? null,
            bodyBottom: body?.bottom ?? null,
            footerTop: footer?.top ?? null,
            footerHeight: footer?.height ?? 0,
            promptTop: prompt?.top ?? null,
            promptHeight: prompt?.height ?? 0,
            footerDetached: footerEl?.classList.contains('terminal-footer--prompt-detached') ?? false,
            wrapperOverflowX: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : null
          };
        });
        // Prompt-detached screens (login and protected menu boundaries) mount
        // the command row inline in the body and intentionally hide the
        // footer shell.  Measure the actual command row in that case.
        const commandTop = metrics.footerDetached ? metrics.promptTop : metrics.footerTop;
        const contentBottom = metrics.footerDetached
          ? Number(metrics.bodyBottom) - Number(metrics.promptHeight)
          : Number(metrics.bodyBottom);
        const gap = Number(commandTop) - contentBottom;
        if (!Number.isFinite(gap) || gap < -1 || gap > 8) {
          failures.push(`${route}: command row gap ${Number.isFinite(gap) ? `${gap.toFixed(1)}px` : 'unknown'}`);
        }
        if (metrics.footerHeight <= 0 && (!metrics.footerDetached || metrics.promptHeight <= 0)) {
          failures.push(`${route}: command footer is not visible`);
        }
        if (Number(metrics.wrapperOverflowX) > 1) failures.push(`${route}: horizontal overflow ${metrics.wrapperOverflowX}px`);
        console.log(`  ${route}: body→command gap ${Number.isFinite(gap) ? `${gap.toFixed(1)}px` : 'unknown'}`);
      } finally {
        await page.close();
      }
    }

    // The small notice is a pre-login landing affordance.  Simulate a
    // resolved member session and ensure the authenticated main menu neither
    // requests nor renders the public landing notice.
    const memberPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    let authenticatedNoticeRequests = 0;
    await memberPage.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { user: { userId: 'command-flow-member', nickName: 'QA', level: 1, isGuest: false } }
        })
      });
    });
    await memberPage.route('**/api/boards/notice**', async (route) => {
      authenticatedNoticeRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ title: '인증 화면에 노출되면 안 되는 공지' }] })
      });
    });
    try {
      await memberPage.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
      const bodyText = await memberPage.locator('.ansi-screen-body').innerText();
      if (authenticatedNoticeRequests !== 0) {
        failures.push('authenticated main menu requested the pre-login notice');
      }
      if (bodyText.includes('GO NOTICE') || bodyText.includes('인증 화면에 노출되면 안 되는 공지')) {
        failures.push('authenticated main menu rendered the pre-login notice');
      }
    } finally {
      await memberPage.close();
    }

    // The contact editor may be bookmarked at its short `/tosysop` alias.
    // Verify that a refresh restores the editor rather than the public board
    // list that happens to use the same key.
    const contactAliasPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await contactAliasPage.route('**/api/auth/session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { user: { userId: 'command-flow-contact', nickName: 'QA', level: 1, isGuest: false } }
        })
      });
    });
    try {
      await contactAliasPage.goto(`http://localhost:${PORT}/tosysop`, { waitUntil: 'networkidle' });
      await contactAliasPage.waitForTimeout(450);
      const contactAliasState = await contactAliasPage.evaluate(() => ({
        screen: window.__debugState?.screen || '',
        hasSubject: Boolean(document.querySelector('#tosysop-ed-subject'))
      }));
      if (contactAliasState.screen !== 'contact-sysop' || !contactAliasState.hasSubject) {
        failures.push(`short /tosysop alias did not restore contact editor: ${JSON.stringify(contactAliasState)}`);
      }
    } finally {
      await contactAliasPage.close();
    }

    const loginPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await loginPage.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: { userId: 'guest', nickName: '손님', level: 1, isGuest: true } } })
      });
    });
    await loginPage.route('**/api/boards/notice**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ title: '로그인 전 공지' }] })
      });
    });
    try {
      await loginPage.goto(`http://localhost:${PORT}/log/login`, { waitUntil: 'networkidle' });
      const loginNotice = loginPage.locator('#login-small-notice');
      await loginNotice.waitFor({ state: 'visible', timeout: 3000 });
      const loginNoticeText = await loginNotice.innerText();
      const loginNoticeColor = await loginNotice.evaluate((node) => getComputedStyle(node).color);
      if (!loginNoticeText.includes('GO NOTICE')) {
        failures.push('pre-login login screen did not render GO NOTICE');
      }
      if (loginNoticeColor !== 'rgb(255, 255, 255)') {
        failures.push(`pre-login small notice foreground is ${loginNoticeColor}, expected white`);
      }
    } catch (error) {
      failures.push(`pre-login login screen notice failed: ${error.message}`);
    } finally {
      await loginPage.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  const result = { ok: failures.length === 0, viewport: '1366x768', routes: ROUTES.length, failures };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
