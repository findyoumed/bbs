/**
 * [LOG_ID: 20260801_1243] Memo E2E smoke tests.
 */
'use strict';

const path = require('path');
const { Readable } = require('stream');
const {
    config,
    fetchJsonResponse,
    hasNonEmptyText,
    loadBrowserHarnessModule,
    createHarnessScreenEl,
    ansiToHTMLHarnessStub,
    extractApiMessage
} = require('./common-utils');

async function verifyHttpMemoCoverage(errors) {
    console.log('📝 Checking memo API coverage via HTTP fallback...');
    const smokeUserId = `memo-fallback-${Date.now()}`;
    const authHeaders = {
        'x-bbs-user-id': smokeUserId,
        'x-bbs-nick-name': 'memo-smoke'
    };
    let createdMemoId = 0;

    async function expectJsonResponse(pathname, options, expectedStatus, errorMessage) {
        const response = await fetchJsonResponse(pathname, options);
        if (response.parseError) {
            throw new Error(`Invalid JSON at ${pathname}: ${response.parseError.message}`);
        }
        if (response.status !== expectedStatus) {
            throw new Error(`${errorMessage} (expected ${expectedStatus}, got ${response.status})`);
        }
        return response;
    }

    try {
        const memoListResponse = await fetchJsonResponse('/api/memos');
        if (memoListResponse.parseError) {
            errors.push(`Invalid JSON at /api/memos: ${memoListResponse.parseError.message}`);
            return;
        }
        if (memoListResponse.status === 200) {
            if (!Array.isArray(memoListResponse.data)) {
                errors.push('Memo list payload shape is invalid at /api/memos');
            }
        } else if (memoListResponse.status === 401) {
            if (!hasNonEmptyText(extractApiMessage(memoListResponse.payload))) {
                errors.push('Memo list unauthorized response is missing a message at /api/memos');
            }
        } else {
            errors.push(`Unexpected HTTP ${memoListResponse.status} at /api/memos`);
        }

        const unreadResponse = await fetchJsonResponse('/api/memos/unread/count');
        if (unreadResponse.parseError) {
            errors.push(`Invalid JSON at /api/memos/unread/count: ${unreadResponse.parseError.message}`);
            return;
        }
        if (unreadResponse.status === 200) {
            if (!unreadResponse.data || typeof unreadResponse.data.count !== 'number') {
                errors.push('Memo unread count payload shape is invalid at /api/memos/unread/count');
            }
        } else if (unreadResponse.status === 401) {
            if (!hasNonEmptyText(extractApiMessage(unreadResponse.payload))) {
                errors.push('Memo unread-count unauthorized response is missing a message at /api/memos/unread/count');
            }
        } else {
            errors.push(`Unexpected HTTP ${unreadResponse.status} at /api/memos/unread/count`);
        }

        const memoCreateResponse = await fetchJsonResponse('/api/memos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientUserId: 'fallback-target',
                title: 'memo fallback smoke',
                content: 'memo fallback coverage'
            })
        });
        if (memoCreateResponse.parseError) {
            errors.push(`Invalid JSON at POST /api/memos: ${memoCreateResponse.parseError.message}`);
            return;
        }

        if (memoCreateResponse.status === 201) {
            if (!hasNonEmptyText(memoCreateResponse.data?.recipientUserId) || !hasNonEmptyText(memoCreateResponse.data?.content)) {
                errors.push('Memo create payload shape is invalid at POST /api/memos');
            }
        } else if (memoCreateResponse.status === 401) {
            if (!hasNonEmptyText(extractApiMessage(memoCreateResponse.payload))) {
                errors.push('Memo create unauthorized response is missing a message at POST /api/memos');
            }
        } else {
            errors.push(`Unexpected HTTP ${memoCreateResponse.status} at POST /api/memos`);
        }

        const authedMemoListBefore = await expectJsonResponse('/api/memos', {
            headers: authHeaders
        }, 200, 'Authenticated memo list failed at /api/memos');
        if (!Array.isArray(authedMemoListBefore.data) || authedMemoListBefore.data.length !== 0) {
            errors.push('Authenticated memo list should start empty for the unique smoke user at /api/memos');
            return;
        }

        const authedUnreadBefore = await expectJsonResponse('/api/memos/unread/count', {
            headers: authHeaders
        }, 200, 'Authenticated unread-count failed at /api/memos/unread/count');
        if (!authedUnreadBefore.data || authedUnreadBefore.data.count !== 0) {
            errors.push('Authenticated memo unread count should start at 0 at /api/memos/unread/count');
            return;
        }

        const authedCreateResponse = await expectJsonResponse('/api/memos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
                recipientUserId: smokeUserId,
                title: 'memo auth fallback smoke',
                content: 'memo auth fallback coverage'
            })
        }, 201, 'Authenticated memo create failed at POST /api/memos');
        createdMemoId = Number(authedCreateResponse.data?.id || 0);

        if (!createdMemoId || authedCreateResponse.data?.recipientUserId !== smokeUserId || !hasNonEmptyText(authedCreateResponse.data?.content)) {
            errors.push('Authenticated memo create payload shape is invalid at POST /api/memos');
            return;
        }

        const directRouteResponse = await fetch(`${config.BASE_URL}/memo/${encodeURIComponent(createdMemoId)}`);
        const directRouteContent = await directRouteResponse.text();
        if (!directRouteResponse.ok) {
            errors.push(`HTTP ${directRouteResponse.status} at /memo/${createdMemoId}`);
            return;
        }
        if (!hasNonEmptyText(directRouteContent)) {
            errors.push(`Empty page content at /memo/${createdMemoId}`);
            return;
        }
        if (!directRouteContent.includes(config.APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at /memo/${createdMemoId}`);
        }
        if (!directRouteContent.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at /memo/${createdMemoId}`);
        }
        if (!directRouteContent.includes('id="cmd-input"')) {
            errors.push(`Command input missing at /memo/${createdMemoId}`);
        }

        const memoWriteRouteResponse = await fetch(`${config.BASE_URL}/memo/write`);
        const memoWriteRouteContent = await memoWriteRouteResponse.text();
        if (!memoWriteRouteResponse.ok) {
            errors.push(`HTTP ${memoWriteRouteResponse.status} at /memo/write`);
            return;
        }
        if (!hasNonEmptyText(memoWriteRouteContent)) {
            errors.push('Empty page content at /memo/write');
            return;
        }
        if (!memoWriteRouteContent.includes(config.APP_SHELL_MARKER)) {
            errors.push('App shell module entry missing at /memo/write');
        }
        if (!memoWriteRouteContent.includes('id="terminal-wrapper"')) {
            errors.push('Terminal wrapper missing at /memo/write');
        }
        if (!memoWriteRouteContent.includes('id="cmd-input"')) {
            errors.push('Command input missing at /memo/write');
        }

        const guestMemoDetailResponse = await expectJsonResponse(`/api/memos/${createdMemoId}`, {}, 401, `Guest memo detail should require auth at /api/memos/${createdMemoId}`);
        if (!hasNonEmptyText(extractApiMessage(guestMemoDetailResponse.payload))) {
            errors.push(`Guest memo detail unauthorized response is missing a message at /api/memos/${createdMemoId}`);
            return;
        }

        const guestMemoReadResponse = await expectJsonResponse(`/api/memos/${createdMemoId}/read`, {
            method: 'POST'
        }, 401, `Guest memo read should require auth at /api/memos/${createdMemoId}/read`);
        if (!hasNonEmptyText(extractApiMessage(guestMemoReadResponse.payload))) {
            errors.push(`Guest memo read unauthorized response is missing a message at /api/memos/${createdMemoId}/read`);
            return;
        }

        const guestMemoDeleteResponse = await expectJsonResponse(`/api/memos/${createdMemoId}`, {
            method: 'DELETE'
        }, 401, `Guest memo delete should require auth at /api/memos/${createdMemoId}`);
        if (!hasNonEmptyText(extractApiMessage(guestMemoDeleteResponse.payload))) {
            errors.push(`Guest memo delete unauthorized response is missing a message at /api/memos/${createdMemoId}`);
            return;
        }

        const authedMemoListAfterCreate = await expectJsonResponse('/api/memos', {
            headers: authHeaders
        }, 200, 'Authenticated memo list after create failed at /api/memos');
        if (!Array.isArray(authedMemoListAfterCreate.data) || !authedMemoListAfterCreate.data.some((memo) => Number(memo?.id) === createdMemoId)) {
            errors.push('Authenticated memo list did not include the created memo at /api/memos');
            return;
        }

        const authedUnreadAfterCreate = await expectJsonResponse('/api/memos/unread/count', {
            headers: authHeaders
        }, 200, 'Authenticated unread-count after create failed at /api/memos/unread/count');
        if (!authedUnreadAfterCreate.data || authedUnreadAfterCreate.data.count !== 1) {
            errors.push('Authenticated memo unread count should be 1 after create at /api/memos/unread/count');
            return;
        }

        const authedMemoDetail = await expectJsonResponse(`/api/memos/${createdMemoId}`, {
            headers: authHeaders
        }, 200, `Authenticated memo detail failed at /api/memos/${createdMemoId}`);
        if (Number(authedMemoDetail.data?.id) !== createdMemoId || authedMemoDetail.data?.recipientUserId !== smokeUserId) {
            errors.push(`Authenticated memo detail payload shape is invalid at /api/memos/${createdMemoId}`);
            return;
        }

        const authedReadResponse = await expectJsonResponse(`/api/memos/${createdMemoId}/read`, {
            method: 'POST',
            headers: authHeaders
        }, 200, `Authenticated memo read failed at /api/memos/${createdMemoId}/read`);
        if (authedReadResponse.data?.isRead !== true) {
            errors.push(`Authenticated memo read payload should mark the memo as read at /api/memos/${createdMemoId}/read`);
            return;
        }

        const authedUnreadAfterRead = await expectJsonResponse('/api/memos/unread/count', {
            headers: authHeaders
        }, 200, 'Authenticated unread-count after read failed at /api/memos/unread/count');
        if (!authedUnreadAfterRead.data || authedUnreadAfterRead.data.count !== 0) {
            errors.push('Authenticated memo unread count should return to 0 after read at /api/memos/unread/count');
            return;
        }

        const authedDeleteResponse = await expectJsonResponse(`/api/memos/${createdMemoId}`, {
            method: 'DELETE',
            headers: authHeaders
        }, 200, `Authenticated memo delete failed at /api/memos/${createdMemoId}`);
        if (Number(authedDeleteResponse.data?.id) !== createdMemoId) {
            errors.push(`Authenticated memo delete payload shape is invalid at /api/memos/${createdMemoId}`);
            return;
        }
        createdMemoId = 0;

        const authedMemoListAfterDelete = await expectJsonResponse('/api/memos', {
            headers: authHeaders
        }, 200, 'Authenticated memo list after delete failed at /api/memos');
        if (!Array.isArray(authedMemoListAfterDelete.data) || authedMemoListAfterDelete.data.some((memo) => Number(memo?.id) === Number(authedDeleteResponse.data?.id))) {
            errors.push('Authenticated memo list still contains the deleted memo at /api/memos');
        }
    } catch (error) {
        errors.push(error.message);
    } finally {
        if (createdMemoId) {
            try {
                await fetchJsonResponse(`/api/memos/${createdMemoId}`, {
                    method: 'DELETE',
                    headers: authHeaders
                });
            } catch (cleanupError) {
                errors.push(`Memo cleanup failed for /api/memos/${createdMemoId}: ${cleanupError.message}`);
            }
        }
    }
}

