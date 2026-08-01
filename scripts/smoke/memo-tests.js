/**
 * [LOG_ID: 20260801_1243] Memo E2E smoke tests.
 */
'use strict';

const path = require('path');
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

module.exports = {
    verifyHttpMemoCoverage,
    verifyMemoWriteCoverage
};
