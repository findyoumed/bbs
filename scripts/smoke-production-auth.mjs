/**
 * Optional read-only authenticated smoke for the deployed UI.
 *
 * Set BBS_SMOKE_EMAIL and BBS_SMOKE_PASSWORD only in the invoking shell (or
 * CI secret store). The values are never printed or persisted. The smoke logs
 * in through the real terminal flow, then checks the bearer session against
 * authenticated read APIs. BBS_SMOKE_WRITE=1 additionally creates and
 * removes one test post; memo writes stay disabled because recipients can
 * trigger external email notifications.
 */
'use strict';

import { chromium } from 'playwright';

const BASE_URL = String(process.env.BBS_PRODUCTION_URL || 'https://01410.vercel.app').replace(/\/$/, '');
const email = String(process.env.BBS_SMOKE_EMAIL || '').trim();
const password = String(process.env.BBS_SMOKE_PASSWORD || '');
const writeEnabled = process.env.BBS_SMOKE_WRITE === '1';
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

async function fetchAuthed(page, token, path, options = {}) {
  return page.evaluate(async ({ token: accessToken, path: requestPath, method, body }) => {
    const response = await fetch(requestPath, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
    return { status: response.status, body: responseBody };
  }, { token, path, method: options.method || 'GET', body: options.body });
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

    // A successful auth callback can leave the previous transcript node in
    // place for one render tick while the main screen is mounting. Treat the
    // persisted Supabase token as the authoritative completion signal.
    try {
      await page.waitForFunction(() => {
        const hasToken = Object.values(localStorage).some((raw) => String(raw || '').includes('access_token'));
        return hasToken || !document.querySelector('#login-transcript');
      }, null, { timeout: TIMEOUT });
    } catch (error) {
      const diagnostics = await page.evaluate(() => ({
        path: location.pathname,
        loginTranscript: Boolean(document.querySelector('#login-transcript')),
        inputPresent: Boolean(document.querySelector('#cmd-input')),
        inputValueLength: document.querySelector('#cmd-input')?.value?.length || 0,
        storageKeys: Object.keys(localStorage),
        screenText: String(document.querySelector('#terminal-screen')?.textContent || '').slice(-240)
      }));
      throw new Error(`login UI did not establish a session: ${JSON.stringify(diagnostics)} (${error.message})`);
    }
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

    if (writeEnabled) {
      const stamp = Date.now();
      const title = `[auth smoke] ${stamp}`;
      const created = await fetchAuthed(page, token, '/api/boards/plaza/posts', {
        method: 'POST',
        body: { title, content: `production auth smoke ${stamp}` }
      });
      if (created.status !== 201) {
        fail(`/api/boards/plaza/posts expected 201 but received ${created.status}`);
      }
      const createdPost = created.body?.data?.post || created.body?.post || created.body?.data || created.body;
      const postId = createdPost?.localId ?? createdPost?.id;
      if (!postId) fail('production auth smoke post response did not include an id');

      try {
        const viewed = await fetchAuthed(page, token, `/api/boards/plaza/posts/${encodeURIComponent(postId)}`);
        if (viewed.status !== 200) {
          fail(`/api/boards/plaza/posts/${postId} expected 200 but received ${viewed.status}`);
        }
        results.push({ path: `/api/boards/plaza/posts/${postId}`, status: viewed.status });
      } finally {
        const removed = await fetchAuthed(page, token, `/api/boards/plaza/posts/${encodeURIComponent(postId)}`, {
          method: 'DELETE',
          body: {}
        });
        if (removed.status !== 200) {
          fail(`/api/boards/plaza/posts/${postId} cleanup expected 200 but received ${removed.status}`);
        }
        results.push({ path: `/api/boards/plaza/posts/${postId}`, method: 'DELETE', status: removed.status });
      }
    }

    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, writeEnabled, checks: results }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
