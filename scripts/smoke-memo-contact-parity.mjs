/**
 * Browser action-parity smoke for memo and sysop-contact flows.
 *
 * The API calls are intercepted so this check validates the UI contract
 * without mutating a real mailbox or requiring Supabase/Resend credentials.
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

const AUTH_USER = {
  userId: 'memo-parity-user',
  nickName: 'PARITY',
  email: 'parity@example.com',
  level: 1,
  isAdmin: false,
  isGuest: false
};

async function installApiStubs(page, calls) {
  await page.route('**/api/memos**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      calls.memo.push(payload);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'memo-parity-1', sentCount: 1, recipients: [payload.recipientUserId] })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/contact-sysop', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    calls.contact.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, emailSent: false, memoSaved: true })
    });
  });
  await page.route('**/api/memos/unread/count**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
  });
}

async function openGuest(page, pathname) {
  await page.goto(`${config.BASE_URL}${pathname}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  return page.evaluate(() => ({
    screen: window.__debugState?.screen || document.querySelector('#terminal-container')?.dataset.screen || '',
    hasMemoEditor: Boolean(document.querySelector('#memo-ed-target')),
    hasContactEditor: Boolean(document.querySelector('#tosysop-ed-subject')),
    text: document.body.innerText || ''
  }));
}

async function openAuthenticated(page, pathname) {
  await page.goto(`${config.BASE_URL}/`, { waitUntil: 'networkidle' });
  const errors = [];
  assert(await ensureTerminalReady(page, '/', errors), errors.join('; ') || 'terminal did not become ready');
  await page.evaluate(({ user, pathname }) => {
    window.__debugState.user = user;
    window.history.pushState({ screen: pathname }, '', pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { user: AUTH_USER, pathname });
  await page.waitForTimeout(250);
}

async function verifyGuestBoundaries(page) {
  for (const pathname of ['/memo', '/memo/write', '/guide/tosysop']) {
    const state = await openGuest(page, pathname);
    assert(!state.hasMemoEditor && !state.hasContactEditor,
      `guest ${pathname} unexpectedly rendered an editor: ${JSON.stringify(state)}`);
    assert(/로그인|회원/.test(state.text),
      `guest ${pathname} should show a login 안내 message: ${JSON.stringify(state)}`);
  }
}

async function verifyMemoEditor(page, calls) {
  await openAuthenticated(page, '/memo/write');
  await page.waitForSelector('#memo-ed-target');
  const initialMemoStages = await page.evaluate(() => ({
    subject: getComputedStyle(document.getElementById('memo-ed-subject-row')).display,
    body: getComputedStyle(document.getElementById('memo-ed-body-row')).display
  }));
  assert(initialMemoStages.subject === 'none' && initialMemoStages.body === 'none',
    `memo editor should start in recipient-only stage: ${JSON.stringify(initialMemoStages)}`);
  await page.fill('#memo-ed-target', 'sysop');
  await page.locator('#memo-ed-target').press('Enter');
  assert(await page.evaluate(() => document.activeElement?.id) === 'memo-ed-subject', 'memo target Enter should focus subject');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('memo-ed-subject-row')).display) === 'flex',
    'memo target Enter should reveal subject stage');
  await page.fill('#memo-ed-subject', 'Parity subject');
  await page.locator('#memo-ed-subject').press('Enter');
  assert(await page.evaluate(() => document.activeElement?.id) === 'memo-ed-body', 'memo subject Enter should focus body');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('memo-ed-body-row')).display) === 'flex',
    'memo subject Enter should reveal body stage');
  await page.fill('#memo-ed-body', 'Parity body');
  await page.locator('#memo-ed-body').press('Tab');
  assert(await page.evaluate(() => document.activeElement?.id) === 'cmd-input', 'memo body Tab should focus command input');

  const hintBefore = await page.locator('#cmd-hint').innerText();
  await page.fill('#memo-ed-body', '');
  await page.locator('#memo-ed-body').press('Control+s');
  await page.waitForSelector('.memo-ed-validation');
  assert((await page.locator('#cmd-hint').innerText()) === hintBefore, 'memo validation must not overwrite the hint bar');
  assert(await page.evaluate(() => document.activeElement?.id) === 'memo-ed-body', 'memo empty body should refocus body');

  await page.fill('#memo-ed-body', 'Parity body');
  await page.locator('#memo-ed-body').press('Control+s');
  await page.waitForFunction(() => window.__debugState?._memoWriteFlow?.stage === 'letter_type');
  await page.fill('#cmd-input', '1');
  await page.locator('#cmd-input').press('Enter');
  await page.waitForFunction(() => window.__debugState?._memoWriteFlow?.stage === 'send_cmd');
  await page.fill('#cmd-input', '1');
  await page.locator('#cmd-input').press('Enter');
  await page.waitForTimeout(200);
  assert(calls.memo.length === 1, `memo send should issue one POST, got ${calls.memo.length}`);
  assert(calls.memo[0].recipientUserId === 'sysop' && calls.memo[0].content === 'Parity body',
    `memo POST payload mismatch: ${JSON.stringify(calls.memo[0])}`);
}

async function verifyContactEditor(page, calls) {
  await openAuthenticated(page, '/guide/tosysop');
  await page.waitForSelector('#tosysop-ed-target');
  assert(await page.inputValue('#tosysop-ed-target') === 'sysop', 'sysop recipient must stay fixed');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('tosysop-ed-body-row')).display) === 'none',
    'sysop contact should start before the body stage');
  await page.locator('#tosysop-ed-target').click();
  assert(await page.evaluate(() => document.activeElement?.id) === 'tosysop-ed-subject', 'target click should focus subject');
  await page.fill('#tosysop-ed-subject', 'Contact parity');
  await page.locator('#tosysop-ed-subject').press('Enter');
  assert(await page.evaluate(() => document.activeElement?.id) === 'tosysop-ed-body', 'contact subject Enter should focus body');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('tosysop-ed-body-row')).display) === 'flex',
    'contact subject Enter should reveal body stage');
  await page.fill('#tosysop-ed-body', 'Contact body');
  const hint = page.locator('#cmd-hint');
  await hint.waitFor();
  const sendToken = hint.locator('[data-cmd="SEND"]');
  assert(await sendToken.count() > 0, 'contact hint should expose clickable SEND action');
  await sendToken.first().press('Enter');
  await page.waitForTimeout(200);
  assert(calls.contact.length === 1, `contact send should issue one POST, got ${calls.contact.length}`);
  assert(calls.contact[0].subject === 'Contact parity' && calls.contact[0].content === 'Contact body',
    `contact POST payload mismatch: ${JSON.stringify(calls.contact[0])}`);
}

async function verifyMobileEditorGeometry(browser) {
  // The general mobile traversal covers guest shells, while these protected
  // editors only exist after authentication. Check their real DOM geometry at
  // the two narrowest supported portrait widths so staged rows cannot push a
  // field or the shared hint rail outside the viewport.
  for (const viewport of [
    { width: 320, height: 568, label: 'iPhone SE' },
    { width: 390, height: 844, label: 'iPhone 14' }
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    try {
      await installApiStubs(page, { memo: [], contact: [] });
      for (const pathname of ['/memo/write', '/guide/tosysop']) {
        await openAuthenticated(page, pathname);
        await page.waitForSelector(pathname === '/memo/write' ? '#memo-ed-target' : '#tosysop-ed-target');
        const geometry = await page.evaluate(() => {
          const body = document.body;
          const root = document.documentElement;
          const visibleText = [...document.querySelectorAll(
            '.ansi-screen-body, #terminal-footer, #cmd-hint, #terminal-prompt-row'
          )]
            .filter((el) => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0;
            })
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return { id: el.id, left: rect.left, right: rect.right };
            });
          return {
            viewport: window.innerWidth,
            scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
            contentWidth: root.clientWidth,
            footer: (() => {
              const el = document.querySelector('#terminal-footer');
              return el ? { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth } : null;
            })(),
            visibleText
          };
        });
        assert(geometry.scrollWidth <= geometry.contentWidth + 1,
          `${viewport.label} ${pathname} overflowed horizontally: ${JSON.stringify(geometry)}`);
        assert(geometry.footer && geometry.footer.scrollWidth <= geometry.footer.clientWidth + 1,
          `${viewport.label} ${pathname} footer overflowed horizontally: ${JSON.stringify(geometry.footer)}`);
        const outside = geometry.visibleText.filter((item) =>
          item.left < -1.5 || item.right > geometry.viewport + 1.5
        );
        assert(outside.length === 0,
          `${viewport.label} ${pathname} content rail escaped viewport: ${JSON.stringify(outside)}`);
      }
    } finally {
      await context.close();
    }
  }
}

async function verifyDesktopEditorGeometry(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  try {
    await installApiStubs(page, { memo: [], contact: [] });
    for (const pathname of ['/memo/write', '/guide/tosysop']) {
      await openAuthenticated(page, pathname);
      await page.waitForSelector(pathname === '/memo/write' ? '#memo-ed-target' : '#tosysop-ed-target');
      const geometry = await page.evaluate(() => {
        const screen = document.querySelector('#terminal-screen .ansi-screen');
        const body = document.querySelector('#terminal-screen .ansi-screen-body');
        const footer = document.querySelector('#terminal-footer');
        const rect = (el) => {
          if (!el) return null;
          const value = el.getBoundingClientRect();
          return { left: value.left, right: value.right, width: value.width };
        };
        return { screen: rect(screen), body: rect(body), footer: rect(footer) };
      });
      assert(geometry.screen && geometry.body,
        `desktop ${pathname} editor geometry missing: ${JSON.stringify(geometry)}`);
      assert(Math.abs(geometry.screen.width - geometry.body.width) <= 1,
        `desktop ${pathname} body width diverged from screen rail: ${JSON.stringify(geometry)}`);
      assert(Math.abs(geometry.screen.left - geometry.body.left) <= 1 &&
        Math.abs(geometry.screen.right - geometry.body.right) <= 1,
        `desktop ${pathname} body edges diverged from screen rail: ${JSON.stringify(geometry)}`);
    }
  } finally {
    await context.close();
  }
}

async function verifyLargeDesktopRail(browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  try {
    for (const pathname of ['/board/plaza', '/help']) {
      await page.goto(`${config.BASE_URL}${pathname}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#terminal-screen .ansi-screen');
      const geometry = await page.evaluate(() => {
        const screen = document.querySelector('#terminal-screen .ansi-screen');
        const body = document.querySelector('#terminal-screen .ansi-screen-body');
        const rect = (el) => {
          if (!el) return null;
          const value = el.getBoundingClientRect();
          return { left: value.left, right: value.right, width: value.width };
        };
        return {
          screen: rect(screen),
          body: rect(body),
          screenClientWidth: screen?.clientWidth ?? 0,
          screenScrollWidth: screen?.scrollWidth ?? 0,
          bodyClientWidth: body?.clientWidth ?? 0,
          bodyScrollWidth: body?.scrollWidth ?? 0
        };
      });
      assert(geometry.screen && geometry.body,
        `large desktop ${pathname} rail missing: ${JSON.stringify(geometry)}`);
      assert(geometry.screenScrollWidth <= geometry.screenClientWidth + 1 &&
        geometry.bodyScrollWidth <= geometry.bodyClientWidth + 1,
        `large desktop ${pathname} rail overflowed: ${JSON.stringify(geometry)}`);
      assert(Math.abs(geometry.screen.width - geometry.body.width) <= 1,
        `large desktop ${pathname} body width diverged: ${JSON.stringify(geometry)}`);
    }
  } finally {
    await context.close();
  }
}

