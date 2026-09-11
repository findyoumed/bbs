/**
 * Read-only startup performance smoke against the deployed Production UI.
 *
 * This complements the local performance-startup check with real CDN/Vercel
 * timings. It never logs in or mutates application data.
 */
'use strict';

import { chromium } from 'playwright';

const BASE_URL = String(process.env.PRODUCTION_BASE_URL || 'https://01410.vercel.app').replace(/\/$/, '');
const TIMEOUT = 30000;
const READY_TIMEOUT = 15000;
const TARGETS = {
  maxResponseStartMs: 10000,
  maxDomContentLoadedMs: 12000,
  maxLoadEventMs: 15000,
  maxFcpMs: 12000,
  maxLcpMs: 15000,
  maxBootstrapMs: 10000,
  maxApiRequests: 3,
  maxTransferBytes: 4 * 1024 * 1024
};
const VIEWPORTS = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 1366, height: 768, label: 'desktop' }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspectViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'request failed';
    failedRequests.push(`${request.method()} ${request.url()} (${failure})`);
  });

  await page.addInitScript(() => {
    window.__bbsPerf = { lcp: 0 };
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) window.__bbsPerf.lcp = latest.startTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP is not available in every headless/browser configuration.
    }
  });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForSelector('#terminal-screen', { timeout: READY_TIMEOUT });
    await page.waitForFunction(() => {
      const screen = document.querySelector('#terminal-screen .ansi-screen');
      return Boolean(screen && (screen.textContent || '').trim().length > 100);
    }, null, { timeout: READY_TIMEOUT });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(100);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime])
      );
      const resources = performance.getEntriesByType('resource');
      const apiResources = resources.filter((entry) => new URL(entry.name).pathname.startsWith('/api/'));
      const bootstrap = apiResources.find((entry) => new URL(entry.name).pathname === '/api/bootstrap');
      const root = document.documentElement;
      return {
        apiPaths: apiResources.map((entry) => `${new URL(entry.name).pathname}${new URL(entry.name).search}`),
        bootstrapMs: bootstrap ? Math.round(bootstrap.duration) : 0,
        domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
        fontsReady: document.fonts?.status === 'loaded',
        fcpMs: Math.round(paints['first-contentful-paint'] || 0),
        lcpMs: Math.round(window.__bbsPerf?.lcp || 0),
        loadEventMs: Math.round(navigation?.loadEventEnd || 0),
        responseStartMs: Math.round(navigation?.responseStart || 0),
        rootWidth: root.clientWidth,
        rootScrollWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
        transferBytes: resources.reduce((total, entry) => total + Number(entry.transferSize || 0), 0)
      };
    });

    const failures = [];
    if (!metrics.fontsReady) failures.push('fonts were not ready');
    if (metrics.responseStartMs > TARGETS.maxResponseStartMs) failures.push(`responseStart ${metrics.responseStartMs}ms > ${TARGETS.maxResponseStartMs}ms`);
    if (metrics.domContentLoadedMs > TARGETS.maxDomContentLoadedMs) failures.push(`DOMContentLoaded ${metrics.domContentLoadedMs}ms > ${TARGETS.maxDomContentLoadedMs}ms`);
    if (metrics.loadEventMs > TARGETS.maxLoadEventMs) failures.push(`load ${metrics.loadEventMs}ms > ${TARGETS.maxLoadEventMs}ms`);
    if (metrics.fcpMs > TARGETS.maxFcpMs) failures.push(`FCP ${metrics.fcpMs}ms > ${TARGETS.maxFcpMs}ms`);
    if (metrics.lcpMs > TARGETS.maxLcpMs) failures.push(`LCP ${metrics.lcpMs}ms > ${TARGETS.maxLcpMs}ms`);
    if (metrics.bootstrapMs > TARGETS.maxBootstrapMs) failures.push(`bootstrap ${metrics.bootstrapMs}ms > ${TARGETS.maxBootstrapMs}ms`);
    if (metrics.apiPaths.length > TARGETS.maxApiRequests) failures.push(`API requests ${metrics.apiPaths.length} > ${TARGETS.maxApiRequests}`);
    if (metrics.transferBytes > TARGETS.maxTransferBytes) failures.push(`transfer ${metrics.transferBytes} > ${TARGETS.maxTransferBytes}`);
    if (metrics.rootScrollWidth > metrics.rootWidth + 1) failures.push('document overflow detected');
    if (pageErrors.length) failures.push(`page errors: ${pageErrors.join(' | ')}`);
    if (failedRequests.length) failures.push(`failed requests: ${failedRequests.join(' | ')}`);

    assert(failures.length === 0, `${viewport.label} Production performance targets failed: ${failures.join('; ')}`);
    return { ...metrics, label: viewport.label };
  } finally {
    await context.close();
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const viewport of VIEWPORTS) {
      const result = await inspectViewport(browser, viewport);
      results.push(result);
      console.log(`  ✓ ${viewport.label} Production startup ${result.fcpMs || 'n/a'}ms FCP, ${result.lcpMs || 'n/a'}ms LCP`);
    }
    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, targets: TARGETS, results }, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