async function verifyContactSysopCoverage(errors) {
    console.log('Checking sysop contact internal memo coverage via route harness...');
    const handleContactRoutes = require('../../src/server/routeHandlers/contactRoutes');

    async function runScenario(mailShouldFail, mailConfigured = true) {
        const calls = [];
        const req = Readable.from([JSON.stringify({
            subject: 'contact smoke subject',
            content: 'contact smoke content'
        })]);
        req.method = 'POST';
        req.headers = {};
        req.socket = { remoteAddress: '127.0.0.1' };

        const response = {
            statusCode: 0,
            headersSent: false,
            payload: null,
            writeHead(statusCode) {
                this.statusCode = statusCode;
                this.headersSent = true;
            },
            end(rawPayload) {
                this.payload = JSON.parse(String(rawPayload || '{}'));
            }
        };

        await handleContactRoutes({
            req,
            res: response,
            requestUrl: new URL('http://localhost/api/contact-sysop'),
            authBridge: {
                resolveContext: async () => ({
                    userId: 'contact-smoke-user',
                    nickName: 'contact-smoke',
                    isGuest: false,
                    isAdmin: false
                })
            },
            activityRepository: null,
            memoRepository: {
                async createMemo(input, context) {
                    calls.push({ type: 'memo', input, context });
                    return { id: 701 };
                }
            },
            mailService: mailConfigured ? {
                async sendToSysop() {
                    calls.push({ type: 'mail' });
                    if (mailShouldFail) throw new Error('simulated Resend outage');
                    return { id: 'mail-701' };
                }
            } : null
        });

        return { calls, response };
    }

    try {
        const delivered = await runScenario(false);
        const deliveredData = delivered.response.payload?.data || {};
        if (delivered.response.statusCode !== 200 || deliveredData.internalMemoSaved !== true || deliveredData.emailSent !== true) {
            errors.push('Sysop contact success path did not report both internal memo and email delivery.');
        }
        if (delivered.calls.map((entry) => entry.type).join(',') !== 'memo,mail') {
            errors.push('Sysop contact must persist the internal memo before external delivery.');
        }
        if (delivered.calls[0]?.input?.recipientUserId !== 'sysop' || delivered.calls[0]?.input?.saveToSent !== false) {
            errors.push('Sysop contact internal memo target or sender-copy policy is incorrect.');
        }

        const failed = await runScenario(true);
        const failedData = failed.response.payload?.data || {};
        if (failed.response.statusCode !== 200 || failedData.internalMemoSaved !== true || failedData.emailSent !== false) {
            errors.push('Sysop contact must preserve internal memo success when external delivery fails.');
        }
        if (!failedData.emailDeliveryWarning) {
            errors.push('Sysop contact external delivery failure must be surfaced as a warning.');
        }

        const unconfigured = await runScenario(false, false);
        const unconfiguredData = unconfigured.response.payload?.data || {};
        if (unconfigured.response.statusCode !== 200 || unconfiguredData.internalMemoSaved !== true || unconfiguredData.emailSent !== false) {
            errors.push('Sysop contact must preserve internal memo success when email service is not configured.');
        }
        if (!unconfiguredData.emailDeliveryWarning) {
            errors.push('Missing sysop email service must be surfaced as a warning.');
        }
    } catch (error) {
        errors.push(`Sysop contact route harness failed: ${error.message}`);
    }
}

