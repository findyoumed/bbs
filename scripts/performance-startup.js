/**
 * [LOG_ID: 20260804_1114] Measure startup request volume, screen readiness, and
 * repeat-load cache behavior against the real application runtime.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { createAppRuntime } = require('../src/server/createAppRuntime');

const ASSERT_MODE = process.argv.includes('--assert');
// [LOG_ID: 20260805_1435] Five isolated contexts make the median resilient to
// occasional local filesystem/Chromium startup spikes without hiding regressions.
const COLD_RUNS = 5;
const READY_TIMEOUT_MS = 15000;
const TARGETS = {
  maxApiRequests: 6,
  // [LOG_ID: 20260805_1435] Lock in the reduced optional-feature startup graph
  // while retaining headroom for small maintenance changes.
  maxColdTransferBytes: Math.floor(1.7 * 1024 * 1024),
  maxScriptRequests: 60,
  maxStaticModuleCount: 59,
  maxStaticSourceBytes: 550 * 1024,
  maxMedianReadyMs: 200,
  requireRepeatStatic304: true,
  requiredFontPaths: [
    '/fonts/Sam3KRFont.woff2',
    '/fonts/DungGeunMo.woff2'
  ],
  deferredInitialModules: [
    'core/ansiServiceBuilders.js',
    'core/amusementScreens.js',
    'core/amusementAnsiBuilders.js',
    'core/arcadeScreens.js',
    'core/arcadeAnsiBuilders.js',
    'core/arcadeGameLogic.js',
    'core/voteScreens.js',
    'core/voteAnsiBuilders.js',
    'core/confScreens.js',
    'core/confAnsiBuilders.js',
    'core/weatherAnsiBuilders.js',
    'core/newsAnsiBuilders.js',
    'core/chatAnsiBuilders.js',
    'core/memoAnsiBuilders.js',
    'core/systemAnsiBuilders.js',
    'core/signupPolicyText.js',
    'core/routingStateRestorer.js',
    'core/commandRouterEntry.js',
    'core/commandRouterVote.js',
    'core/commandRouterConf.js',
    'core/memberSearchScreens.js',
    'core/menuIndexScreens.js',
    'core/contactSysopScreen.js'
  ]
};

// [LOG_ID: 20260804_1305] Browser timing is noisy, so also guard the concrete
// static dependency graph that produced the startup improvement.
function measureStaticModuleGraph(rootDir) {
  const jsRoot = path.join(rootDir, 'public', 'js');
  const entryPath = path.join(jsRoot, 'app.js');
  const visited = new Set();

  function visit(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (visited.has(resolvedPath) || !fs.existsSync(resolvedPath)) return;
    visited.add(resolvedPath);

    const source = fs.readFileSync(resolvedPath, 'utf8');
    const importPattern = /^\s*import(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;
    let match;
    while ((match = importPattern.exec(source)) !== null) {
      if (!match[1].startsWith('.')) continue;
      let dependencyPath = path.resolve(path.dirname(resolvedPath), match[1]);
      if (!path.extname(dependencyPath)) dependencyPath += '.js';
      visit(dependencyPath);
    }
  }

  visit(entryPath);
  const modules = Array.from(visited, (filePath) =>
    path.relative(jsRoot, filePath).split(path.sep).join('/')
  ).sort();
  const deferredModulesInInitialGraph = TARGETS.deferredInitialModules.filter((modulePath) =>
    modules.includes(modulePath)
  );

  return {
    deferredModulesInInitialGraph,
    moduleCount: modules.length,
    sourceBytes: Array.from(visited).reduce(
      (total, filePath) => total + fs.statSync(filePath).size,
      0
    )
  };
}

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
    // [LOG_ID: 20260805_1435] Keep the slowest startup resources in failure
    // evidence so timing regressions can be attributed instead of guessed.
    const slowResources = resources
      .map((entry) => ({
        durationMs: Math.round(entry.duration),
        path: `${new URL(entry.name).pathname}${new URL(entry.name).search}`,
        startMs: Math.round(entry.startTime)
      }))
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 8);
    return {
      decodedBytes: resources.reduce((total, entry) => total + Number(entry.decodedBodySize || 0), 0),
      readyMs: Math.round(probe.readyAt - probe.startedAt),
      slowResources,
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
  const fontPaths = responses
    .filter((entry) => entry.resourceType === 'font')
    .map((entry) => entry.path);

  await page.close();
  return {
    ...browserMetrics,
    apiPaths,
    duplicateApis: Object.fromEntries(duplicateApis),
    fontPaths,
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
  if (cold.transferBytes > TARGETS.maxColdTransferBytes) {
    failures.push(`cold transfer bytes ${cold.transferBytes} exceed ${TARGETS.maxColdTransferBytes}`);
  }
  if (cold.scriptRequests > TARGETS.maxScriptRequests) {
    failures.push(`script requests ${cold.scriptRequests} exceed ${TARGETS.maxScriptRequests}`);
  }
  if (summary.medianReadyMs > TARGETS.maxMedianReadyMs) {
    failures.push(`median ready time ${summary.medianReadyMs}ms exceeds ${TARGETS.maxMedianReadyMs}ms`);
  }
  if (summary.staticModuleGraph.moduleCount > TARGETS.maxStaticModuleCount) {
    failures.push(`static modules ${summary.staticModuleGraph.moduleCount} exceed ${TARGETS.maxStaticModuleCount}`);
  }
  if (summary.staticModuleGraph.sourceBytes > TARGETS.maxStaticSourceBytes) {
    failures.push(`static source bytes ${summary.staticModuleGraph.sourceBytes} exceed ${TARGETS.maxStaticSourceBytes}`);
  }
  if (summary.staticModuleGraph.deferredModulesInInitialGraph.length > 0) {
    failures.push(`deferred modules entered the initial graph: ${summary.staticModuleGraph.deferredModulesInInitialGraph.join(', ')}`);
  }
  if (TARGETS.requireRepeatStatic304 && summary.conditionalStatic.status !== 304) {
    failures.push(`conditional static request returned ${summary.conditionalStatic.status}, expected 304`);
  }
  if (Object.keys(cold.duplicateApis).length > 0) {
    failures.push(`duplicate APIs remain: ${Object.keys(cold.duplicateApis).join(', ')}`);
  }
  const missingFontPaths = TARGETS.requiredFontPaths.filter((fontPath) =>
    !cold.fontPaths.includes(fontPath)
  );
  if (missingFontPaths.length > 0) {
    failures.push(`required WOFF2 fonts were not loaded: ${missingFontPaths.join(', ')}`);
  }
  const legacyFontPaths = cold.fontPaths.filter((fontPath) => fontPath.endsWith('.woff'));
  if (legacyFontPaths.length > 0) {
    failures.push(`legacy WOFF fonts loaded in modern Chromium: ${legacyFontPaths.join(', ')}`);
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
      staticModuleGraph: measureStaticModuleGraph(rootDir),
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
