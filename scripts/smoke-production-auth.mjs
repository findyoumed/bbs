/**
 * Optional read-only authenticated smoke for the deployed UI.
 *
 * Set BBS_SMOKE_EMAIL and BBS_SMOKE_PASSWORD only in the invoking shell (or
 * CI secret store). The values are never printed or persisted. The smoke logs
 * in through the real terminal flow, then checks the bearer session against
 * authenticated read APIs without creating posts, memos, or email.
 */
'use strict';

import { chromium } from 'playwright';

const BASE_URL = String(process.env.BBS_PRODUCTION_URL || 'https://01410.vercel.app').replace(/\/$/, '');
const email = String(process.env.BBS_SMOKE_EMAIL || '').trim();
const password = String(process.env.BBS_SMOKE_PASSWORD || '');
const TIMEOUT = 30000;

function fail(message) {
  throw new Error(message);
}

async function readStoredAccessToken(page) {
  return page.evaluate(() => {
    for (const [, raw] of Object.entries(localStorage)) {
      if (!raw || !raw.includes('access_token')) continue;
      try {
        const parsed = JSON.parse(raw);
        const token = String(parsed?.access_token || parsed?.currentSession?.access_token || '').trim();
        if (token) return token;
      } catch {
        // Ignore unrelated localStorage values.
      }
    }
    return '';
  });
}

async function fetchAuthed(page, token, path) {
  return page.evaluate(async ({ token: accessToken, path: requestPath }) => {
    const response = await fetch(requestPath, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }, { token, path });
}

async function main() {
  if (!email || !password) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: 'BBS_SMOKE_EMAIL and BBS_SMOKE_PASSWORD are required for authenticated Production smoke'
    }));
    return;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);

    await page.goto(`${BASE_URL}/log/login`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('#cmd-input');
    await input.waitFor();
    await input.fill(email);
    await input.press('Enter');
    await page.waitForTimeout(300);
    await input.fill(password);
    await input.press('Enter');

    await page.waitForFunction(() => !document.querySelector('#login-transcript'), null, { timeout: TIMEOUT });
    const token = await readStoredAccessToken(page);
    if (!token) fail('authenticated UI flow completed without a stored Supabase access token');

    const checks = [
      ['/api/auth/session', 200],
      ['/api/memos?box=inbox&page=1&pageSize=10', 200],
      ['/api/members/stats', 200],
      ['/api/members/absent', 200]
    ];
    const results = [];
    for (const [path, expectedStatus] of checks) {
      const result = await fetchAuthed(page, token, path);
      if (result.status !== expectedStatus) {
        fail(`${path} expected ${expectedStatus} but received ${result.status}`);
      }
      results.push({ path, status: result.status });
    }

    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checks: results }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
