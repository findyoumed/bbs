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
    await chatTests.verifyChatGoCommandCoverage(errors);
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
    await memoTests.verifyContactSysopCoverage(errors);
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

    // [LOG_ID: 20260828_1830] 대문 핫스팟은 텍스트 위에 투명 버튼을 겹치는
    // 구조라, 렌더가 성공해도 좌표가 겹치거나 클릭 라우팅이 빠지면 사용자는
    // 메뉴를 선택할 수 없다. 원전의 번호 선택을 보완한 마우스 접근성 경로를
    // 실제 브라우저에서 각 항목 한 번씩 실행해 이동 결과까지 회귀 검증한다.
     await verifyTopMenuHotspotClicks(page, errors);
     await verifyAgoraRouteSemantics(page, errors);
     await verifyContactEditorInteraction(page, errors);
     await verifyGameInlineValidation(page, errors);

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

async function verifyTopMenuHotspotClicks(page, errors) {
    const hotspotSelector = '.ansi-hotspot-layer button';
    const initialCount = await page.locator(hotspotSelector).count();
    if (initialCount < 2) {
        errors.push(`Top menu hotspot count is too low: ${initialCount}`);
        return;
    }

    for (let index = 0; index < initialCount; index += 1) {
        await page.goto(config.BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        const hotspot = page.locator(hotspotSelector).nth(index);
        const count = await page.locator(hotspotSelector).count();
        if (count <= index) {
            errors.push(`Top menu hotspot ${index + 1} disappeared after reload`);
            continue;
        }

        const label = await hotspot.getAttribute('aria-label');
        await hotspot.click();
        await page.waitForTimeout(450);
        const screen = await page.locator('#terminal-container').getAttribute('data-screen');
        const url = page.url();
        const transitioned = url !== config.BASE_URL || (screen && screen !== 'main');
        if (!transitioned) {
            errors.push(`Top menu hotspot did not transition: ${label || index + 1}`);
        }
        if (label === '이동: GO NOTICE' && !url.includes('/notice')) {
            errors.push(`GO NOTICE hotspot opened an unexpected route: ${url}`);
        }
    }
    console.log(`🖱️  Verified ${initialCount} top-menu hotspots by browser click.`);
}

async function verifyAgoraRouteSemantics(page, errors) {
    // [LOG_ID: 20260828_2000] legacy/hanulso.mnu의 AGORA 부모 메뉴와 VOTE 자식 경로를
    // 직접 새로고침해도 동일한 의미로 복원하는지 브라우저에서 검증한다.
    await page.goto(`${config.BASE_URL}/agora`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const agoraScreen = await page.locator('#terminal-container').getAttribute('data-screen');
    const agoraHotspots = await page.locator('.ansi-hotspot-layer button').count();
    if (agoraScreen !== 'board-select' || agoraHotspots < 1) {
        errors.push(`AGORA container route mismatch: screen=${agoraScreen}, hotspots=${agoraHotspots}`);
    }

    await page.goto(`${config.BASE_URL}/agora/vote`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const voteScreen = await page.locator('#terminal-container').getAttribute('data-screen');
    if (voteScreen !== 'vote-list') {
        errors.push(`AGORA vote route mismatch: screen=${voteScreen}`);
    }
    console.log(`?뼮截? Verified AGORA container and /agora/vote route semantics.`);
}

async function verifyContactEditorInteraction(page, errors) {
    // 인증 상태를 바꾸는 편집 화면 검사는 주 순회 페이지의 상태를 오염하지
    // 않도록 같은 브라우저 컨텍스트의 별도 페이지에서 수행한다.
    const contactPage = await page.context().newPage();
    contactPage.setDefaultNavigationTimeout(config.TIMEOUT);
    contactPage.setDefaultTimeout(config.TIMEOUT);
    contactPage.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`[contact editor] ${msg.text()}`);
    });
    contactPage.on('pageerror', (error) => {
        errors.push(`[contact editor] ${error.message}`);
    });

    try {
        await contactPage.goto(`${config.BASE_URL}/guide`, { waitUntil: 'networkidle' });
        await contactPage.waitForTimeout(450);
         await contactPage.evaluate(() => {
             window.__debugState.user = {
                userId: 'qa-contact-user',
                nickName: 'QA',
                level: 1,
                isAdmin: false,
                isGuest: false
             };
         });

         // [LOG_ID: 20260828_2045] 공통 전역 명령에서 SOS를 입력해도
         // 기존 시삽 편집기로 연결되고, 명령 뒤의 긴급 메시지가 본문에 남는지 확인한다.
         const commandInput = contactPage.locator('#cmd-input');
         await commandInput.fill('SOS 서버 접속이 끊깁니다');
         await commandInput.press('Enter');
         await contactPage.waitForTimeout(450);
         const sosSubject = contactPage.locator('#tosysop-ed-subject');
         const sosBody = contactPage.locator('#tosysop-ed-body');
         if (await sosSubject.count() !== 1 || await sosBody.count() !== 1) {
             errors.push('SOS shortcut did not open the authenticated contact editor.');
             return;
         }
         if ((await sosSubject.inputValue()) !== '[긴급 SOS] 시삽에게 보내는 메시지' || (await sosBody.inputValue()) !== '서버 접속이 끊깁니다') {
             errors.push('SOS shortcut did not preserve its subject/body draft.');
         }
         await contactPage.keyboard.press('Escape');
         await contactPage.waitForTimeout(300);

         const contactButton = contactPage.locator('.ansi-hotspot-layer button[aria-label*="건의하기"]').first();
        if (await contactButton.count() !== 1) {
            errors.push('Contact sysop hotspot was not rendered on GUIDE.');
            return;
        }
        await contactButton.click();
        await contactPage.waitForTimeout(450);

        const subject = contactPage.locator('#tosysop-ed-subject');
        const body = contactPage.locator('#tosysop-ed-body');
        if (await subject.count() !== 1 || await body.count() !== 1) {
            errors.push('Authenticated contact sysop editor fields were not rendered.');
            return;
        }

        await subject.fill('');
        await body.fill('');
        await subject.press('Control+s');
        await contactPage.waitForTimeout(180);
        const result = await contactPage.evaluate(() => ({
            inlineError: document.querySelector('.tosysop-ed-validation')?.textContent || '',
            hint: document.querySelector('#cmd-hint')?.textContent || '',
            focused: document.activeElement?.id || ''
        }));
        if (!result.inlineError || !result.hint.includes('Ctrl+S') || result.focused !== 'tosysop-ed-subject') {
            errors.push(`Contact validation escaped the editor or overwrote the hint: ${JSON.stringify(result)}`);
        }
        console.log('✉️  Verified authenticated contact editor and inline validation.');
    } finally {
        await contactPage.close();
    }
}

