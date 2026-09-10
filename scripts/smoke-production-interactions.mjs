/**
 * Read-only interaction smoke for the deployed Production terminal.
 *
 * Covers the user-visible click/keyboard parity that geometry smoke cannot
 * detect. It never submits an authenticated mutation or sends email.
 */
'use strict';

import { chromium } from 'playwright';

const BASE_URL = String(process.env.BBS_PRODUCTION_URL || 'https://01410.vercel.app').replace(/\/$/, '');
const TIMEOUT = 30000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openReady(page, pathname) {
  await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForSelector('#terminal-screen', { timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const body = document.querySelector('#terminal-screen .ansi-screen-body');
    return Boolean(body && (body.textContent || '').trim());
  }, null, { timeout: TIMEOUT });
}

async function readInput(page) {
  return page.evaluate(() => ({
    value: document.getElementById('cmd-input')?.value || '',
    active: document.activeElement?.id || document.activeElement?.className || ''
  }));
}

async function verifyDesktop(page) {
  await openReady(page, '/');
  const prefill = page.locator('#cmd-hint [data-cmd-prefill^="GO"]').first();
  await prefill.click();
  let state = await readInput(page);
  assert(state.value === 'GO ', `GO click did not prefill exactly: ${JSON.stringify(state)}`);
  assert(state.active === 'cmd-input', `GO click did not focus input: ${JSON.stringify(state)}`);

  await openReady(page, '/');
  const helpToken = page.locator('#cmd-hint [data-cmd="H"]').first();
  await helpToken.focus();
  await helpToken.press('Enter');
  await page.waitForURL('**/help', { timeout: TIMEOUT });
  assert(page.url().endsWith('/help'), `H Enter did not navigate to help: ${page.url()}`);

  await page.locator('#cmd-input').fill('temporary');
  await page.locator('#cmd-input').press('Escape');
  state = await readInput(page);
  assert(page.url().endsWith('/help') && state.value === 'temporary',
    `Escape should not submit or redirect a direct help route: ${JSON.stringify(state)}`);
  await page.waitForTimeout(500);

  await openReady(page, '/log/login');
  const notice = page.locator('#login-small-notice');
  await notice.waitFor({ state: 'visible', timeout: TIMEOUT });
  await notice.click();
  await page.waitForURL('**/notice', { timeout: TIMEOUT });
  assert(page.url().endsWith('/notice'), `notice click did not navigate: ${page.url()}`);

  await openReady(page, '/log/login');
  const keyboardNotice = page.locator('#login-small-notice');
  await keyboardNotice.waitFor({ state: 'visible', timeout: TIMEOUT });
  await keyboardNotice.focus();
  await keyboardNotice.press('Enter');
  await page.waitForURL('**/notice', { timeout: TIMEOUT });
  assert(page.url().endsWith('/notice'), `notice Enter did not navigate: ${page.url()}`);
}

async function verifyMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  try {
    await openReady(page, '/');
    await page.locator('#cmd-hint [data-cmd-prefill^="GO"]').first().click();
    const state = await readInput(page);
    assert(state.value === 'GO ', `mobile GO click did not prefill: ${JSON.stringify(state)}`);
    assert(state.active !== 'cmd-input', `mobile GO click unexpectedly focused input: ${JSON.stringify(state)}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);
    try {
      await verifyDesktop(page);
    } finally {
      await context.close();
    }
    await verifyMobile(browser);
    console.log(JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      checks: [
        'desktop GO click/Enter parity',
        'desktop H Enter navigation',
        'desktop Escape no-submit guard',
        'notice click/Enter navigation',
        'mobile GO touch prefill'
      ]
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
