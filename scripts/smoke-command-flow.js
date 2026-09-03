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
        const metrics = await page.evaluate(() => {
          const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
          const screen = rect('#terminal-screen');
          const body = rect('.ansi-screen-body');
          const footer = rect('#terminal-footer');
          const wrapper = document.querySelector('#terminal-wrapper');
          return {
            screenBottom: screen?.bottom ?? null,
            bodyBottom: body?.bottom ?? null,
            footerTop: footer?.top ?? null,
            footerHeight: footer?.height ?? 0,
            wrapperOverflowX: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : null
          };
        });
        const gap = Number(metrics.footerTop) - Number(metrics.bodyBottom);
        if (!Number.isFinite(gap) || gap < -1 || gap > 8) {
          failures.push(`${route}: command row gap ${Number.isFinite(gap) ? `${gap.toFixed(1)}px` : 'unknown'}`);
        }
        if (metrics.footerHeight <= 0) failures.push(`${route}: command footer is not visible`);
        if (Number(metrics.wrapperOverflowX) > 1) failures.push(`${route}: horizontal overflow ${metrics.wrapperOverflowX}px`);
        console.log(`  ${route}: body→command gap ${Number.isFinite(gap) ? `${gap.toFixed(1)}px` : 'unknown'}`);
      } finally {
        await page.close();
      }
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