async function verifyCompactLandscapeRail(browser) {
  for (const viewport of [
    { width: 568, height: 320, label: 'compact landscape' },
    { width: 844, height: 390, label: 'phone landscape' }
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    try {
      await page.goto(`${config.BASE_URL}/board/plaza`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#terminal-screen .ansi-screen');
      const geometry = await page.evaluate(() => {
        const selectors = ['#terminal-screen .ansi-screen', '#terminal-screen .ansi-screen-body', '#terminal-footer'];
        const rect = (selector) => {
          const value = document.querySelector(selector)?.getBoundingClientRect();
          return value ? { left: value.left, right: value.right, width: value.width } : null;
        };
        return Object.fromEntries(selectors.map((selector) => [selector, rect(selector)]));
      });
      const screen = geometry['#terminal-screen .ansi-screen'];
      const body = geometry['#terminal-screen .ansi-screen-body'];
      const footer = geometry['#terminal-footer'];
      assert(screen && body && footer,
        `${viewport.label} shared rail missing: ${JSON.stringify(geometry)}`);
      for (const [name, rail] of [['body', body], ['footer', footer]]) {
        assert(Math.abs(screen.width - rail.width) <= 1 &&
          Math.abs(screen.left - rail.left) <= 1 &&
          Math.abs(screen.right - rail.right) <= 1,
          `${viewport.label} ${name} rail diverged: ${JSON.stringify(geometry)}`);
      }
    } finally {
      await context.close();
    }
  }
}

async function verifyToastAndMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    const errors = [];
    await page.goto(`${config.BASE_URL}/`, { waitUntil: 'networkidle' });
    assert(await ensureTerminalReady(page, '/', errors), errors.join('; ') || 'mobile terminal did not become ready');
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    }));
    assert(geometry.scrollWidth <= geometry.width + 1, `mobile shell overflows horizontally: ${JSON.stringify(geometry)}`);
    const toastContract = await page.evaluate(async () => {
      const { createTerminalFeedback } = await import('/js/core/terminalFeedback.js');
      const source = document.querySelector('#terminal-notification');
      if (!source) return { missing: true };
      let activations = 0;
      const feedback = createTerminalFeedback({
        screenEl: document.querySelector('#terminal-screen'),
        hintEl: document.querySelector('#cmd-hint'),
        cmdPromptEl: document.querySelector('#cmd-prompt'),
        cmdInput: document.querySelector('#cmd-input'),
        soundService: { playError() {} },
        setFooterVisibility() {}
      });
      feedback.showNotification('새 쪽지가 있습니다: 1통', 5000, 'info', {
        title: '받은 쪽지함 열기',
        onClick: () => { activations += 1; }
      });
      const contract = {
        role: source.getAttribute('role'),
        tabindex: source.getAttribute('tabindex'),
        visible: getComputedStyle(source).display !== 'none' && getComputedStyle(source).visibility !== 'hidden'
      };
      source.click();
      const clickActivations = activations;
      source.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return { ...contract, clickActivations, keyActivations: activations - clickActivations };
    });
    assert(!toastContract.missing && toastContract.visible && toastContract.role === 'button' && toastContract.tabindex === '0',
      `interactive notification contract invalid: ${JSON.stringify(toastContract)}`);
    assert(toastContract.clickActivations === 1 && toastContract.keyActivations === 1,
      `interactive notification click/Enter parity failed: ${JSON.stringify(toastContract)}`);
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
    const calls = { memo: [], contact: [] };
    await installApiStubs(page, calls);
    try {
      await verifyGuestBoundaries(page);
      await verifyMemoEditor(page, calls);
      await verifyContactEditor(page, calls);
      await verifyMobileEditorGeometry(browser);
      await verifyDesktopEditorGeometry(browser);
      await verifyLargeDesktopRail(browser);
      await verifyCompactLandscapeRail(browser);
      await verifyToastAndMobile(browser);
    } finally {
      await context.close();
    }
    console.log(JSON.stringify({ ok: true, checks: [
      'guest memo/contact login boundary',
      'memo click/Enter/Tab/empty validation/send',
      'fixed sysop contact click/Enter/send',
      'authenticated editor geometry at 320/390px',
      'desktop editor body matches screen rail',
      'large desktop 80-column rail has no internal overflow',
      'compact landscape footer matches 80-column rail',
      'mobile horizontal overflow guard'
    ] }, null, 2));
  } finally {
    if (browser) await browser.close();
    await stopServer(serverHandle);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
