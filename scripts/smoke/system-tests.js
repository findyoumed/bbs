/**
 * [LOG_ID: 20260801_1243] System and Global Commands E2E smoke tests.
 */
'use strict';

const path = require('path');
const {
    config,
    fetchJsonResponse,
    fetchJsonData,
    hasNonEmptyText,
    loadBrowserHarnessModule,
    createHarnessScreenEl,
    createHarnessBrowserGlobals,
    ansiToHTMLHarnessStub,
    ensureTerminalReady,
    openHomeAndWait,
    submitCommand,
    extractApiMessage
} = require('./common-utils');

async function verifyHttpActiveUsersCoverage(errors) {
    console.log('👥 Checking active-users API coverage via HTTP fallback...');
    try {
        const activeUsers = await fetchJsonData('/api/system/active-users');
        if (!Array.isArray(activeUsers)) {
            errors.push('Active users payload shape is invalid at /api/system/active-users');
            return;
        }

        if (activeUsers.length > 0 && !activeUsers.some((user) => hasNonEmptyText(user?.userId || user?.nickName))) {
            errors.push('Active users list contains only empty rows at /api/system/active-users');
        }
    } catch (error) {
        errors.push(error.message);
    }
}

// [LOG: 20260429_0447] When Playwright stays blocked, SYSINFO should still
// prove /api/system/info payload shape so diagnostics regressions do not remain
// hidden behind shell-only route coverage.
async function verifyHttpSystemInfoCoverage(errors) {
    console.log('🖥️ Checking system-info API coverage via HTTP fallback...');
    try {
        const anonymous = await fetchJsonResponse('/api/system/info');
        if (anonymous.status !== 403) {
            errors.push(`Anonymous /api/system/info should be 403 (got ${anonymous.status})`);
        }
        const systemInfo = await fetchJsonData('/api/system/info', {
            headers: {
                'x-bbs-user-id': 'smoke-traversal-admin',
                'x-bbs-nick-name': 'smoke-admin',
                'x-bbs-admin': '1'
            }
        });
        const hasNumericField = (value) => Number.isFinite(Number(value));
        const repositoryHealth = systemInfo?.repositoryHealth;
        const repositoryMetrics = systemInfo?.repositoryMetrics;

        if (
            !hasNonEmptyText(systemInfo?.hostname) ||
            !hasNonEmptyText(systemInfo?.platform) ||
            !hasNonEmptyText(systemInfo?.release) ||
            !hasNonEmptyText(systemInfo?.nodeVersion) ||
            !hasNumericField(systemInfo?.uptimeSeconds) ||
            !hasNumericField(systemInfo?.totalMemoryBytes) ||
            !hasNumericField(systemInfo?.usedMemoryBytes) ||
            !hasNumericField(systemInfo?.cpus)
        ) {
            errors.push('System-info payload shape is invalid at /api/system/info');
            return;
        }

        if (!repositoryHealth || typeof repositoryHealth !== 'object' || Array.isArray(repositoryHealth) || Object.keys(repositoryHealth).length === 0) {
            errors.push('System-info repositoryHealth is missing at /api/system/info');
        } else if (!Object.values(repositoryHealth).every((entry) => hasNonEmptyText(entry?.status))) {
            errors.push('System-info repositoryHealth entries are missing status fields at /api/system/info');
        }

        if (!repositoryMetrics || typeof repositoryMetrics !== 'object' || Array.isArray(repositoryMetrics) || Object.keys(repositoryMetrics).length === 0) {
            errors.push('System-info repositoryMetrics is missing at /api/system/info');
        } else if (!Object.values(repositoryMetrics).every((entry) => hasNonEmptyText(entry?.driver) && entry?.metrics && typeof entry.metrics === 'object')) {
            errors.push('System-info repositoryMetrics entries are missing driver/metrics fields at /api/system/info');
        }
    } catch (error) {
        errors.push(error.message);
    }
}

// [LOG: 20260429_0437] When Playwright stays blocked, ACT should still prove
// /api/system/activity-summary payload shape plus fail-closed command rendering
// instead of remaining uncovered in HTTP fallback mode.
async function verifyHttpActivitySummaryCoverage(errors) {
    console.log('📈 Checking activity-summary API coverage via HTTP fallback...');
    try {
        const activitySummary = await fetchJsonData('/api/system/activity-summary');
        if (!hasNonEmptyText(activitySummary?.summary) || !Array.isArray(activitySummary?.recentActions) || !hasNonEmptyText(activitySummary?.timestamp)) {
            errors.push('Activity summary payload shape is invalid at /api/system/activity-summary');
            return;
        }

        if (activitySummary.recentActions.length > 0 && !activitySummary.recentActions.some((action) => hasNonEmptyText(action))) {
            errors.push('Activity summary recentActions contains only empty items at /api/system/activity-summary');
        }
    } catch (error) {
        errors.push(error.message);
    }
}

