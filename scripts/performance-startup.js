/**
 * [LOG_ID: 20260804_1114] Measure startup request volume, screen readiness, and
 * repeat-load cache behavior against the real application runtime.
 */
'use strict';

const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { createAppRuntime } = require('../src/server/createAppRuntime');

const ASSERT_MODE = process.argv.includes('--assert');
const COLD_RUNS = 3;
const READY_TIMEOUT_MS = 15000;
const TARGETS = {
  maxApiRequests: 6,
  maxScriptRequests: 93,
  maxMedianReadyMs: 142,
  requireRepeatStatic304: true
};

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function createMeasurementEnv() {
  return {
    ...process.env,
    BOARD_REPOSITORY_DRIVER: 'memory',
    CHAT_ROOM_REPOSITORY_DRIVER: 'memory',
    ACTIVITY_REPOSITORY_DRIVER: 'memory',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_ANON_KEY: ''
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address());
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function installReadyProbe(page) {
  await page.addInitScript(() => {
    const startedAt = performance.now();
    const state = {
      startedAt,
      readyAt: 0
    };
    window.__bbsPerformanceProbe = state;

    const inspect = () => {
      if (state.readyAt) return;
      const terminal = document.querySelector('#terminal-container');
      const screen = document.querySelector('#terminal-screen');
      const footer = document.querySelector('#terminal-footer');
      const hasScreen = Boolean(screen?.textContent?.trim().length > 100);
      const footerVisible = footer?.getAttribute('aria-hidden') === 'false';
      if (terminal && !terminal.classList.contains('is-loading') && hasScreen && footerVisible) {
        state.readyAt = performance.now();
      }
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    window.addEventListener('load', inspect);
  });
}

async function measurePage(context, baseUrl, label) {
  const page = await context.newPage();
  const responses = [];

  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== baseUrl) return;
    responses.push({
      cacheControl: response.headers()['cache-control'] || '',
      path: `${url.pathname}${url.search}`,
      resourceType: response.request().resourceType(),
      status: response.status()
    });
  });

  await installReadyProbe(page);
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(
    () => Number(window.__bbsPerformanceProbe?.readyAt || 0) > 0,
    null,
    { timeout: READY_TIMEOUT_MS }
  );
  await page.waitForTimeout(100);

  const browserMetrics = await page.evaluate(() => {
    const probe = window.__bbsPerformanceProbe;
    const resources = performance.getEntriesByType('resource');
    return {
      decodedBytes: resources.reduce((total, entry) => total + Number(entry.decodedBodySize || 0), 0),
      readyMs: Math.round(probe.readyAt - probe.startedAt),
      transferBytes: resources.reduce((total, entry) => total + Number(entry.transferSize || 0), 0)
    };
  });

  const apiPaths = responses
    .filter((entry) => entry.path.startsWith('/api/'))
    .map((entry) => entry.path);
  const duplicateApis = Object.entries(apiPaths.reduce((counts, apiPath) => {
    counts[apiPath] = (counts[apiPath] || 0) + 1;
    return counts;
  }, {})).filter(([, count]) => count > 1);
  const staticResponses = responses.filter((entry) =>
    entry.resourceType === 'script' || entry.resourceType === 'stylesheet'
  );

  await page.close();
  return {
    ...browserMetrics,
    apiPaths,
    duplicateApis: Object.fromEntries(duplicateApis),
    label,
    requestCount: responses.length,
    scriptRequests: responses.filter((entry) => entry.resourceType === 'script').length,
    static304: staticResponses.filter((entry) => entry.status === 304).length,
    static200: staticResponses.filter((entry) => entry.status === 200).length,
    stylesheetRequests: responses.filter((entry) => entry.resourceType === 'stylesheet').length
  };
}

function assertTargets(summary) {
  const failures = [];
  const cold = summary.coldRuns[0];
  if (cold.apiPaths.length > TARGETS.maxApiRequests) {
    failures.push(`API requests ${cold.apiPaths.length} exceed ${TARGETS.maxApiRequests}`);
  }
  if (cold.scriptRequests > TARGETS.maxScriptRequests) {
    failures.push(`script requests ${cold.scriptRequests} exceed ${TARGETS.maxScriptRequests}`);
  }
  if (summary.medianReadyMs > TARGETS.maxMedianReadyMs) {
    failures.push(`median ready time ${summary.medianReadyMs}ms exceeds ${TARGETS.maxMedianReadyMs}ms`);
  }
  if (TARGETS.requireRepeatStatic304 && summary.conditionalStatic.status !== 304) {
    failures.push(`conditional static request returned ${summary.conditionalStatic.status}, expected 304`);
  }
  if (Object.keys(cold.duplicateApis).length > 0) {
    failures.push(`duplicate APIs remain: ${Object.keys(cold.duplicateApis).join(', ')}`);
  }
  if (failures.length) {
    const error = new Error(`Startup performance targets failed:\n- ${failures.join('\n- ')}`);
    error.failures = failures;
    throw error;
  }
}

async function measureConditionalStatic(baseUrl) {
  const initial = await fetch(`${baseUrl}/js/app.js`);
  const etag = initial.headers.get('etag') || '';
  await initial.arrayBuffer();
  const conditional = await fetch(`${baseUrl}/js/app.js`, {
    headers: { 'If-None-Match': etag }
  });
  await conditional.arrayBuffer();
  return {
    etag,
    status: conditional.status
  };
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const app = createAppRuntime({
    rootDir,
    env: createMeasurementEnv(),
    loadEnvFile: false
  });
  const server = http.createServer(app.requestHandler);
  let browser;

  try {
    const address = await listen(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });

    const coldRuns = [];
    for (let index = 0; index < COLD_RUNS; index += 1) {
      const context = await browser.newContext();
      coldRuns.push(await measurePage(context, baseUrl, `cold-${index + 1}`));
      await context.close();
    }

    const repeatContext = await browser.newContext();
    await measurePage(repeatContext, baseUrl, 'repeat-prime');
    const repeatLoad = await measurePage(repeatContext, baseUrl, 'repeat-load');
    await repeatContext.close();

    const summary = {
      coldRuns,
      conditionalStatic: await measureConditionalStatic(baseUrl),
      medianReadyMs: median(coldRuns.map((entry) => entry.readyMs)),
      repeatLoad,
      targets: TARGETS
    };

    console.log(JSON.stringify(summary, null, 2));
    if (ASSERT_MODE) {
      assertTargets(summary);
      console.log(JSON.stringify({ ok: true, message: 'Startup performance targets passed' }));
    }
  } finally {
    if (browser) await browser.close();
    await app.shutdown();
    if (server.listening) await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
