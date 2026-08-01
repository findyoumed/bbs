/**
 * smoke-full-traversal.js
 * [LOG: 20260428_1530] Playwright-based BBS Full Traversal Crawler.
 * [LOG_ID: 20260801_1243] Refactored to load split E2E smoke tests.
 */
'use strict';

const { chromium } = require('playwright');
const {
    config,
    startServer,
    stopServer,
    isBrowserLaunchBlocked,
    ensureTerminalReady,
    openHomeAndWait
} = require('./smoke/common-utils');

// Load E2E test suites
const boardTests = require('./smoke/board-tests');
const chatTests = require('./smoke/chat-tests');
const pdsTests = require('./smoke/pds-tests');
const authTests = require('./smoke/auth-tests');
const profileTests = require('./smoke/profile-tests');
const systemTests = require('./smoke/system-tests');
const weatherTests = require('./smoke/weather-tests');
const memoTests = require('./smoke/memo-tests');
const miscTests = require('./smoke/misc-tests');

async function runHttpTraversal(errors) {
    console.log('⚠️  Playwright browser launch is unavailable here. Falling back to HTTP traversal.');

    for (const route of config.TEST_ROUTES) {
        console.log(`📡 Checking route via HTTP: ${route}`);
        const response = await fetch(`${config.BASE_URL}${route}`);
        const content = await response.text();

        if (!response.ok) {
            errors.push(`HTTP ${response.status} at ${route}`);
        }

        if (!content || content.trim().length === 0) {
            errors.push(`Empty page content at ${route}`);
            continue;
        }

        if (!content.includes(config.APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${route}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${route}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${route}`);
        }
    }

    console.log('⌨️  Testing fallback command coverage...');
    console.log('   > H and /help?page=N are covered by the /help route shell plus a help module harness for pagination and direct restore.');
    console.log('   > /history is covered by the route shell plus a history module harness for newest-first render and direct restore.');
    console.log('   > /chat is covered by /api/chat/rooms* plus chat modules and a chat history snapshot harness for stale serviceData.');
    console.log('   > /board/:boardId/:postId is covered by /api/boards/:boardId/posts/:postId plus board direct-route modules.');
    console.log('   > /pds and /pds/:postId?page=N are covered by the route shell plus an always-run unified PDS harness for later-page detail reload.');
    console.log('   > /board/:boardId/write, /board/:boardId/:postId/edit, and /board/:boardId/:postId/reply are covered by board route shells plus a post-write harness for P/S, prefill, reply restore, and guard hints.');
    console.log('   > /board/:boardId/:postId/files is covered by board attachment route shell plus attachment route/command modules.');
    console.log('   > /memo, /memo/:memoId, and /memo/write are covered by /api/memos* guest/auth checks plus a memo-write module harness for direct restore.');
    console.log('   > /log/login, /log/password, /log/signup, /log/signup/email, /log/signup/agree, and /log/signup/profile are covered by auth entry/auth recovery harnesses for direct restore without menu-tree hydration.');
    console.log('   > /profile/:userId is covered by the route shell plus a profile module harness for member fetch, footer/prompt restore, and markup closure.');
    console.log('   > /myinfo is covered by /api/members profile/password/delete plus a myinfo module harness for guest direct-route and command auth guards.');
    console.log('   > /service/weather is covered by /api/services/weather* plus a weather module harness for /service/weather/:region?page=N restore.');
    console.log('   > SYSINFO is covered by /api/system/info plus a diagnostics module harness for global entry, alias handling, and fail-closed render.');
    console.log('   > ACT is covered by /api/system/activity-summary plus an activity-summary module harness for global entry, alias handling, and fail-closed render.');
    console.log('   > PERF is covered by a performance module harness for report output, metric reset, and in-place asset cache invalidation.');
    console.log('   > W is covered by /api/system/active-users plus an active-users module harness for global entry, write-screen conflict handling, and fail-closed render.');
    console.log('   > /service/news is covered by /api/services/news* plus a news module harness for /service/news/:topic?page=N and ?article=:id&page=N restore.');
    console.log('   > C is still covered by its backing theme module here, and SYSLOG now has a dedicated module harness plus HTTP markers.');

    // Execute split HTTP/Harness test suites
    await chatTests.verifyHttpChatCoverage(errors);
    await chatTests.verifyChatHistorySnapshotCoverage(errors);
    await chatTests.verifyChatRoomEscCleanupCoverage(errors);
    await boardTests.verifyHttpBoardCoverage(errors);
    await memoTests.verifyHttpMemoCoverage(errors);
    await authTests.verifyAuthEntryRouteCoverage(errors);
    await profileTests.verifyProfileRouteCoverage(errors);
    await profileTests.verifyHttpMyInfoCoverage(errors);
    await profileTests.verifyMyInfoRouteCoverage(errors);
    await weatherTests.verifyHttpWeatherCoverage(errors);
    await miscTests.verifyHttpNewsCoverage(errors);
    await systemTests.verifyHttpSystemInfoCoverage(errors);
    await systemTests.verifyHttpActivitySummaryCoverage(errors);
    await systemTests.verifyHttpActiveUsersCoverage(errors);
    await systemTests.verifySystemDiagnosticsCommandCoverage(errors);
    await systemTests.verifyActivitySummaryCommandCoverage(errors);
    await systemTests.verifyPerformanceCommandCoverage(errors);
    await systemTests.verifyActiveUsersCommandCoverage(errors);
    // [LOG: 20260802_0000] Supabase 드라이버 await 누락 버그 회귀 테스트
    await systemTests.verifyAsyncActivityRepositoryAwaitCoverage(errors);
    await memoTests.verifyMemoWriteCoverage(errors);
    await memoTests.verifyMemoWriteFormGuard(errors);
    await miscTests.verifyHelpCoverage(errors);
    await miscTests.verifyHistoryCoverage(errors);
    await weatherTests.verifyWeatherCoverage(errors);
    await miscTests.verifyNewsCoverage(errors);
    await systemTests.verifySystemLogCoverage(errors);
    await miscTests.verifyHttpModuleCoverage(errors);
}

async function runPlaywrightTraversal(browser, errors) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(config.TIMEOUT);
    page.setDefaultTimeout(config.TIMEOUT);

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            console.error(`[Browser Error] ${msg.text()}`);
            errors.push(msg.text());
        }
    });

    page.on('pageerror', (err) => {
        console.error(`[Page Error] ${err.message}`);
        errors.push(err.message);
    });

    // 1. Visit Home
    console.log(`🔗 Visiting: ${config.BASE_URL}`);
    await page.goto(config.BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await ensureTerminalReady(page, '/', errors);

    // 2. Traversal Logic (Simplified Crawler)
    for (const route of config.TEST_ROUTES) {
        console.log(`📡 Checking route: ${route}`);
        await page.goto(`${config.BASE_URL}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await ensureTerminalReady(page, route, errors);
    }

    // 3. Command Interaction Test
    await systemTests.verifyPlaywrightCommands(page, errors);
    await chatTests.verifyPlaywrightChatFlow(page, errors);

    await context.close();
}

async function main() {
    console.log('🚀 Starting Full Traversal Smoke Test...');

    let serverHandle;
    try {
        serverHandle = await startServer();
        console.log('✅ Server started.');
    } catch (e) {
        console.error('❌ Failed to start server:', e.message);
        process.exit(1);
    }

    const errors = [];
    let browser = null;
    let traversalMode = 'playwright';

    try {
        try {
            browser = await chromium.launch({ headless: true });
        } catch (error) {
            if (!isBrowserLaunchBlocked(error)) {
                throw error;
            }

            const launchMessage = String(error?.message || error).split('\n')[0];
            console.log(`⚠️  Playwright launch blocked in this environment: ${launchMessage}`);
        }

        if (browser) {
            await runPlaywrightTraversal(browser, errors);
        } else {
            traversalMode = 'http-fallback';
            await runHttpTraversal(errors);
        }

        // Run common backend or module integration checks
        await pdsTests.verifyHttpUnifiedPdsCoverage(errors);
        await pdsTests.verifyUnifiedPdsCoverage(errors);
        await boardTests.verifyBoardNavigationSemantics(errors);
        await authTests.verifyAuthRecoveryCoverage(errors);
    } catch (err) {
        console.error('❌ Traversal failed:', err.message);
        errors.push(err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopServer(serverHandle);
    }

    if (errors.length > 0) {
        console.error(`\n❌ Found ${errors.length} errors during traversal!`);
        console.error(errors.join('\n'));
        process.exit(1);
    }

    if (traversalMode === 'playwright') {
        console.log('\n✅ Full traversal passed without console errors.');
    } else {
        console.log('\n✅ Full traversal passed in HTTP fallback mode.');
    }
    process.exit(0);
}

main();
