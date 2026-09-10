/**
 * Read-only browser smoke against the deployed Production UI.
 *
 * This intentionally checks geometry instead of screenshot pixels: the
 * terminal uses responsive font metrics, while the user-visible contract is
 * that the screen/body/footer rails stay aligned and never create overflow.
 */
'use strict';

import { chromium } from 'playwright';

const BASE_URL = String(process.env.PRODUCTION_BASE_URL || 'https://01410.vercel.app').replace(/\/$/, '');
const TIMEOUT = 30000;
const ROUTES = ['/', '/board/plaza', '/help', '/memo', '/guide/tosysop'];
const VIEWPORTS = [
  { width: 390, height: 844, label: 'iPhone 14' },
  { width: 568, height: 320, label: 'compact landscape' },
  { width: 1366, height: 768, label: 'desktop' },
  { width: 1920, height: 1080, label: 'large desktop' }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspectRoute(page, viewport, pathname) {
  await page.goto(`${BASE_URL}${pathname}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForSelector('#terminal-screen', { timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const screen = document.querySelector('#terminal-screen .ansi-screen');
    return Boolean(screen && (screen.textContent || '').trim().length > 0);
  }, null, { timeout: TIMEOUT });
  await page.waitForTimeout(100);

  const result = await page.evaluate(async () => {
    const rect = (selector, visibleOnly = false) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const value = element.getBoundingClientRect();
      if (visibleOnly && (value.width <= 0 || value.height <= 0)) return null;
      return { left: value.left, right: value.right, width: value.width };
    };
    const screen = document.querySelector('#terminal-screen .ansi-screen');
    const body = document.querySelector('#terminal-screen .ansi-screen-body');
    const footer = document.querySelector('#terminal-footer');
    const root = document.documentElement;
    const documentBody = document.body;
    await document.fonts?.ready;
    return {
      screen: rect('#terminal-screen .ansi-screen'),
      body: rect('#terminal-screen .ansi-screen-body'),
      hr: rect('#terminal-screen .retro-topbar-hr'),
      footer: rect('#terminal-footer', true),
      screenClientWidth: screen?.clientWidth ?? 0,
      screenScrollWidth: screen?.scrollWidth ?? 0,
      bodyClientWidth: body?.clientWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
      footerClientWidth: footer?.clientWidth ?? 0,
      footerScrollWidth: footer?.scrollWidth ?? 0,
      dividerWidth: footer
        ? Number.parseFloat(getComputedStyle(footer, '::before').width) || 0
        : 0,
      rootWidth: root.clientWidth,
      rootScrollWidth: Math.max(root.scrollWidth, documentBody.scrollWidth),
      fontsReady: document.fonts?.status === 'loaded',
      sam3Loaded: document.fonts?.check('17px "Sam3KRFont"') ?? false,
      dungLoaded: document.fonts?.check('17px "DungGeunMo"') ?? false
    };
  });

  assert(result.fontsReady && result.sam3Loaded && result.dungLoaded,
    `${viewport.label} ${pathname} fonts not ready: ${JSON.stringify(result)}`);
  assert(result.rootScrollWidth <= result.rootWidth + 1,
    `${viewport.label} ${pathname} document overflow: ${JSON.stringify(result)}`);
  assert(result.screen && result.body,
    `${viewport.label} ${pathname} screen/body rail missing: ${JSON.stringify(result)}`);
  assert(result.screenScrollWidth <= result.screenClientWidth + 1 &&
    result.bodyScrollWidth <= result.bodyClientWidth + 1,
    `${viewport.label} ${pathname} screen/body overflow: ${JSON.stringify(result)}`);
  if (viewport.width >= viewport.height) {
    assert(Math.abs(result.screen.left - result.body.left) <= 1 &&
      Math.abs(result.screen.right - result.body.right) <= 1,
      `${viewport.label} ${pathname} body rail diverged: ${JSON.stringify(result)}`);
  }

  if (result.hr) {
    assert(result.hr.left >= result.screen.left - 1 &&
      result.hr.right <= result.screen.right + 1 &&
      Math.abs((result.hr.left + result.hr.right) - (result.screen.left + result.screen.right)) <= 2,
      `${viewport.label} ${pathname} horizontal rule rail diverged: ${JSON.stringify(result)}`);
  }

  if (result.footer) {
    assert(result.footerScrollWidth <= result.footerClientWidth + 1,
      `${viewport.label} ${pathname} footer overflow: ${JSON.stringify(result)}`);
    if (viewport.width < viewport.height) {
      assert(result.dividerWidth <= result.body.width + 1,
        `${viewport.label} ${pathname} footer divider exceeded body rail: ${JSON.stringify(result)}`);
    } else {
      assert(Math.abs(result.screen.left - result.footer.left) <= 1 &&
        Math.abs(result.screen.right - result.footer.right) <= 1,
        `${viewport.label} ${pathname} footer rail diverged: ${JSON.stringify(result)}`);
    }
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.width < 600,
        hasTouch: viewport.width < 600
      });
      const page = await context.newPage();
      page.setDefaultTimeout(TIMEOUT);
      page.setDefaultNavigationTimeout(TIMEOUT);
      try {
        for (const pathname of ROUTES) {
          await inspectRoute(page, viewport, pathname);
          console.log(`  ✓ ${viewport.label} ${pathname}`);
        }
      } finally {
        await context.close();
      }
    }
    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, routes: ROUTES.length, viewports: VIEWPORTS.length }));
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