async function verifyGameInlineValidation(page, errors) {
    // [LOG_ID: 20260829_1015] 오락실 입력 오류가 하단 명령 힌트바를 덮지 않고
    // 본문 프롬프트 위의 전용 오류 행으로 남는지 실제 브라우저에서 확인한다.
    const gamePage = await page.context().newPage();
    gamePage.setDefaultNavigationTimeout(config.TIMEOUT);
    gamePage.setDefaultTimeout(config.TIMEOUT);
    gamePage.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`[game validation] ${msg.text()}`);
    });
    gamePage.on('pageerror', (error) => {
        errors.push(`[game validation] ${error.message}`);
    });

    const cases = [
        { route: '/game/bio', value: '19900230', message: '생년월일 형식이 올바르지 않습니다.' },
        { route: '/game/fortune', value: '19900230', message: '생년월일 형식이 올바르지 않습니다.' },
        { route: '/game/tojeong', value: '19900230', message: '생년월일 형식이 올바르지 않습니다.' },
        { route: '/game/compat', value: '19900230', message: '생년월일 형식이 올바르지 않습니다.' },
        { route: '/game/mbti', prelude: '2', value: '99', message: '번호(1~16) 또는 유형코드' }
    ];

    try {
        for (const testCase of cases) {
            await gamePage.goto(`${config.BASE_URL}${testCase.route}`, { waitUntil: 'networkidle' });
            await gamePage.waitForTimeout(500);
            if (testCase.prelude) {
                const preludeInput = gamePage.locator('#cmd-input');
                await preludeInput.fill(testCase.prelude);
                await preludeInput.press('Enter');
                await gamePage.waitForTimeout(350);
            }
            const beforeHint = await gamePage.locator('#cmd-hint').textContent();
            const input = gamePage.locator('#cmd-input');
            await input.fill(testCase.value);
            await input.press('Enter');
            await gamePage.waitForTimeout(250);
            const result = await gamePage.evaluate(() => ({
                error: document.querySelector('.game-inline-validation')?.textContent || '',
                hint: document.querySelector('#cmd-hint')?.textContent || '',
                errorParent: document.querySelector('.game-inline-validation')?.parentElement?.id || '',
                screen: document.querySelector('#terminal-container')?.getAttribute('data-screen') || ''
            }));
            if (!result.error.includes(testCase.message)) {
                errors.push(`Game validation missing on ${testCase.route}: ${JSON.stringify(result)}`);
            }
            if (result.hint !== beforeHint || result.hint.includes(testCase.message)) {
                errors.push(`Game validation overwrote hint on ${testCase.route}: before=${JSON.stringify(beforeHint)}, after=${JSON.stringify(result.hint)}`);
            }
            if (!result.errorParent) {
                errors.push(`Game validation rendered outside a screen body on ${testCase.route}.`);
            }
        }
        console.log('🎮 Verified game validation stays inline and preserves the command hint.');
    } finally {
        await gamePage.close();
    }
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
