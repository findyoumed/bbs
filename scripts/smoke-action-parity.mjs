/**
 * Browser-level parity checks for static command-hint actions.
 *
 * The registry and markup smokes prove the contract is present. This smoke
 * verifies that a real click and keyboard Enter reach the same browser path,
 * while prefill actions remain input-only on both desktop and touch layouts.
 */
'use strict';

import { chromium } from 'playwright';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  config,
  startServer,
  stopServer,
  isBrowserLaunchBlocked,
  ensureTerminalReady
} = require('./smoke/common-utils');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openMain(page) {
  await page.goto(`${config.BASE_URL}/`, { waitUntil: 'networkidle' });
  const errors = [];
  assert(await ensureTerminalReady(page, '/', errors), errors.join('; ') || 'terminal did not become ready');
  await page.waitForSelector('#cmd-hint [data-cmd="H"]');
  await page.waitForSelector('#cmd-hint [data-cmd-prefill^="GO"]');
}

async function readState(page) {
  return page.evaluate(() => ({
    screen: document.querySelector('#terminal-container')?.getAttribute('data-screen') || '',
    url: window.location.pathname,
    value: document.getElementById('cmd-input')?.value || '',
    active: document.activeElement?.id || document.activeElement?.className || ''
  }));
}

async function verifyPrefillClickAndEnter(page) {
  await openMain(page);
  const go = page.locator('#cmd-hint [data-cmd-prefill^="GO"]').first();
  await go.click();
  const clicked = await readState(page);
  assert(clicked.value === 'GO ', `GO click should prefill exactly "GO ": ${JSON.stringify(clicked)}`);
  assert(clicked.screen === 'main' && clicked.url === '/', `GO click should not navigate: ${JSON.stringify(clicked)}`);
  assert(clicked.active === 'cmd-input', `desktop GO click should focus cmd-input: ${JSON.stringify(clicked)}`);

  await openMain(page);
  const keyboardGo = page.locator('#cmd-hint [data-cmd-prefill^="GO"]').first();
  await keyboardGo.focus();
  await keyboardGo.press('Enter');
  const keyed = await readState(page);
  assert(keyed.value === 'GO ', `GO Enter should prefill exactly "GO ": ${JSON.stringify(keyed)}`);
  assert(keyed.screen === 'main' && keyed.url === '/', `GO Enter should not navigate: ${JSON.stringify(keyed)}`);
  assert(keyed.active === 'cmd-input', `desktop GO Enter should focus cmd-input: ${JSON.stringify(keyed)}`);
}

async function verifyImmediateClickAndEnter(page) {
  await openMain(page);
  await page.locator('#cmd-hint [data-cmd="H"]').first().click();
  await page.waitForSelector('#terminal-container[data-screen="help"]');
  assert(page.url().endsWith('/help'), `H click should navigate to /help: ${page.url()}`);

  await openMain(page);
  const keyboardHelp = page.locator('#cmd-hint [data-cmd="H"]').first();
  await keyboardHelp.focus();
  await keyboardHelp.press('Enter');
  await page.waitForSelector('#terminal-container[data-screen="help"]');
  assert(page.url().endsWith('/help'), `H Enter should navigate to /help: ${page.url()}`);
}

async function verifyMobilePrefill(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await openMain(page);
    await page.locator('#cmd-hint [data-cmd-prefill^="GO"]').first().click();
    const state = await readState(page);
    assert(state.value === 'GO ', `mobile GO click should prefill exactly "GO ": ${JSON.stringify(state)}`);
    assert(state.screen === 'main' && state.url === '/', `mobile GO click should not navigate: ${JSON.stringify(state)}`);
    assert(state.active !== 'cmd-input', `mobile GO click should not force focus/keyboard: ${JSON.stringify(state)}`);
  } finally {
    await context.close();
  }
}

async function main() {
  let serverHandle;
  let browser;
  try {
    serverHandle = await startServer();
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      if (isBrowserLaunchBlocked(error)) {
        console.log(JSON.stringify({ ok: true, skipped: 'browser-launch-blocked', message: error.message }));
        return;
      }
      throw error;
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(config.TIMEOUT);
    page.setDefaultNavigationTimeout(config.TIMEOUT);
    try {
      await verifyPrefillClickAndEnter(page);
      await verifyImmediateClickAndEnter(page);
      await verifyMobilePrefill(browser);
    } finally {
      await context.close();
    }
    console.log(JSON.stringify({ ok: true, checks: ['desktop prefill click', 'desktop prefill Enter', 'desktop immediate click', 'desktop immediate Enter', 'mobile prefill focus guard'] }, null, 2));
  } finally {
    if (browser) await browser.close();
    await stopServer(serverHandle);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