async function verifyMemoWriteCoverage(errors) {
    console.log('✉️ Checking memo write route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    class FakeElement {
        constructor(id, value = '') {
            this.id = id;
            this.value = value;
            this.listeners = new Map();
        }

        focus() {}

        addEventListener(type, handler) {
            this.listeners.set(type, handler);
        }
    }

    try {
        const moduleCache = new Map();
        const { createMemoScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/memoScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            user: {
                userId: 'memo-write-owner',
                nickName: 'memo-write-owner',
                isGuest: false
            },
            _currentMemoId: null,
            _memoTarget: ''
        };
        const screenEl = createHarnessScreenEl();
        const elements = new Map([
            ['memo-form', new FakeElement('memo-form')],
            ['m-cancel', new FakeElement('m-cancel')],
            ['m-target', new FakeElement('m-target')],
            ['m-content', new FakeElement('m-content')]
        ]);
        const updateRequests = [];
        let restoreTarget = null;
        let showMemoListCalls = 0;

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/memo/write',
                search: ''
            },
            history: {
                replaceState(_state, _title, nextUrl) {
                    const [pathname, query = ''] = String(nextUrl || '').split('?');
                    globalThis.window.location.pathname = pathname || '/memo/write';
                    globalThis.window.location.search = query ? `?${query}` : '';
                }
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
            getElementById(id) {
                return elements.get(id) || null;
            },
            querySelectorAll() {
                return [];
            }
        };

        const { buildURLForState } = createRoutingUrlBuilder({
            getAuthLeafRoutePath: () => '/',
            getMenuNodeRoutePath: () => '/',
            showPostList: async () => {},
            showPostView: async () => {},
            state
        });
        const memoScreens = createMemoScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            apiFetch: async () => {
                throw new Error('Memo write restore should not call auth-only memo APIs');
            },
            applyCommandFooter: async () => {},
            buildMemoListAnsi: () => '',
            buildMemoViewAnsi: () => '',
            cmdInput: { focus() {} },
            esc: escapeHtml,
            getSupportedFooterText: () => 'MEMO FOOTER',
            getMenuNodeByKey: () => ({ footer: 'MEMO FOOTER' }),
            screenEl,
            setHint: () => {},
            setPrompt: () => {},
            setLoading: () => {},
            state,
            updateURL: (replace = false) => {
                const nextUrl = buildURLForState();
                updateRequests.push({ replace, url: nextUrl });
                if (replace && globalThis.window?.history?.replaceState) {
                    globalThis.window.history.replaceState({ screen: state.screen }, '', nextUrl);
                }
            }
        });

        const restorer = createRoutingStateRestorer({
            getMenuNodeByKey: () => null,
            getMenuNodeKey: () => '',
            loadMenuTree: async () => {},
            logger: null,
            resolveMenuRoute: () => null,
            state,
            showBoardSelect: async () => {},
            showChatLobby: async () => {},
            showChatRoom: async () => {},
            showHelp: async () => {},
            showHistory: async () => {},
            showLogin: async () => {},
            showMain: async () => {
                state.screen = 'main';
            },
            showMemoList: async () => {
                showMemoListCalls += 1;
                state.screen = 'memo-list';
            },
            showMemoView: async (memoId) => {
                state.screen = 'memo-view';
                state._currentMemoId = memoId;
            },
            showMemoWrite: async (targetUserId = '') => {
                restoreTarget = targetUserId;
                return await memoScreens.showMemoWrite(targetUserId);
            },
            showMyInfo: async () => {},
            showNewsArticle: async () => {},
            showNewsList: async () => {},
            showNewsMenu: async () => {},
            showPasswordReset: async () => {},
            showAttachmentList: async () => {},
            showPostList: async () => {},
            showPostView: async () => {},
            showPostWrite: async () => {},
            showProfile: async () => {},
            showSignup: async () => {},
            showUnifiedPdsList: async () => {},
            showUnifiedPdsPost: async () => {},
            showWeatherMenu: async () => {},
            showWeatherView: async () => {},
            isUnifiedPdsBoardId: () => false
        });

        await restorer.restoreStateFromURL();

        if (restoreTarget !== '') {
            errors.push(`Memo write direct route did not invoke showMemoWrite('') for /memo/write (got ${String(restoreTarget)})`);
        }
        if (showMemoListCalls !== 0) {
            errors.push(`Memo write direct route incorrectly fell back to showMemoList() for /memo/write (got ${showMemoListCalls} calls)`);
        }
        if (state.screen !== 'memo-write') {
            errors.push('Memo write direct route did not restore state.screen="memo-write" for /memo/write');
        }
        if (state._memoTarget !== '') {
            errors.push(`Memo write direct route did not reset the memo target for /memo/write (got ${state._memoTarget})`);
        }
        // [LOG_ID: 20260801_1600] 20260801_1020에서 쪽지 쓰기 화면이 대화형 CLI 히스토리에서
        // 정통 폼 에디터(renderMemoBbsEditor)로 바뀌었다 — target이 빈 문자열이면 flow.stage가
        // 'target'이 되어 isInteractiveStage(card_select/letter_type/delay_minutes/send_cmd)에
        // 안 걸리고 곧장 폼 에디터가 렌더링되므로, 옛 CLI 문구("받는 사람 아이디를 입력하세요",
        // "쪽지 보내기") 대신 새 폼의 실제 마크업(입력창 placeholder, 상단바 제목)을 확인한다.
        if (!String(screenEl.innerHTML || '').includes('받는 사람 아이디')) {
            errors.push('Memo write direct route did not render the compose target field for /memo/write');
        }
        if (!String(screenEl.innerHTML || '').includes('편지 쓰기')) {
            errors.push('Memo write direct route did not render the compose title for /memo/write');
        }
        if (buildURLForState() !== '/memo/write') {
            errors.push(`Memo write URL builder did not stay in sync for memo-write state (got ${buildURLForState()})`);
        }
        if (!updateRequests.some((entry) => entry.replace === true && entry.url === '/memo/write')) {
            errors.push('Memo write direct route did not request replaceState URL sync for /memo/write');
        }
    } catch (error) {
        errors.push(`Memo write module harness failed: ${error.message}`);
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

// [LOG_ID: 20260801_1710] bbs-form stage guard 회귀 테스트 —
// handleMemoRawInput이 bbs-form 단계에서 cmdInput 입력을 받았을 때 flow.bodyLines를 수정하지
// 않음을 확인한다. 수정 전: bodyLines.push(line) + renderMemoWriteScreen() 호출로 textarea
// 내용이 덮어씌워졌다. 수정 후: return true로 소비만 하고 상태를 변경하지 않는다.
async function verifyMemoWriteFormGuard(errors) {
    console.log('🔒 Checking bbs-form stage guard in handleMemoRawInput...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    try {
        const moduleCache = new Map();
        const { createMemoScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/memoScreens.js'), moduleCache);

        const state = {
            screen: 'main',
            user: { userId: 'form-guard-tester', nickName: 'form-guard-tester', isGuest: false },
            _currentMemoId: null,
            _memoTarget: ''
        };
        const screenEl = createHarnessScreenEl();

        globalThis.window = { innerWidth: 1280 };
        // document.getElementById returns null for form element IDs (memo-ed-target / memo-ed-body)
        // so renderMemoBbsEditor returns early after setting flow.stage = 'bbs-form',
        // leaving flow._doCancel undefined — exactly the production condition we are guarding.
        globalThis.document = {
            getElementById() { return null; },
            querySelectorAll() { return []; }
        };

        const memoScreens = createMemoScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            apiFetch: async () => { throw new Error('apiFetch should not be called in this test'); },
            applyCommandFooter: async () => {},
            buildMemoListAnsi: () => '',
            buildMemoViewAnsi: () => '',
            cmdInput: { focus() {} },
            esc: escapeHtml,
            getSupportedFooterText: () => '',
            getMenuNodeByKey: () => null,
            screenEl,
            setHint: () => {},
            setPrompt: () => {},
            setLoading: () => {},
            setReady: () => {},
            state,
            updateURL: () => {}
        });

        await memoScreens.showMemoWrite('');

        if (state.screen !== 'memo-write') {
            errors.push(`[bbs-form guard] showMemoWrite did not set state.screen to memo-write (got ${state.screen})`);
            return;
        }
        if (!state._memoWriteFlow) {
            errors.push('[bbs-form guard] showMemoWrite did not create state._memoWriteFlow');
            return;
        }
        if (state._memoWriteFlow.stage !== 'bbs-form') {
            errors.push(`[bbs-form guard] Expected flow.stage=bbs-form after showMemoWrite, got ${state._memoWriteFlow.stage}`);
            return;
        }

        const bodyLinesBefore = state._memoWriteFlow.bodyLines.length;

        // Simulate user typing in cmdInput while bbs-form editor is visible and pressing Enter.
        // Before the fix this would have appended to flow.bodyLines and re-rendered the form,
        // overwriting any textarea content typed directly by the user.
        await memoScreens.handleMemoRawInput('accidental cmdInput text');

        if (state._memoWriteFlow.bodyLines.length !== bodyLinesBefore) {
            errors.push(`[bbs-form guard] handleMemoRawInput modified flow.bodyLines (${bodyLinesBefore} -> ${state._memoWriteFlow.bodyLines.length}). Textarea content would have been overwritten.`);
            return;
        }
        if (state.screen !== 'memo-write') {
            errors.push(`[bbs-form guard] handleMemoRawInput changed state.screen (expected memo-write, got ${state.screen})`);
            return;
        }

        // Also verify that an empty Enter (just pressing Enter without text) does not modify bodyLines.
        await memoScreens.handleMemoRawInput('');
        if (state._memoWriteFlow.bodyLines.length !== bodyLinesBefore) {
            errors.push(`[bbs-form guard] handleMemoRawInput('') modified flow.bodyLines in bbs-form stage`);
        }
    } catch (error) {
        errors.push(`[bbs-form guard] unexpected error: ${error.message}`);
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

// [LOG_ID: 20260829_1500] Historical Hitel mail types are the full 3-bit
// combination of secret, reply-required, and delayed delivery (1-8).
async function verifyMemoLetterTypes(errors) {
    console.log('✉️  Checking historical memo letter type matrix...');
    try {
        const moduleCache = new Map();
        const { LETTER_TYPES, buildMemoTitleTag } = loadBrowserHarnessModule(
            path.join(__dirname, '../..', 'public/js/core/memoScreens.js'), moduleCache
        );
        const expected = {
            1: { secret: false, replyRequired: false, delayed: false, tag: '' },
            2: { secret: true, replyRequired: false, delayed: false, tag: '[비밀] ' },
            3: { secret: false, replyRequired: true, delayed: false, tag: '[답장요망] ' },
            4: { secret: false, replyRequired: false, delayed: true, tag: '[지연:30분] ' },
            5: { secret: true, replyRequired: true, delayed: false, tag: '[비밀·답장요망] ' },
            6: { secret: true, replyRequired: false, delayed: true, tag: '[비밀·지연:30분] ' },
            7: { secret: false, replyRequired: true, delayed: true, tag: '[답장요망·지연:30분] ' },
            8: { secret: true, replyRequired: true, delayed: true, tag: '[비밀·답장요망·지연:30분] ' }
        };
        for (const [key, shape] of Object.entries(expected)) {
            const actual = LETTER_TYPES[Number(key)];
            if (!actual || actual.secret !== shape.secret || actual.replyRequired !== shape.replyRequired || actual.delayed !== shape.delayed) {
                errors.push(`[memo types] type ${key} does not match the historical flag matrix`);
                continue;
            }
            const tag = buildMemoTitleTag(Number(key), 30);
            if (tag !== shape.tag) errors.push(`[memo types] type ${key} tag mismatch: ${tag}`);
        }
    } catch (error) {
        errors.push(`[memo types] harness failed: ${error.message}`);
    }
}

module.exports = {
    verifyContactSysopCoverage,
    verifyHttpMemoCoverage,
    verifyMemoWriteCoverage,
    verifyMemoWriteFormGuard,
    verifyMemoLetterTypes
};