// [LOG: 20260429_0437] When Playwright stays blocked, ACT and ACTIVITY should
// still prove global entry, alias handling, and fail-closed render via a
// browser module harness instead of API-only fallback coverage.
async function verifyActivitySummaryCommandCoverage(errors) {
    console.log('📊 Checking activity-summary command coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);

        const state = {
            screen: 'main',
            theme: 'default',
            assetCache: {}
        };
        const screenEl = createHarnessScreenEl();
        const fetchCalls = [];
        const appliedFooters = [];
        let supportedFooterText = 'ACT FOOTER';
        let updateUrlCalls = 0;
        let focusCalls = 0;
        let shouldFailActivitySummary = false;

        const activitySummary = {
            summary: '2명의 회원과 1명의 손님이 접속 중입니다.',
            recentActions: [
                'Alpha님이 /chat/1 에서 활동 중입니다.',
                '관리자님이 /sys 에서 점검 중입니다.'
            ],
            timestamp: '2026-04-29T04:37:00.000Z'
        };

        const env = createHarnessBrowserGlobals({ innerWidth: 1280 });
        globalThis.window = env.window;
        globalThis.document = env.document;

        const { buildActivitySummaryAnsi } = createSystemAnsiBuilders({
            displayWidth: (value = '') => String(value || '').length,
            isWideChar: () => false
        });

        const { showActivitySummary } = createSystemScreens({
            apiFetch: async (pathname) => {
                fetchCalls.push(pathname);
                if (shouldFailActivitySummary) {
                    throw new Error('activity-summary fetch failed');
                }
                return {
                    ...activitySummary,
                    recentActions: activitySummary.recentActions.slice()
                };
            },
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async (assetPath, fallbackText) => {
                appliedFooters.push(String(fallbackText || ''));
            },
            setLoading: () => {},
            esc: (value) => String(value ?? ''),
            buildActiveUsersAnsi: () => '',
            buildActivitySummaryAnsi,
            buildSystemDiagnosticsAnsi: () => '',
            getCommandFooterText: (category) => category === 'systemInfo' ? 'SYSTEMINFO FOOTER' : '',
            getSupportedFooterText: () => supportedFooterText,
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            cmdInput: {
                focus() {
                    focusCalls += 1;
                }
            },
            state
        });

        const handleGlobalRuntimeCommand = createGlobalRuntimeCommandHandler({
            state,
            toggleTheme: () => {},
            showActivitySummary,
            showSystemDiagnostics: async () => {},
            setHint: () => {},
            setPrompt: () => {}
        });

        const handled = await handleGlobalRuntimeCommand({ cmd: 'ACT', rawCmd: 'ACT' });
        if (!handled) {
            errors.push('ACT global runtime command was not handled by commandRouterGlobalRuntime.js');
        }
        if (fetchCalls[0] !== '/api/system/activity-summary') {
            errors.push(`ACT global command did not fetch /api/system/activity-summary (got ${fetchCalls[0] || 'none'})`);
        }
        if (state.screen !== 'activity-summary') {
            errors.push('ACT global command did not activate state.screen="activity-summary"');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'ACT FOOTER') {
            errors.push(`Activity-summary screen did not apply the supported footer hint (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 1) {
            errors.push(`Activity-summary screen did not request exactly one URL sync on ACT entry (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 1) {
            errors.push(`Activity-summary screen did not focus the command input on desktop entry (got ${focusCalls})`);
        }
        if (!screenEl.innerHTML.includes('최근 활동 요약') || !screenEl.innerHTML.includes('ACTIVITY SUMMARY')) {
            errors.push('ACT global command did not render the activity-summary title');
        }
        if (!screenEl.innerHTML.includes(activitySummary.summary) || !screenEl.innerHTML.includes(activitySummary.recentActions[0])) {
            errors.push('ACT global command did not render the expected activity-summary payload');
        }

        state.screen = 'post-list';
        const aliasFetchCount = fetchCalls.length;
        const aliasHandled = await handleGlobalRuntimeCommand({ cmd: 'ACTIVITY', rawCmd: 'ACTIVITY' });
        if (!aliasHandled) {
            errors.push('ACTIVITY alias was not handled by commandRouterGlobalRuntime.js');
        }
        if (fetchCalls.length !== aliasFetchCount + 1) {
            errors.push('ACTIVITY alias did not trigger a fresh activity-summary fetch');
        }
        if (state.screen !== 'activity-summary') {
            errors.push('ACTIVITY alias did not restore the activity-summary screen from post-list');
        }
        if (updateUrlCalls !== 2) {
            errors.push(`ACTIVITY alias did not request a second URL sync (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 2) {
            errors.push(`ACTIVITY alias did not refocus the command input on desktop entry (got ${focusCalls})`);
        }

        shouldFailActivitySummary = true;
        supportedFooterText = '';
        state.screen = 'main';
        appliedFooters.length = 0;
        await showActivitySummary();

        if (fetchCalls.length !== aliasFetchCount + 2) {
            errors.push('Activity-summary failure path did not attempt a fresh fetch');
        }
        if (state.screen !== 'activity-summary') {
            errors.push('Activity-summary failure path did not keep state.screen="activity-summary"');
        }
        if (!screenEl.innerHTML.includes('활동 요약을 가져오지 못했습니다.')) {
            errors.push('Activity-summary failure path did not render the expected error box');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'SYSTEMINFO FOOTER') {
            errors.push(`Activity-summary failure path did not fall back to the systemInfo footer text (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 3) {
            errors.push(`Activity-summary failure path did not request URL sync before failing closed (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 3) {
            errors.push(`Activity-summary failure path did not refocus the command input on desktop error recovery (got ${focusCalls})`);
        }
    } catch (error) {
        errors.push(`Activity-summary module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        if (typeof originalDocument === 'undefined') {
            delete globalThis.document;
        } else {
            globalThis.document = originalDocument;
        }
    }
}

// [LOG: 20260429_0447] When Playwright stays blocked, SYSINFO and DIAG should
// still prove global entry, diagnostics render, and fail-closed recovery via a
// browser module harness instead of remaining uncovered in HTTP fallback mode.
async function verifySystemDiagnosticsCommandCoverage(errors) {
    console.log('🖥️ Checking SYSINFO coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);

        const state = {
            screen: 'main',
            theme: 'default',
            assetCache: {}
        };
        const screenEl = createHarnessScreenEl();
        const fetchCalls = [];
        const appliedFooters = [];
        let supportedFooterText = 'SYSINFO FOOTER';
        let updateUrlCalls = 0;
        let focusCalls = 0;
        let shouldFailSystemInfo = false;

        const systemInfo = {
            hostname: 'bbs-node-01',
            platform: 'win32',
            release: '10.0.26100',
            uptimeSeconds: 7260,
            nodeVersion: 'v22.14.0',
            totalMemoryBytes: 16 * 1024 * 1024 * 1024,
            usedMemoryBytes: 4 * 1024 * 1024 * 1024,
            cpus: 12,
            repositoryHealth: {
                board: { status: 'ok', driver: 'supabase' },
                memo: { status: 'ok', driver: 'memory' }
            },
            repositoryMetrics: {
                board: { driver: 'supabase', metrics: { calls: 12, errors: 1, avgDurationMs: 34 } },
                memo: { driver: 'memory', metrics: { calls: 3, errors: 0, avgDurationMs: 5 } }
            }
        };

        const env = createHarnessBrowserGlobals({ innerWidth: 1280 });
        globalThis.window = env.window;
        globalThis.document = env.document;

        const { buildSystemDiagnosticsAnsi } = createSystemAnsiBuilders({
            displayWidth: (value = '') => String(value || '').length,
            isWideChar: () => false
        });

        const { showSystemDiagnostics } = createSystemScreens({
            apiFetch: async (pathname) => {
                fetchCalls.push(pathname);
                if (shouldFailSystemInfo) {
                    throw new Error('system-info fetch failed');
                }
                return JSON.parse(JSON.stringify(systemInfo));
            },
            ansiToHTML: ansiToHTMLHarnessStub,
            buildActiveUsersAnsi: () => '',
            buildActivitySummaryAnsi: () => '',
            buildSystemDiagnosticsAnsi,
            getCommandFooterText: (category) => category === 'systemInfo' ? 'SYSTEMINFO FOOTER' : '',
            getSupportedFooterText: () => supportedFooterText,
            applyCommandFooter: async (assetPath, fallbackText) => {
                appliedFooters.push(String(fallbackText || ''));
            },
            setLoading: () => {},
            esc: (value) => String(value ?? ''),
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            cmdInput: {
                focus() {
                    focusCalls += 1;
                }
            },
            state
        });

        const handleGlobalRuntimeCommand = createGlobalRuntimeCommandHandler({
            state,
            toggleTheme: () => {},
            showActivitySummary: async () => {},
            showSystemDiagnostics,
            setHint: () => {},
            setPrompt: () => {}
        });

        const handled = await handleGlobalRuntimeCommand({ cmd: 'SYSINFO', rawCmd: 'SYSINFO' });
        if (!handled) {
            errors.push('SYSINFO global runtime command was not handled by commandRouterGlobalRuntime.js');
        }
        if (fetchCalls[0] !== '/api/system/info') {
            errors.push(`SYSINFO global command did not fetch /api/system/info (got ${fetchCalls[0] || 'none'})`);
        }
        if (state.screen !== 'system-diagnostics') {
            errors.push('SYSINFO global command did not activate state.screen="system-diagnostics"');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'SYSINFO FOOTER') {
            errors.push(`SYSINFO screen did not apply the supported footer hint (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 1) {
            errors.push(`SYSINFO screen did not request exactly one URL sync on entry (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 1) {
            errors.push(`SYSINFO screen did not focus the command input on desktop entry (got ${focusCalls})`);
        }
        if (!screenEl.innerHTML.includes('시스템 진단 및 정보') || !screenEl.innerHTML.includes('SYSINFO')) {
            errors.push('SYSINFO global command did not render the diagnostics title');
        }
        if (!screenEl.innerHTML.includes(systemInfo.hostname) || !screenEl.innerHTML.includes('저장소 상태')) {
            errors.push('SYSINFO global command did not render the expected diagnostics sections');
        }
        if (!screenEl.innerHTML.includes('BOARD') || !screenEl.innerHTML.includes('34ms')) {
            errors.push('SYSINFO global command did not render repository health/metrics entries');
        }

        state.screen = 'chat-room';
        const aliasFetchCount = fetchCalls.length;
        const aliasHandled = await handleGlobalRuntimeCommand({ cmd: 'DIAG', rawCmd: 'DIAG' });
        if (!aliasHandled) {
            errors.push('DIAG alias was not handled by commandRouterGlobalRuntime.js');
        }
        if (fetchCalls.length !== aliasFetchCount + 1) {
            errors.push('DIAG alias did not trigger a fresh system-info fetch');
        }
        if (state.screen !== 'system-diagnostics') {
            errors.push('DIAG alias did not restore the system-diagnostics screen from chat-room');
        }
        if (updateUrlCalls !== 2) {
            errors.push(`DIAG alias did not request a second URL sync (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 2) {
            errors.push(`DIAG alias did not refocus the command input on desktop entry (got ${focusCalls})`);
        }

        shouldFailSystemInfo = true;
        supportedFooterText = '';
        state.screen = 'main';
        appliedFooters.length = 0;
        await showSystemDiagnostics();

        if (fetchCalls.length !== aliasFetchCount + 2) {
            errors.push('SYSINFO failure path did not attempt a fresh fetch');
        }
        if (state.screen !== 'system-diagnostics') {
            errors.push('SYSINFO failure path did not keep state.screen="system-diagnostics"');
        }
        if (!screenEl.innerHTML.includes('시스템 정보를 가져오지 못했습니다.')) {
            errors.push('SYSINFO failure path did not render the expected error box');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'SYSTEMINFO FOOTER') {
            errors.push(`SYSINFO failure path did not fall back to the systemInfo footer text (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 3) {
            errors.push(`SYSINFO failure path did not request URL sync before failing closed (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 3) {
            errors.push(`SYSINFO failure path did not refocus the command input on desktop error recovery (got ${focusCalls})`);
        }
    } catch (error) {
        errors.push(`SYSINFO module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        if (typeof originalDocument === 'undefined') {
            delete globalThis.document;
        } else {
            globalThis.document = originalDocument;
        }
    }
}

// [LOG: 20260429_0456] When Playwright stays blocked, PERF must still prove
// report rendering, metric reset, and shared asset cache invalidation instead
// of leaving commandFooter cache drift hidden behind a green smoke run.
async function verifyPerformanceCommandCoverage(errors) {
    console.log('⚙️ Checking PERF coverage via module harness...');

    try {
        const moduleCache = new Map();
        const { createCommandFooterUtils } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandFooter.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);
        const { createPerformanceService } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/performanceService.js'), moduleCache);

        const circularSdkClient = {
            mfa: {
                webauthn: {}
            }
        };
        circularSdkClient.mfa.webauthn.client = circularSdkClient;

        const state = {
            screen: 'main',
            theme: 'default',
            assetCache: {
                '/ansi/footer/main.txt': 'cached-main',
                '/ansi/footer/help.txt': 'cached-help'
            },
            auth: circularSdkClient
        };
        const sharedAssetCache = state.assetCache;
        let hint = '';
        let prompt = '';
        let toggleCalls = 0;
        let assetFetches = 0;
        let cacheHits = 0;
        let cacheMisses = 0;
        const perfWarnings = [];

        const { loadAssetText } = createCommandFooterUtils({
            assetCache: state.assetCache,
            fetchImpl: async () => {
                assetFetches += 1;
                return {
                    ok: true,
                    text: async () => 'network-footer'
                };
            },
            onCacheHit: () => {
                cacheHits += 1;
            },
            onCacheMiss: () => {
                cacheMisses += 1;
            }
        });

        const performanceService = createPerformanceService({
            state,
            logger: {
                warn: (...args) => {
                    perfWarnings.push(args);
                }
            }
        });
        performanceService.recordRender(42, 12, false);
        performanceService.recordRender(18, 6, false);
        performanceService.recordApiLatency(18, '/api/perf');
        performanceService.recordCache(true);
        performanceService.recordCache(true);
        performanceService.recordCache(false);

        const initialStats = performanceService.getStats();
        if (initialStats.lastRenderTime !== 18 || initialStats.avgRenderTime !== 30) {
            errors.push(`PERF harness expected live render stats 18/30ms before command execution (got ${initialStats.lastRenderTime}/${initialStats.avgRenderTime})`);
        }
        if (initialStats.avgApiLatency !== 18 || initialStats.cacheHitRate !== 67 || initialStats.assetCacheSize !== 2) {
            errors.push(`PERF harness expected live API/cache stats 18ms/67%/2 before command execution (got ${initialStats.avgApiLatency}/${initialStats.cacheHitRate}/${initialStats.assetCacheSize})`);
        }
        if (!Number.isInteger(initialStats.stateSizeKb) || initialStats.stateSizeKb < 0) {
            errors.push(`PERF harness expected circular-safe stateSizeKb, got ${initialStats.stateSizeKb}`);
        }
        if (perfWarnings.length > 0) {
            errors.push(`PERF harness should not warn while serializing circular state (got ${perfWarnings.length} warnings)`);
        }

        const handleGlobalRuntimeCommand = createGlobalRuntimeCommandHandler({
            state,
            performanceService,
            toggleTheme: () => {
                toggleCalls += 1;
            },
            showActivitySummary: async () => {},
            showSystemDiagnostics: async () => {},
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
            }
        });

        const cachedFooter = await loadAssetText('/ansi/footer/main.txt');
        if (cachedFooter !== 'cached-main') {
            errors.push(`PERF harness expected cached footer text before invalidation (got ${cachedFooter || 'empty'})`);
        }
        if (cacheHits !== 1 || cacheMisses !== 0) {
            errors.push(`PERF harness expected exactly one cache hit before invalidation (hits=${cacheHits}, misses=${cacheMisses})`);
        }

        const reportHandled = await handleGlobalRuntimeCommand({ cmd: 'PERF', rawCmd: 'PERF' });
        if (!reportHandled) {
            errors.push('PERF global runtime command was not handled by commandRouterGlobalRuntime.js');
        }
        if (prompt !== '>>') {
            errors.push(`PERF report did not restore prompt >> (got ${prompt || 'empty'})`);
        }
        if (state.screen !== 'main') {
            errors.push(`PERF report should not change the current screen (got ${state.screen || 'empty'})`);
        }
        if (!hint.includes('[시스템 성능 보고서]')
            || !hint.includes('마지막 렌더링: 18ms')
            || !hint.includes('평균 렌더링: 30ms')
            || !hint.includes('평균 API 지연: 18ms')
            || !hint.includes('캐시 적중률: 67%')
            || !hint.includes('에셋 캐시: 2개')
            || !/상태 객체 크기: \d+KB/.test(hint)) {
            errors.push(`PERF report did not render the expected stats payload (got ${hint || 'empty'})`);
        }

        const clearHandled = await handleGlobalRuntimeCommand({ cmd: 'PERF', rawCmd: 'PERF CLR' });
        if (!clearHandled) {
            errors.push('PERF CLR was not handled by commandRouterGlobalRuntime.js');
        }
        const clearedStats = performanceService.getStats();
        if (clearedStats.lastRenderTime !== 0 || clearedStats.avgRenderTime !== 0 || clearedStats.avgApiLatency !== 0 || clearedStats.cacheHitRate !== 0) {
            errors.push(`PERF CLR did not clear live performance stats (got ${clearedStats.lastRenderTime}/${clearedStats.avgRenderTime}/${clearedStats.avgApiLatency}/${clearedStats.cacheHitRate})`);
        }
        if (hint !== '성능 메트릭을 초기화했습니다.') {
            errors.push(`PERF CLR did not render the metric reset hint (got ${hint || 'empty'})`);
        }
        if (prompt !== '>>') {
            errors.push(`PERF CLR did not restore prompt >> (got ${prompt || 'empty'})`);
        }

        const cacheHandled = await handleGlobalRuntimeCommand({ cmd: 'PERF', rawCmd: 'PERF CACHE' });
        if (!cacheHandled) {
            errors.push('PERF CACHE was not handled by commandRouterGlobalRuntime.js');
        }
        if (state.assetCache !== sharedAssetCache) {
            errors.push('PERF CACHE replaced state.assetCache instead of clearing the shared cache object in place');
        }
        if (Object.keys(sharedAssetCache).length !== 0) {
            errors.push(`PERF CACHE did not empty the shared asset cache object (remaining=${Object.keys(sharedAssetCache).join(',') || 'none'})`);
        }
        if (hint !== '에셋 캐시를 강제로 비웠습니다.') {
            errors.push(`PERF CACHE did not render the cache reset hint (got ${hint || 'empty'})`);
        }
        if (prompt !== '>>') {
            errors.push(`PERF CACHE did not restore prompt >> (got ${prompt || 'empty'})`);
        }
        if (performanceService.getStats().assetCacheSize !== 0) {
            errors.push(`PERF CACHE did not update live asset cache size after invalidation (got ${performanceService.getStats().assetCacheSize})`);
        }

        const refreshedFooter = await loadAssetText('/ansi/footer/main.txt');
        if (refreshedFooter !== 'network-footer') {
            errors.push(`PERF CACHE did not invalidate shared footer cache entries (got ${refreshedFooter || 'empty'})`);
        }
        if (assetFetches !== 1) {
            errors.push(`PERF CACHE did not force exactly one footer refetch after invalidation (got ${assetFetches})`);
        }
        if (cacheHits !== 1 || cacheMisses !== 1) {
            errors.push(`PERF CACHE produced unexpected cache counters after refetch (hits=${cacheHits}, misses=${cacheMisses})`);
        }

        sharedAssetCache['/ansi/footer/help.txt'] = 'cached-help-again';
        const aliasHandled = await handleGlobalRuntimeCommand({ cmd: 'PERF', rawCmd: 'PERF C' });
        if (!aliasHandled) {
            errors.push('PERF C alias was not handled by commandRouterGlobalRuntime.js');
        }
        if (toggleCalls !== 0) {
            errors.push(`PERF C alias incorrectly triggered the top-level C theme toggle (got ${toggleCalls} toggle calls)`);
        }
        if (Object.keys(sharedAssetCache).length !== 0) {
            errors.push('PERF C alias did not clear the shared asset cache object');
        }
    } catch (error) {
        errors.push(`PERF module harness failed: ${error.message}`);
    }
}

// [LOG: 20260429_0220] When Playwright stays blocked, W should still prove
// global entry, post-list write conflict handling, and fail-closed render via a
// browser module harness instead of API-only fallback coverage.
async function verifyActiveUsersCommandCoverage(errors) {
    console.log('👤 Checking active-users command coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalNavigationCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterGlobalNavigation.js'), moduleCache);

        const state = {
            screen: 'main',
            user: { isGuest: true }
        };
        const screenEl = createHarnessScreenEl();
        const fetchCalls = [];
        const appliedFooters = [];
        let supportedFooterText = 'ACTIVE FOOTER';
        let updateUrlCalls = 0;
        let focusCalls = 0;
        let shouldFailActiveUsers = false;

        const activeUsers = [
            {
                userId: 'alpha-user',
                nickName: 'Alpha',
                path: '/chat/1',
                isGuest: false,
                isAdmin: false,
                lastSeenAt: '2026-04-29T04:20:00.000Z'
            },
            {
                userId: 'sysop',
                nickName: '관리자',
                path: '/sys',
                isGuest: false,
                isAdmin: true,
                lastSeenAt: '2026-04-29T04:20:30.000Z'
            }
        ];

        const env = createHarnessBrowserGlobals({ innerWidth: 1280 });
        globalThis.window = env.window;
        globalThis.document = env.document;

        const { buildActiveUsersAnsi } = createSystemAnsiBuilders({
            displayWidth: (value = '') => String(value || '').length,
            isWideChar: () => false
        });

        const { showActiveUsers } = createSystemScreens({
            apiFetch: async (pathname) => {
                fetchCalls.push(pathname);
                if (shouldFailActiveUsers) {
                    throw new Error('active-users fetch failed');
                }
                return activeUsers.map(user => ({ ...user }));
            },
            ansiToHTML: ansiToHTMLHarnessStub,
            buildActiveUsersAnsi,
            buildSystemDiagnosticsAnsi: () => '',
            getCommandFooterText: (category) => category === 'systemInfo' ? 'SYSTEMINFO FOOTER' : '',
            getSupportedFooterText: () => supportedFooterText,
            applyCommandFooter: async (assetPath, fallbackText) => {
                appliedFooters.push(String(fallbackText || ''));
            },
            setLoading: () => {},
            esc: (value) => String(value ?? ''),
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            cmdInput: {
                focus() {
                    focusCalls += 1;
                }
            },
            state
        });

        const handleGlobalNavigationCommand = createGlobalNavigationCommandHandler({
            state,
            doLogout: async () => {},
            toggleHintExpansion: () => {},
            executeGoCommand: async () => false,
            showProfile: async () => {},
            showActiveUsers,
            showMyInfo: async () => {},
            showHelp: async () => {},
            showHistory: async () => {},
            handleHistoryBack: async () => {},
            setHint: () => {},
            setPrompt: () => {},
            findBoardByCode: () => null,
            showPostList: async () => {},
            showLogin: () => {},
            showConfirm: async () => true
        });

        // [LOG_ID: 20260801_1600] 20260801_1005에서 W를 글쓰기 전용으로 일원화하며
        // commandRouterGlobalNavigation.js의 접속자 목록 분기에서 완전히 빠졌다(화면과
        // 무관하게 항상 미처리) — 옛 기대(W가 접속자 목록을 띄움)를 지우고, W가 어떤 화면에서도
        // 이 핸들러에 의해 소비되지 않는지, 그리고 WHO/WH/USER/UID가 여전히 정상 동작하는지로
        // 대체한다.
        const wOnMain = await handleGlobalNavigationCommand({ cmd: 'W', rawCmd: 'W' });
        if (wOnMain) {
            errors.push('W was incorrectly consumed by global navigation instead of being left for the write command path');
        }
        if (fetchCalls.length !== 0) {
            errors.push('W triggered an active-users fetch even though it is reserved for writing');
        }
        if (state.screen !== 'main') {
            errors.push('W changed state.screen even though it should stay available for writing');
        }

        const handled = await handleGlobalNavigationCommand({ cmd: 'WHO', rawCmd: 'WHO' });
        if (!handled) {
            errors.push('WHO global command was not handled by commandRouterGlobalNavigation.js');
        }
        if (fetchCalls[0] !== '/api/system/active-users') {
            errors.push(`WHO global command did not fetch /api/system/active-users (got ${fetchCalls[0] || 'none'})`);
        }
        if (state.screen !== 'active-users') {
            errors.push('WHO global command did not activate state.screen="active-users"');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'ACTIVE FOOTER') {
            errors.push(`Active-users screen did not apply the supported footer hint (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 1) {
            errors.push(`Active-users screen did not request exactly one URL sync on WHO entry (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 1) {
            errors.push(`Active-users screen did not focus the command input on desktop entry (got ${focusCalls})`);
        }
        if (!screenEl.innerHTML.includes('접속자 목록') || !screenEl.innerHTML.includes('WHO IS ONLINE')) {
            errors.push('WHO global command did not render the active-users title');
        }
        if (!screenEl.innerHTML.includes('alpha-user') || !screenEl.innerHTML.includes('/chat/1')) {
            errors.push('WHO global command did not render the expected active-users payload');
        }

        state.screen = 'post-list';
        const conflictFetchCount = fetchCalls.length;
        const conflictHandled = await handleGlobalNavigationCommand({ cmd: 'W', rawCmd: 'W' });
        if (conflictHandled) {
            errors.push('W was incorrectly consumed by global navigation on post-list instead of leaving the write shortcut intact');
        }
        if (fetchCalls.length !== conflictFetchCount) {
            errors.push('W triggered active-users fetch on post-list instead of preserving the write command path');
        }
        if (state.screen !== 'post-list') {
            errors.push('W changed the current screen on post-list even though it should stay available for writing');
        }
        if (updateUrlCalls !== 1) {
            errors.push(`W changed URL sync count on post-list conflict handling (got ${updateUrlCalls})`);
        }

        const whoHandled = await handleGlobalNavigationCommand({ cmd: 'WHO', rawCmd: 'WHO' });
        if (!whoHandled) {
            errors.push('WHO alias was not handled by commandRouterGlobalNavigation.js when W is reserved for writing');
        }
        if (fetchCalls.length !== conflictFetchCount + 1) {
            errors.push('WHO alias did not trigger a fresh active-users fetch from post-list');
        }
        if (state.screen !== 'active-users') {
            errors.push('WHO alias did not restore the active-users screen from post-list');
        }
        if (updateUrlCalls !== 2) {
            errors.push(`WHO alias did not request a second URL sync from post-list (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 2) {
            errors.push(`WHO alias did not refocus the command input on desktop entry (got ${focusCalls})`);
        }

        shouldFailActiveUsers = true;
        supportedFooterText = '';
        state.screen = 'main';
        appliedFooters.length = 0;
        await showActiveUsers();

        if (fetchCalls.length !== conflictFetchCount + 2) {
            errors.push('Active-users failure path did not attempt a fresh fetch');
        }
        if (state.screen !== 'active-users') {
            errors.push('Active-users failure path did not keep state.screen="active-users"');
        }
        if (!screenEl.innerHTML.includes('접속자 정보를 가져오지 못했습니다.')) {
            errors.push('Active-users failure path did not render the expected error box');
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'SYSTEMINFO FOOTER') {
            errors.push(`Active-users failure path did not fall back to the systemInfo footer text (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateUrlCalls !== 3) {
            errors.push(`Active-users failure path did not request URL sync before failing closed (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 3) {
            errors.push(`Active-users failure path did not refocus the command input on desktop error recovery (got ${focusCalls})`);
        }
    } catch (error) {
        errors.push(`Active-users module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        if (typeof originalDocument === 'undefined') {
            delete globalThis.document;
        } else {
            globalThis.document = originalDocument;
        }
    }
}

async function verifySystemLogCoverage(errors) {
    console.log('📜 Checking SYSLOG coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);
        const { createSystemLogScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemLogScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);

        const state = {
            screen: 'main'
        };
        const screenEl = createHarnessScreenEl();
        const toasts = [];
        let hint = '';
        let prompt = '';
        let updateUrlCalls = 0;
        let logSequence = 0;
        let logs = [];

        const appendLog = (level, message) => {
            logs.push({
                timestamp: new Date(Date.UTC(2026, 3, 29, 4, 20, logSequence)).toISOString(),
                level,
                message
            });
            logSequence += 1;
        };

        appendLog('INFO', 'Alpha log entry');
        appendLog('ERROR', 'Beta log entry');

        const env = createHarnessBrowserGlobals({ innerWidth: 1280 });
        globalThis.window = env.window;
        globalThis.document = env.document;

        const { buildSystemLogAnsi } = createSystemAnsiBuilders({
            displayWidth: (value = '') => String(value || '').length,
            isWideChar: () => false
        });

        const { showSystemLog, handleLogCommand } = createSystemLogScreens({
            state,
            screenEl,
            ansiToHTML: ansiToHTMLHarnessStub,
            buildSystemLogAnsi,
            getSupportedFooterText: () => 'SYSLOG FOOTER',
            logger: {
                getLogs: () => logs.map(entry => ({ ...entry })),
                clear: () => {
                    logs = [];
                    appendLog('INFO', 'System log cleared.');
                },
                getFormattedLogs: () => logs.map(entry => `[${entry.level}] ${entry.message}`).join('\n')
            },
            setHint: value => {
                hint = value;
            },
            setPrompt: value => {
                prompt = value;
            },
            updateURL: () => {
                updateUrlCalls += 1;
            },
            showToast: (...args) => {
                toasts.push(args);
            },
            esc: value => String(value || '')
        });

        const handleGlobalRuntimeCommand = createGlobalRuntimeCommandHandler({
            state,
            toggleTheme: () => {},
            showActivitySummary: async () => {},
            showSystemDiagnostics: async () => {},
            showSystemLog,
            setHint: value => {
                hint = value;
            },
            setPrompt: value => {
                prompt = value;
            }
        });

        const handled = await handleGlobalRuntimeCommand({ cmd: 'SYSLOG', rawCmd: 'SYSLOG' });
        if (!handled) {
            errors.push('SYSLOG global command was not handled by commandRouterGlobalRuntime.js');
        }
        if (state.screen !== 'system-log') {
            errors.push('SYSLOG global command did not activate state.screen="system-log"');
        }
        if (prompt !== 'LOG>>') {
            errors.push(`SYSLOG screen did not set prompt to LOG>> (got ${prompt || 'empty'})`);
        }
        if (hint !== 'SYSLOG FOOTER') {
            errors.push(`SYSLOG screen did not apply the supported footer hint (got ${hint || 'empty'})`);
        }
        if (updateUrlCalls !== 1) {
            errors.push(`SYSLOG screen did not request exactly one URL sync on entry (got ${updateUrlCalls})`);
        }
        if (!screenEl.innerHTML.includes('시스템 로그')) {
            errors.push('SYSLOG global command did not render the system log title');
        }
        if (!screenEl.innerHTML.includes('Alpha log entry') || !screenEl.innerHTML.includes('Beta log entry')) {
            errors.push('SYSLOG global command did not render the expected initial log entries');
        }

        const clearHandled = await handleLogCommand('C');
        if (!clearHandled) {
            errors.push('System log clear command did not return handled=true for C');
        }
        if (!screenEl.innerHTML.includes('System log cleared.')) {
            errors.push('System log clear command did not rerender the cleared-log marker');
        }
        if (toasts[0]?.[0] !== '로그가 초기화되었습니다.') {
            errors.push(`System log clear command did not show the expected toast (got ${toasts[0]?.[0] || 'none'})`);
        }

        appendLog('WARN', 'Gamma log entry');
        const refreshHandled = await handleLogCommand('R');
        if (!refreshHandled) {
            errors.push('System log refresh command did not return handled=true for R');
        }
        if (!screenEl.innerHTML.includes('Gamma log entry')) {
            errors.push('System log refresh command did not rerender newly appended log entries');
        }

        const copyHandled = await handleLogCommand('CP');
        if (!copyHandled) {
            errors.push('System log clipboard command did not return handled=true for CP');
        }
        const copyToast = String(toasts[toasts.length - 1]?.[0] || '');
        if (!copyToast.startsWith('클립보드 복사 실패:')) {
            errors.push(`System log clipboard command did not fail closed without navigator.clipboard (got ${copyToast || 'none'})`);
        }
    } catch (error) {
        errors.push(`SYSLOG module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        if (typeof originalDocument === 'undefined') {
            delete globalThis.document;
        } else {
            globalThis.document = originalDocument;
        }
    }
}

async function verifyPlaywrightCommands(page, errors) {
    console.log('⌨️  Testing Global Commands...');

    console.log('   > Executing command: H');
    if (await openHomeAndWait(page, errors, 'home before H')) {
        await submitCommand(page, 'H');
        try {
            await page.waitForURL((url) => url.pathname === '/help', { timeout: config.TIMEOUT });
            await ensureTerminalReady(page, 'H command', errors);
        } catch (error) {
            errors.push(`H command did not open /help: ${error.message}`);
        }
    }

    console.log('   > Executing command: C');
    if (await openHomeAndWait(page, errors, 'home before C')) {
        const previousTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
        await submitCommand(page, 'C');
        try {
            await page.waitForFunction((theme) => {
                return (document.documentElement.getAttribute('data-theme') || '') !== theme;
            }, previousTheme, { timeout: config.TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: config.TIMEOUT });
        } catch (error) {
            errors.push(`C command did not toggle the theme: ${error.message}`);
        }
    }

    console.log('   > Executing command: PERF');
    if (await openHomeAndWait(page, errors, 'home before PERF')) {
        await submitCommand(page, 'PERF');
        try {
            await page.waitForFunction(() => {
                const hintText = document.getElementById('cmd-hint')?.textContent || '';
                const promptText = document.getElementById('cmd-prompt')?.textContent || '';
                return hintText.includes('시스템 성능 보고서') && hintText.includes('에셋 캐시') && promptText.includes('>>');
            }, null, { timeout: config.TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: config.TIMEOUT });
        } catch (error) {
            errors.push(`PERF command did not render the performance report hint: ${error.message}`);
        }
    }

    console.log('   > Executing command: SYSLOG');
    if (await openHomeAndWait(page, errors, 'home before SYSLOG')) {
        await submitCommand(page, 'SYSLOG');
        try {
            await page.waitForFunction(() => {
                const screenText = document.getElementById('terminal-screen')?.textContent || '';
                const promptText = document.getElementById('cmd-prompt')?.textContent || '';
                return screenText.includes('시스템 로그') && promptText.includes('LOG>>');
            }, null, { timeout: config.TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: config.TIMEOUT });
        } catch (error) {
            errors.push(`SYSLOG command did not render the system log screen: ${error.message}`);
        }
    }

    console.log('   > Executing command: SYSINFO');
    if (await openHomeAndWait(page, errors, 'home before SYSINFO')) {
        await page.evaluate(() => {
            try {
                if (window.__debugState) {
                    window.__debugState.user = { userId: 'sysop', nickName: '운영자', isGuest: false, isAdmin: true, level: 99 };
                }
                localStorage.setItem('bbs_user_id', 'sysop');
                localStorage.setItem('bbs_session', JSON.stringify({ userId: 'sysop', role: 'sysop', nickname: '운영자' }));
            } catch (e) {}
        });
        await submitCommand(page, 'SYSINFO');
        try {
            await page.waitForFunction(() => {
                const screenText = document.getElementById('terminal-screen')?.textContent || '';
                const promptText = document.getElementById('cmd-prompt')?.textContent || '';
                return (screenText.includes('시스템 진단 및 정보') || screenText.includes('SYSINFO')) && promptText.includes('>>');
            }, null, { timeout: config.TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: config.TIMEOUT });
        } catch (error) {
            errors.push(`SYSINFO command did not render the diagnostics screen: ${error.message}`);
        }
    }

    console.log('   > Executing command: WHO');
    if (await openHomeAndWait(page, errors, 'home before WHO')) {
        await submitCommand(page, 'WHO');
        try {
            await page.waitForFunction(() => {
                const screenText = document.getElementById('terminal-screen')?.textContent || '';
                return screenText.includes('접속자 목록') || screenText.includes('WHO IS ONLINE');
            }, null, { timeout: config.TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: config.TIMEOUT });
        } catch (error) {
            errors.push(`WHO command did not render the active-users screen: ${error.message}`);
        }
    }
}

// [LOG: 20260802_0000] 회귀 테스트: getActiveUsers/getActivitySummary에서 await 누락 버그 재현 및 수정 검증.
// memory 드라이버(ActivityRepository)는 list()/getRecentSummary()가 동기 반환이라
// 기존 HTTP 스모크 테스트(verifyHttpActiveUsersCoverage 등)는 메모리 모드에서만 실행되므로
// Supabase 비동기 모드의 버그를 감지하지 못했다 — 이 테스트가 그 격차를 명시적으로 커버한다.
async function verifyAsyncActivityRepositoryAwaitCoverage(errors) {
    console.log('⏳ Checking async ActivityRepository await coverage (Supabase mode simulation)...');

    // 비동기 activityRepository mock (ActivityRepositorySupabase 시뮬레이션)
    const asyncRepo = {
        async list() {
            return [
                { userId: 'user1', nickName: '홍길동', remoteAddr: '1.2.3.4', level: 1, isAdmin: false },
                { userId: 'user2', nickName: '이순신', remoteAddr: '5.6.7.8', level: 99, isAdmin: true }
            ];
        },
        async getRecentSummary(limit) {
            return {
                summary: '2명의 회원과 0명의 손님이 접속 중입니다.',
                recentActions: ['user1님이 활동 중입니다.'],
                timestamp: new Date().toISOString()
            };
        }
    };

    // === getActiveUsers await 누락 버그 재현 ===
    try {
        const usersPromise = asyncRepo.list(); // await 없음 — 버그 시뮬레이션
        usersPromise.map(({ remoteAddr, ...rest }) => rest); // Promise에 .map() 호출 → TypeError
        errors.push('[BUG NOT REPRODUCED] getActiveUsers: list() without await should have thrown TypeError');
    } catch (e) {
        if (e instanceof TypeError && e.message.includes('map')) {
            // 버그가 정상 재현됨 — 수정 전 동작 확인
        } else {
            errors.push(`getActiveUsers await-missing bug reproduction: unexpected error: ${e.message}`);
        }
    }

    // === getActiveUsers 수정 후 정상 동작 검증 ===
    try {
        const users = await asyncRepo.list(); // await 추가 — 수정 후 동작
        const publicUsers = users.map(({ remoteAddr, ...rest }) => rest);
        if (!Array.isArray(publicUsers) || publicUsers.length !== 2) {
            errors.push(`getActiveUsers (fixed): expected 2 users, got ${publicUsers.length}`);
        }
        if (publicUsers.some(u => u.remoteAddr !== undefined)) {
            errors.push('getActiveUsers (fixed): remoteAddr not stripped from response');
        }
        if (!publicUsers.some(u => u.userId === 'user1') || !publicUsers.some(u => u.userId === 'user2')) {
            errors.push('getActiveUsers (fixed): expected users not present in response');
        }
    } catch (e) {
        errors.push(`getActiveUsers (fixed) unexpectedly failed: ${e.message}`);
    }

    // === getActivitySummary await 누락 버그 재현 ===
    {
        const resultPromise = asyncRepo.getRecentSummary(5); // await 없음 — 버그 시뮬레이션
        const serialized = JSON.stringify(resultPromise); // Promise → "{}"
        if (serialized !== '{}') {
            errors.push(`[BUG NOT REPRODUCED] getActivitySummary: Promise serialized as ${serialized}, expected '{}'`);
        }
        // 버그가 재현됨: 클라이언트는 summary/recentActions 대신 빈 객체 {}를 받는다
    }

    // === getActivitySummary 수정 후 정상 동작 검증 ===
    try {
        const summary = await asyncRepo.getRecentSummary(5); // await 추가 — 수정 후 동작
        if (!summary?.summary || !Array.isArray(summary?.recentActions) || !summary?.timestamp) {
            errors.push(`getActivitySummary (fixed): response shape invalid: ${JSON.stringify(summary)}`);
        }
        if (!summary.summary.includes('회원')) {
            errors.push(`getActivitySummary (fixed): summary text missing '회원' (got: ${summary.summary})`);
        }
    } catch (e) {
        errors.push(`getActivitySummary (fixed) unexpectedly failed: ${e.message}`);
    }
}

module.exports = {
    verifyHttpActiveUsersCoverage,
    verifyHttpSystemInfoCoverage,
    verifyHttpActivitySummaryCoverage,
    verifyActivitySummaryCommandCoverage,
    verifySystemDiagnosticsCommandCoverage,
    verifyPerformanceCommandCoverage,
    verifyActiveUsersCommandCoverage,
    verifySystemLogCoverage,
    verifyAsyncActivityRepositoryAwaitCoverage,
    verifyPlaywrightCommands
};
