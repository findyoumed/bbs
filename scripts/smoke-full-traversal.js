/**
 * smoke-full-traversal.js
 * [LOG: 20260428_1530] Playwright-based BBS Full Traversal Crawler.
 * - Automatically navigates all accessible pages.
 * - Detects console errors.
 * - Reports coverage and health.
 */
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { createAppRuntime } = require('../src/server/createAppRuntime');
const { getNavigation: getSupabaseBoardNavigation } = require('../src/server/SupabaseBoardRepositoryPostReads');

const HOST = '127.0.0.1';
// [LOG: 20260617_1005] Default to an ephemeral port so stale local servers cannot break traversal.
let PORT = Number(process.env.SMOKE_FULL_TRAVERSAL_PORT || 0);
let BASE_URL = `http://${HOST}:${PORT || 3002}`;
const TIMEOUT = 30000;
const TEST_ROUTES = [
    '/',
    '/help',
    '/history',
    '/pds',
    '/service/weather',
    '/service/news',
    '/chat',
    '/memo',
    '/myinfo',
    '/log/login',
    '/log/password',
    '/log/signup',
    '/log/signup/email',
    '/log/signup/agree',
    '/log/signup/profile',
    '/profile/smoke-route-user'
];
const APP_SHELL_MARKER = 'type="module" src="/js/app.js"';
const FALLBACK_MODULE_CHECKS = [
    {
        label: 'chat route module',
        path: '/js/core/chatScreens.js',
        expectedText: 'showChatLobby'
    },
    {
        label: 'chat command module',
        path: '/js/core/commandRouterChat.js',
        expectedText: "state.screen === 'chat-room'"
    },
    {
        label: 'chat room hydration module',
        path: '/js/core/chatScreens.js',
        expectedText: "apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`, { silent })"
    },
    {
        label: 'chat direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showChatRoom(decodeURIComponent(segments[1]), true);"
    },
    {
        label: 'chat direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/chat/${encodeURIComponent(_chatRoomId || '')}`;"
    },
    {
        label: 'board post-view menu hydration module',
        path: '/js/core/postViewView.js',
        expectedText: 'state.boardMenuPath = resolvedMenuPath;'
    },
    {
        label: 'board post-view navigation hydration module',
        path: '/js/core/postViewView.js',
        expectedText: 'state._postNavigation = data.navigation || null;'
    },
    {
        label: 'board adjacent navigation fallback module',
        path: '/js/core/postViewView.js',
        expectedText: 'const navigationTargetId = direction > 0 ? state._postNavigation?.nextId : state._postNavigation?.prevId;'
    },
    {
        label: 'board direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await showPostView(boardId, postId, true);'
    },
    {
        label: 'board direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${String(boardId || '').toUpperCase()}/${post?.id || ''}`;"
    },
    {
        label: 'unified pds list direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await showUnifiedPdsList(page, true);'
    },
    {
        label: 'unified pds post direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await showUnifiedPdsPost(postId, page, true);'
    },
    {
        label: 'unified pds direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/pds/${post?.id || ''}${pdsPageQuery}`;"
    },
    {
        label: 'board write direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardWrite(boardId, page);'
    },
    {
        label: 'board edit direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardEdit(boardId, postId);'
    },
    {
        label: 'board reply direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardReply(boardId, postId);'
    },
    {
        label: 'board create direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${uppercaseBoardId}/write`;"
    },
    {
        label: 'board edit direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${uppercaseBoardId}/${post.id}/edit`;"
    },
    {
        label: 'board reply direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${uppercaseBoardId}/${post.id}/reply`;"
    },
    {
        label: 'board post-write screen module',
        path: '/js/core/postWriteView.js',
        expectedText: "state.screen = 'post-write';"
    },
    {
        label: 'board attachment direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showAttachmentList(boardId, postId, true);"
    },
    {
        label: 'board attachment list screen module',
        path: '/js/core/postScreens.js',
        expectedText: "state.screen = 'attachment-list';"
    },
    {
        label: 'board attachment command module',
        path: '/js/core/commandRouterPostView.js',
        expectedText: "await downloadAttachment(state.board.id, state.post.id, file.id, file.originalFilename || file.filename);"
    },
    {
        label: 'board attachment screen wiring',
        path: '/js/core/appFactoryScreens.js',
        expectedText: 'loadAttachments: postService.loadAttachments'
    },
    {
        label: 'board attachment command wiring',
        path: '/js/core/appFactoryHandlers.js',
        expectedText: 'showAttachmentList: screens.postScreens.showAttachmentList'
    },
    {
        label: 'board attachment download wiring',
        path: '/js/core/appFactoryHandlers.js',
        expectedText: 'downloadAttachment: services.postService.downloadAttachment'
    },
    {
        label: 'memo route module',
        path: '/js/core/memoScreens.js',
        expectedText: 'showMemoList'
    },
    {
        label: 'memo write screen module',
        path: '/js/core/memoScreens.js',
        expectedText: "state.screen = 'memo-write';"
    },
    {
        label: 'help route module',
        path: '/js/core/helpScreens.js',
        expectedText: "state.screen = 'help';"
    },
    {
        label: 'help direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "await showHelp('', { fromHistory: true, page });"
    },
    {
        label: 'help direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return helpPage > 1 ? `/help?page=${encodeURIComponent(helpPage)}` : '/help';"
    },
    {
        label: 'history route module',
        path: '/js/core/helpScreens.js',
        expectedText: "state.screen = 'history';"
    },
    {
        label: 'history direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await showHistory(true);'
    },
    {
        label: 'memo command module',
        path: '/js/core/commandRouterMemo.js',
        expectedText: "state.screen === 'memo-write'"
    },
    {
        label: 'memo direct-view hydration module',
        path: '/js/core/memoScreens.js',
        expectedText: 'state._currentMemoId = hydratedMemo.id ?? memoId;'
    },
    {
        label: 'memo direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showMemoView(decodeURIComponent(segments[1]), true);"
    },
    {
        label: 'memo write direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showMemoWrite('');"
    },
    {
        label: 'memo direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/memo/${encodeURIComponent(_currentMemoId || '')}`;"
    },
    {
        label: 'memo write direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return '/memo/write';"
    },
    {
        label: 'memo reply context command',
        path: '/js/core/commandRouterMemo.js',
        expectedText: "String(m?.id) === String(state._currentMemoId)"
    },
    {
        label: 'myinfo renderer module',
        path: '/js/core/myInfoRenderer.js',
        expectedText: 'renderMyInfo'
    },
    {
        label: 'myinfo action module',
        path: '/js/core/myInfoActions.js',
        expectedText: 'submitPasswordChange'
    },
    {
        label: 'myinfo command module',
        path: '/js/core/commandRouterMyInfo.js',
        expectedText: "state.screen === 'myinfo'"
    },
    {
        label: 'auth recovery route helper',
        path: '/js/core/menuService.js',
        expectedText: 'function isPasswordResetRoutePath(pathname)'
    },
    {
        label: 'auth recovery route wiring',
        path: '/js/core/appFactoryServices.js',
        expectedText: 'isPasswordResetRoutePath: menuService.isPasswordResetRoutePath'
    },
    {
        label: 'auth entry direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'async log(segments)'
    },
    {
        label: 'signup oauth profile module',
        path: '/js/core/signupModule.js',
        expectedText: "state._signupFlow === 'oauth-profile'"
    },
    {
        label: 'profile route module',
        path: '/js/core/profileScreens.js',
        expectedText: "state.screen = 'profile';"
    },
    {
        label: 'profile direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await showProfile(userId, true);'
    },
    {
        label: 'profile direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/profile/${encodeURIComponent(_profileUserId || '')}`;"
    },
    {
        label: 'weather route module',
        path: '/js/core/weatherScreens.js',
        expectedText: 'showWeatherView'
    },
    {
        label: 'weather direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showWeatherView(param, { fromHistory: true, pageNo: page });"
    },
    {
        label: 'weather direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/service/weather/${serviceData?.regionDoor || ''}${weatherPageQuery}`;"
    },
    {
        label: 'active-users screen module',
        path: '/js/core/systemScreens.js',
        expectedText: 'showActiveUsers'
    },
    {
        label: 'active-users global command module',
        path: '/js/core/commandRouterGlobalNavigation.js',
        expectedText: "cmd === 'USER' || cmd === 'WHO' || cmd === 'WH' || (cmd === 'W' && !isWriteConflictScreen)"
    },
    {
        label: 'system-diagnostics screen module',
        path: '/js/core/systemScreens.js',
        expectedText: "state.screen = 'system-diagnostics';"
    },
    {
        label: 'system-diagnostics ansi module',
        path: '/js/core/systemAnsiBuilders.js',
        expectedText: "centerLabel: '시스템 진단 및 정보 (SYSINFO)'"
    },
    {
        label: 'system-diagnostics global runtime module',
        path: '/js/core/commandRouterGlobalRuntime.js',
        expectedText: "cmd === 'SYSINFO' || cmd === 'DIAG'"
    },
    {
        label: 'activity-summary screen module',
        path: '/js/core/systemScreens.js',
        expectedText: "state.screen = 'activity-summary';"
    },
    {
        label: 'activity-summary ansi module',
        path: '/js/core/systemAnsiBuilders.js',
        expectedText: "centerLabel: '최근 활동 요약 (ACTIVITY SUMMARY)'"
    },
    {
        label: 'activity-summary global runtime module',
        path: '/js/core/commandRouterGlobalRuntime.js',
        expectedText: "cmd === 'ACT' || cmd === 'ACTIVITY'"
    },
    {
        label: 'performance service module',
        path: '/js/core/performanceService.js',
        expectedText: 'stateSizeKb'
    },
    {
        label: 'performance global runtime module',
        path: '/js/core/commandRouterGlobalRuntime.js',
        expectedText: "cmd === 'PERF'"
    },
    {
        label: 'news route module',
        path: '/js/core/newsScreens.js',
        expectedText: 'showNewsArticle'
    },
    {
        label: 'news list direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showNewsList(param, { fromHistory: true, pageNo: page });"
    },
    {
        label: 'news article direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showNewsArticle(param, articleNo, { fromHistory: true, pageNo: page });"
    },
    {
        label: 'news list direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/service/news/${serviceData?.topicDoor || ''}${pageQuery}`;"
    },
    {
        label: 'news article direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/service/news/${serviceData?.topicDoor || ''}?article=${encodeURIComponent(serviceData?.articleNo || '')}${pageParam}`;"
    },
    {
        label: 'theme command module',
        path: '/js/core/themeService.js',
        expectedText: 'toggleTheme'
    },
    {
        label: 'syslog command module',
        path: '/js/core/systemLogScreens.js',
        expectedText: 'showSystemLog'
    },
    {
        label: 'global runtime router',
        path: '/js/core/commandRouterGlobalRuntime.js',
        expectedText: "cmd === 'SYSLOG'"
    }
];

async function isServerRunning(url) {
    try {
        const res = await fetch(url);
        return res.ok || res.status === 404 || res.status === 302;
    } catch (e) {
        return false;
    }
}

async function startServer() {
    if (PORT > 0 && await isServerRunning(BASE_URL)) {
        console.log(`ℹ️  Server is already running on ${BASE_URL}.`);
        return {
            startedHere: false,
            close: async () => {}
        };
    }

    const rootDir = path.resolve(__dirname, '..');
    const env = {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(PORT)
    };
    const app = createAppRuntime({ rootDir, env });
    const server = http.createServer(app.requestHandler);

    await new Promise((resolve, reject) => {
        const handleError = (error) => {
            server.off('listening', handleListening);
            reject(error);
        };
        const handleListening = () => {
            server.off('error', handleError);
            resolve();
        };

        server.once('error', handleError);
        server.listen(PORT, HOST, handleListening);
    });
    PORT = server.address().port;
    BASE_URL = `http://${HOST}:${PORT}`;

    return {
        startedHere: true,
        close: async () => {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });

            await app.shutdown();
        }
    };
}

async function stopServer(serverHandle) {
    if (!serverHandle || typeof serverHandle.close !== 'function') {
        return;
    }

    await serverHandle.close();
    if (serverHandle.startedHere) {
        console.log('🛑 Server stopped.');
    } else {
        console.log('ℹ️  Reused existing server instance.');
    }
}

function isBrowserLaunchBlocked(error) {
    const message = String(error?.message || error || '');
    // [LOG_ID: 20260725_1900] 'spawn EPERM'(샌드박스가 프로세스 생성 차단)만 폴백 대상이었는데,
    // 설치된 브라우저 버전이 playwright 핀 버전과 어긋난 환경에서는 "Executable doesn't exist"로
    // 실패해 — 폴백이 있는데도 — 테스트가 통째로 실패 처리됐다. 바이너리 부재도 "이 환경에서
    // 브라우저를 못 띄우는 경우"이므로 동일하게 HTTP 폴백을 태운다.
    return message.includes('spawn EPERM')
        || message.includes("Executable doesn't exist")
        || message.includes('npx playwright install');
}

function hasNonEmptyText(value) {
    return String(value || '').trim().length > 0;
}

function extractApiData(payload) {
    return payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')
        ? payload.data
        : payload;
}

function extractApiMessage(payload) {
    if (!payload || typeof payload !== 'object') {
        return typeof payload === 'string' ? payload : '';
    }

    if (hasNonEmptyText(payload.message)) {
        return String(payload.message).trim();
    }

    if (hasNonEmptyText(payload.error?.message)) {
        return String(payload.error.message).trim();
    }

    return '';
}

function extractBoardItems(payload) {
    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.posts)) {
        return payload.posts;
    }

    return Array.isArray(payload) ? payload : [];
}

function extractBoardId(board) {
    return String(board?.boardId || board?.id || '').trim();
}

async function fetchJsonResponse(pathname, options = {}) {
    const response = await fetch(`${BASE_URL}${pathname}`, options);
    const rawText = await response.text();

    let payload;
    let parseError = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
        payload = rawText;
        parseError = error;
    }

    return {
        ok: response.ok,
        status: response.status,
        payload,
        data: extractApiData(payload),
        parseError
    };
}

async function fetchJsonData(pathname, options = {}) {
    const response = await fetchJsonResponse(pathname, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} at ${pathname}`);
    }
    if (response.parseError) {
        throw new Error(`Invalid JSON at ${pathname}: ${response.parseError.message}`);
    }
    return response.data;
}

async function resolveBoardDirectRouteTarget() {
    const boards = await fetchJsonData('/api/boards');

    if (!Array.isArray(boards)) {
        throw new Error('Boards payload shape is invalid at /api/boards');
    }

    for (const board of boards) {
        const boardId = extractBoardId(board);
        if (!boardId) {
            continue;
        }

        const boardListResponse = await fetchJsonResponse(`/api/boards/${encodeURIComponent(boardId)}?page=1`);
        if (!boardListResponse.ok || boardListResponse.parseError) {
            continue;
        }

        const boardItems = extractBoardItems(boardListResponse.data);
        const firstPostId = String(boardItems[0]?.id || '').trim();
        if (!firstPostId) {
            continue;
        }

        return {
            boardId,
            boardList: boardListResponse.data,
            postId: firstPostId
        };
    }

    throw new Error('No accessible board post found for /board/:boardId/:postId fallback coverage');
}

async function resolveUnifiedPdsDirectRouteTarget() {
    const boardListResponse = await fetchJsonResponse('/api/boards/pds?page=1');

    if (!boardListResponse.ok) {
        throw new Error(`Unified PDS list failed at /api/boards/pds?page=1 (got ${boardListResponse.status})`);
    }

    if (boardListResponse.parseError) {
        throw new Error(`Invalid JSON at /api/boards/pds?page=1: ${boardListResponse.parseError.message}`);
    }

    if (extractBoardId(boardListResponse.data?.board) !== 'pds') {
        throw new Error('Unified PDS board payload shape is invalid at /api/boards/pds?page=1');
    }

    const boardItems = extractBoardItems(boardListResponse.data);
    return {
        boardList: boardListResponse.data,
        postId: String(boardItems[0]?.id || '').trim()
    };
}

// [LOG: 20260429_0508] Keep non-threaded board prev/next semantics covered even
// when live data uses threaded boards or Playwright is blocked.
async function verifyBoardNavigationSemantics(errors) {
    console.log('🧭 Checking board navigation semantics via server harness...');

    class FakeNavigationQuery {
        constructor(rows) {
            this.rows = rows.map((row) => ({ ...row }));
            this.filters = [];
            this.orders = [];
            this.maxRows = null;
        }

        select() {
            return this;
        }

        eq(column, value) {
            this.filters.push((row) => String(row?.[column]) === String(value));
            return this;
        }

        in(column, values) {
            const allowed = new Set((values || []).map((value) => String(value)));
            this.filters.push((row) => allowed.has(String(row?.[column])));
            return this;
        }

        lt(column, value) {
            this.filters.push((row) => Number(row?.[column]) < Number(value));
            return this;
        }

        gt(column, value) {
            this.filters.push((row) => Number(row?.[column]) > Number(value));
            return this;
        }

        order(column, { ascending }) {
            this.orders.push({ column, ascending: Boolean(ascending) });
            return this;
        }

        limit(count) {
            this.maxRows = Number(count);
            return this;
        }

        finalize() {
            let result = this.rows.slice();

            for (const filter of this.filters) {
                result = result.filter(filter);
            }

            for (let index = this.orders.length - 1; index >= 0; index -= 1) {
                const { column, ascending } = this.orders[index];
                result.sort((left, right) => {
                    const leftValue = Number(left?.[column]);
                    const rightValue = Number(right?.[column]);
                    return ascending ? leftValue - rightValue : rightValue - leftValue;
                });
            }

            if (Number.isFinite(this.maxRows)) {
                result = result.slice(0, this.maxRows);
            }

            return result;
        }

        maybeSingle() {
            const result = this.finalize();
            return Promise.resolve({ data: result[0] || null, error: null });
        }

        then(resolve, reject) {
            return Promise.resolve({ data: this.finalize(), error: null }).then(resolve, reject);
        }
    }

    try {
        const rows = [
            { id: 5, board_id: 'plaza' },
            { id: 4, board_id: 'plaza' },
            { id: 3, board_id: 'plaza' }
        ];
        const repo = {
            tables: { posts: 'posts' },
            client: {
                from() {
                    return new FakeNavigationQuery(rows);
                }
            }
        };
        const navigation = await getSupabaseBoardNavigation(repo, 'plaza', 4);

        if (navigation.latestId !== 5 || navigation.prevId !== 5 || navigation.nextId !== 3) {
            errors.push(`Board non-threaded navigation is reversed (expected latest/prev/next 5/5/3, got ${navigation.latestId}/${navigation.prevId}/${navigation.nextId})`);
        }
    } catch (error) {
        errors.push(`Board navigation semantics check failed: ${error.message}`);
    }
}

// [LOG: 20260428_2332] HTTP fallback도 /chat route의 room/message API와 모듈 진입점을 확인해
// Playwright 불가 환경에서 채팅 shell-only PASS를 줄인다.
// [LOG: 20260429_0031] Keep /chat/:roomNo direct-route shell and room API coverage in fallback
// so direct room entry/reload regressions are not left to Playwright-only checks.
async function verifyHttpChatCoverage(errors) {
    console.log('💬 Checking chat API coverage via HTTP fallback...');
    const directRouteSessionKey = `chat-direct-fallback-${Date.now()}`;
    const directRouteHeaders = {
        'Content-Type': 'application/json',
        'x-bbs-user-id': `chat-fallback-${Date.now()}`,
        'x-bbs-nick-name': 'chat-fallback'
    };
    const smokeMessage = `chat-direct-fallback-${Date.now()}`;
    let joinedRoomNo = '';

    try {
        const chatRooms = await fetchJsonData('/api/chat/rooms');

        if (!Array.isArray(chatRooms)) {
            errors.push('Chat rooms payload shape is invalid at /api/chat/rooms');
            return;
        }

        if (chatRooms.length === 0) {
            errors.push('Chat rooms returned zero rooms at /api/chat/rooms');
            return;
        }

        const firstRoomNo = String(chatRooms[0]?.no || '').trim();
        if (!firstRoomNo) {
            errors.push('First chat room is missing a room number');
            return;
        }

        if (!hasNonEmptyText(chatRooms[0]?.title)) {
            errors.push(`Chat room title is empty at /api/chat/rooms (${firstRoomNo})`);
            return;
        }

        const directRouteResponse = await fetch(`${BASE_URL}/chat/${encodeURIComponent(firstRoomNo)}`);
        const directRouteContent = await directRouteResponse.text();
        if (!directRouteResponse.ok) {
            errors.push(`HTTP ${directRouteResponse.status} at /chat/${firstRoomNo}`);
            return;
        }

        if (!hasNonEmptyText(directRouteContent)) {
            errors.push(`Empty page content at /chat/${firstRoomNo}`);
            return;
        }

        if (!directRouteContent.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at /chat/${firstRoomNo}`);
        }

        if (!directRouteContent.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at /chat/${firstRoomNo}`);
        }

        if (!directRouteContent.includes('id="cmd-input"')) {
            errors.push(`Command input missing at /chat/${firstRoomNo}`);
        }

        const joinResponse = await fetchJsonResponse(`/api/chat/rooms/${encodeURIComponent(firstRoomNo)}/join`, {
            method: 'POST',
            headers: directRouteHeaders,
            body: JSON.stringify({ sessionKey: directRouteSessionKey })
        });
        if (joinResponse.parseError) {
            errors.push(`Invalid JSON at /api/chat/rooms/${firstRoomNo}/join: ${joinResponse.parseError.message}`);
            return;
        }
        if (joinResponse.status !== 200) {
            errors.push(`Chat room join failed at /api/chat/rooms/${firstRoomNo}/join (expected 200, got ${joinResponse.status})`);
            return;
        }
        if (String(joinResponse.data?.no || '') !== firstRoomNo || !hasNonEmptyText(joinResponse.data?.title || joinResponse.data?.name)) {
            errors.push(`Chat room join payload shape is invalid at /api/chat/rooms/${firstRoomNo}/join`);
            return;
        }
        joinedRoomNo = firstRoomNo;

        const sendResponse = await fetchJsonResponse(`/api/chat/rooms/${encodeURIComponent(firstRoomNo)}/messages`, {
            method: 'POST',
            headers: directRouteHeaders,
            body: JSON.stringify({
                content: smokeMessage,
                sessionKey: directRouteSessionKey
            })
        });
        if (sendResponse.parseError) {
            errors.push(`Invalid JSON at /api/chat/rooms/${firstRoomNo}/messages: ${sendResponse.parseError.message}`);
            return;
        }
        if (sendResponse.status !== 201) {
            errors.push(`Chat room message create failed at /api/chat/rooms/${firstRoomNo}/messages (expected 201, got ${sendResponse.status})`);
            return;
        }
        if (sendResponse.data?.content !== smokeMessage) {
            errors.push(`Chat room message payload shape is invalid at /api/chat/rooms/${firstRoomNo}/messages`);
            return;
        }

        const chatMessages = await fetchJsonData(`/api/chat/rooms/${encodeURIComponent(firstRoomNo)}/messages`);
        if (!Array.isArray(chatMessages)) {
            errors.push(`Chat messages payload shape is invalid at /api/chat/rooms/${firstRoomNo}/messages`);
            return;
        }

        if (!chatMessages.some((message) => String(message?.content || '') === smokeMessage)) {
            errors.push(`Chat messages did not include the fallback smoke message at /api/chat/rooms/${firstRoomNo}/messages`);
            return;
        }

        const leaveResponse = await fetchJsonResponse(`/api/chat/rooms/${encodeURIComponent(firstRoomNo)}/leave`, {
            method: 'POST',
            headers: directRouteHeaders,
            body: JSON.stringify({ sessionKey: directRouteSessionKey })
        });
        if (leaveResponse.parseError) {
            errors.push(`Invalid JSON at /api/chat/rooms/${firstRoomNo}/leave: ${leaveResponse.parseError.message}`);
            return;
        }
        if (leaveResponse.status !== 200) {
            errors.push(`Chat room leave failed at /api/chat/rooms/${firstRoomNo}/leave (expected 200, got ${leaveResponse.status})`);
            return;
        }
        joinedRoomNo = '';
    } catch (error) {
        errors.push(error.message);
    } finally {
        if (joinedRoomNo) {
            try {
                await fetchJsonResponse(`/api/chat/rooms/${encodeURIComponent(joinedRoomNo)}/leave`, {
                    method: 'POST',
                    headers: directRouteHeaders,
                    body: JSON.stringify({ sessionKey: directRouteSessionKey })
                });
            } catch (cleanupError) {
                errors.push(`Chat room cleanup failed at /api/chat/rooms/${joinedRoomNo}/leave: ${cleanupError.message}`);
            }
        }
    }
}

// [LOG: 20260429_0531] When Playwright is blocked, keep the remaining chat
// history snapshot path covered so stale circular serviceData cannot crash
// direct room entry or hide behind HTTP-only API checks.
async function verifyChatHistorySnapshotCoverage(errors) {
    console.log('💬 Checking chat history snapshot coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const originalConsoleError = console.error;

    try {
        const moduleCache = new Map();
        const { createChatScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/chatScreens.js'), moduleCache);

        const circularServiceData = {};
        circularServiceData.self = circularServiceData;

        const state = {
            screen: 'news-view',
            page: 2,
            history: [],
            serviceData: circularServiceData,
            user: {
                userId: 'chat-history-user',
                nickName: 'chat-history-user'
            }
        };
        const screenEl = {
            innerHTML: '',
            parentElement: {
                classList: {
                    add() {},
                    remove() {}
                }
            },
            querySelector() {
                return null;
            }
        };
        const updateRequests = [];
        const pollIntervals = [];
        const capturedConsoleErrors = [];

        globalThis.window = {
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.setInterval = (handler, delay) => {
            pollIntervals.push({ handler, delay });
            return pollIntervals.length;
        };
        globalThis.clearInterval = () => {};
        console.error = (...args) => {
            capturedConsoleErrors.push(args.map((value) => String(value)).join(' '));
        };

        const chatScreens = createChatScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            apiFetch: async (pathname) => {
                if (pathname === '/api/chat/rooms/1/join') {
                    return { no: '1', title: '스모크방', userCount: 1 };
                }
                if (pathname === '/api/chat/rooms/1/messages') {
                    return [];
                }
                if (pathname === '/api/chat/rooms') {
                    return [{ no: '1', id: '1', title: '스모크방' }];
                }
                if (pathname === '/api/system/active-users') {
                    return [];
                }
                throw new Error(`Unexpected chat harness path: ${pathname}`);
            },
            applyCommandFooter: async () => {},
            buildChatLobbyAnsi: () => ({
                text: [
                    'BBS',
                    'CHAT',
                    '',
                    '',
                    'CHAT LOBBY'
                ].join('\n')
            }),
            buildChatRoomAnsi: (room, messages) => ({
                text: [
                    'BBS',
                    'CHAT ROOM',
                    '',
                    '',
                    `ROOM: ${room?.title || '대화실'}`,
                    `MESSAGES: ${(messages || []).length}`,
                    '/Q'
                ].join('\n')
            }),
            cmdInput: { focus() {} },
            getCommandFooterText: () => 'CHAT FOOTER',
            getMenuNodeByKey: () => ({ footer: 'CHAT FOOTER' }),
            screenEl,
            setPrompt: () => {},
            state,
            updateURL: () => {
                updateRequests.push({
                    screen: state.screen,
                    roomId: state._chatRoomId || ''
                });
            }
        });

        await chatScreens.showChatRoom('1');

        if (state.screen !== 'chat-room') {
            errors.push('Chat history snapshot harness did not keep state.screen="chat-room" after direct room entry');
        }
        if (String(state._chatRoomId || '') !== '1') {
            errors.push(`Chat history snapshot harness did not keep _chatRoomId in sync (got ${String(state._chatRoomId || '') || 'empty'})`);
        }
        if (state.history.length !== 1) {
            errors.push(`Chat history snapshot harness did not push exactly one history entry (got ${state.history.length})`);
        }
        if (state.history[0]?.serviceData !== null) {
            errors.push('Chat history snapshot harness did not fail closed to null for circular stale serviceData');
        }
        if (!capturedConsoleErrors.some((entry) => entry.includes('채팅 히스토리 serviceData 스냅샷 실패:'))) {
            errors.push('Chat history snapshot harness did not surface the expected fail-closed console error');
        }
        if (updateRequests.length !== 1 || updateRequests[0]?.roomId !== '1') {
            errors.push(`Chat history snapshot harness did not request one URL sync for room 1 (got ${JSON.stringify(updateRequests)})`);
        }
        if (pollIntervals.length !== 1 || pollIntervals[0]?.delay !== 3000) {
            errors.push(`Chat history snapshot harness did not start the expected 3000ms poll timer (got ${JSON.stringify(pollIntervals)})`);
        }
        if (!String(screenEl.innerHTML || '').includes('ROOM: 스모크방')) {
            errors.push('Chat history snapshot harness did not render the hydrated room title');
        }
        if (!Array.isArray(state._chatMessages) || state._chatMessages.length !== 0) {
            errors.push('Chat history snapshot harness did not hydrate the room messages as an empty array');
        }
    } catch (error) {
        errors.push(`Chat history snapshot module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        if (typeof originalSetInterval === 'undefined') {
            delete globalThis.setInterval;
        } else {
            globalThis.setInterval = originalSetInterval;
        }
        if (typeof originalClearInterval === 'undefined') {
            delete globalThis.clearInterval;
        } else {
            globalThis.clearInterval = originalClearInterval;
        }
        console.error = originalConsoleError;
    }
}

// [LOG: 20260429_0634] Unified PDS detail URLs must keep ?page=N so later-page
// reloads do not silently fall back to page 1 context in spawn EPERM environments.
async function verifyHttpUnifiedPdsCoverage(errors) {
    console.log('🗂️ Checking unified PDS route coverage via HTTP fallback...');

    async function expectAppShell(pathname) {
        const response = await fetch(`${BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${pathname}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${pathname}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${pathname}`);
        }
    }

    try {
        const { postId } = await resolveUnifiedPdsDirectRouteTarget();

        await expectAppShell('/pds');
        if (!hasNonEmptyText(postId)) {
            return;
        }
        await expectAppShell(`/pds/${encodeURIComponent(postId)}?page=2`);

        const detailResponse = await fetchJsonResponse(`/api/boards/pds/posts/${encodeURIComponent(postId)}?view=1`);
        if (detailResponse.status === 404) {
            return;
        }
        if (detailResponse.parseError) {
            errors.push(`Invalid JSON at /api/boards/pds/posts/${postId}?view=1: ${detailResponse.parseError.message}`);
            return;
        }
        if (detailResponse.status !== 200) {
            errors.push(`Unified PDS detail failed at /api/boards/pds/posts/${postId}?view=1 (expected 200, got ${detailResponse.status})`);
            return;
        }
        if (extractBoardId(detailResponse.data?.board) !== 'pds' || String(detailResponse.data?.post?.id || '') !== postId) {
            errors.push(`Unified PDS detail payload shape is invalid at /api/boards/pds/posts/${postId}?view=1`);
            return;
        }
        if (!hasNonEmptyText(detailResponse.data?.post?.title) && !hasNonEmptyText(detailResponse.data?.post?.content)) {
            errors.push(`Unified PDS detail is empty at /api/boards/pds/posts/${postId}?view=1`);
        }
    } catch (error) {
        errors.push(error.message);
    }
}

// [LOG: 20260429_0634] Keep unified PDS later-page detail reload covered even
// when Playwright cannot exercise /pds/:postId?page=N directly in a browser.
async function verifyUnifiedPdsCoverage(errors) {
    console.log('🗂️ Checking unified PDS route coverage via module harness...');

    const originalWindow = globalThis.window;

    try {
        const moduleCache = new Map();
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            page: 1,
            board: null,
            post: null,
            boardMenuPath: 'top',
            boardMenuTitle: '자료실'
        };
        const pushedUrls = [];

        const routingUrlBuilder = createRoutingUrlBuilder({
            getAuthLeafRoutePath: () => '/log/login',
            getMenuNodeRoutePath: () => '/',
            showPostList: async (boardId, page = 1, options = {}, fromHistory = false) => {
                state.screen = 'post-list';
                state.board = { ...(state.board || {}), id: boardId, boardId };
                state.page = page;
                state.boardMenuPath = options.menuPath || state.boardMenuPath || 'top';
                state.boardMenuTitle = options.menuTitle || state.boardMenuTitle || '자료실';
                if (!fromHistory) {
                    pushedUrls.push(routingUrlBuilder.buildURLForState());
                }
            },
            showPostView: async (boardId, postId, fromHistory = false) => {
                state.screen = 'post-view';
                state.board = { ...(state.board || {}), id: boardId, boardId };
                state.post = { ...(state.post || {}), id: postId };
                if (!fromHistory) {
                    pushedUrls.push(routingUrlBuilder.buildURLForState());
                }
            },
            state
        });
        const { buildURLForState, showUnifiedPdsList, showUnifiedPdsPost } = routingUrlBuilder;

        await showUnifiedPdsList(2);
        const listPageTwoUrl = '/pds?page=2';
        if (state.screen !== 'post-list') {
            errors.push('Unified PDS list screen did not activate state.screen="post-list" when navigating to page 2');
        }
        if (state.page !== 2) {
            errors.push(`Unified PDS list screen did not keep page 2 state (got ${state.page})`);
        }
        if (buildURLForState() !== listPageTwoUrl) {
            errors.push(`Unified PDS list URL builder did not keep page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== listPageTwoUrl) {
            errors.push(`Unified PDS list navigation did not request ${listPageTwoUrl}`);
        }

        pushedUrls.length = 0;
        await showUnifiedPdsPost('123', 2);
        const detailPageTwoUrl = '/pds/123?page=2';
        if (state.screen !== 'post-view') {
            errors.push('Unified PDS detail screen did not activate state.screen="post-view" for page 2 detail navigation');
        }
        if (state.page !== 2) {
            errors.push(`Unified PDS detail screen did not preserve page 2 state (got ${state.page})`);
        }
        if (String(state.post?.id || '') !== '123') {
            errors.push(`Unified PDS detail screen did not keep post.id in sync (got ${String(state.post?.id || '') || 'empty'})`);
        }
        if (buildURLForState() !== detailPageTwoUrl) {
            errors.push(`Unified PDS detail URL builder did not keep page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== detailPageTwoUrl) {
            errors.push(`Unified PDS detail navigation did not request ${detailPageTwoUrl}`);
        }

        let restoredListArgs = null;
        let restoredPostArgs = null;
        const restorer = createRoutingStateRestorer({
            getMenuNodeByKey: () => null,
            getMenuNodeKey: (node) => node?.key || '',
            loadMenuTree: async () => {},
            logger: null,
            resolveMenuRoute: (segments) => {
                if (segments[0] === 'pds') {
                    return {
                        node: { key: 'pds', type: 'menu' },
                        remainingSegments: segments.slice(1)
                    };
                }
                return null;
            },
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
            showMemoList: async () => {},
            showMemoView: async () => {},
            showMemoWrite: async () => {},
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
            showUnifiedPdsList: async (...args) => {
                restoredListArgs = args;
                return await showUnifiedPdsList(...args);
            },
            showUnifiedPdsPost: async (...args) => {
                restoredPostArgs = args;
                return await showUnifiedPdsPost(...args);
            },
            showWeatherMenu: async () => {},
            showWeatherView: async () => {},
            isUnifiedPdsBoardId: (boardId) => String(boardId || '').trim() === 'pds'
        });

        state.screen = 'main';
        state.page = 1;
        state.board = null;
        state.post = null;
        pushedUrls.length = 0;
        globalThis.window = {
            location: {
                pathname: '/pds',
                search: '?page=2'
            }
        };
        await restorer.restoreStateFromURL();

        if (restoredListArgs?.[0] !== 2 || restoredListArgs?.[1] !== true) {
            errors.push('Unified PDS list direct route did not invoke showUnifiedPdsList(2, true) for /pds?page=2');
        }
        if (state.screen !== 'post-list') {
            errors.push('Unified PDS list direct route did not restore the post-list screen for /pds?page=2');
        }
        if (state.page !== 2) {
            errors.push(`Unified PDS list direct route did not restore page 2 state for /pds?page=2 (got ${state.page})`);
        }
        if (buildURLForState() !== listPageTwoUrl) {
            errors.push(`Unified PDS list direct route left URL state out of sync for page 2 (got ${buildURLForState()})`);
        }

        state.screen = 'main';
        state.page = 1;
        state.board = null;
        state.post = null;
        pushedUrls.length = 0;
        globalThis.window = {
            location: {
                pathname: '/pds/123',
                search: '?page=2'
            }
        };
        await restorer.restoreStateFromURL();

        if (restoredPostArgs?.[0] !== '123' || restoredPostArgs?.[1] !== 2 || restoredPostArgs?.[2] !== true) {
            errors.push('Unified PDS detail direct route did not invoke showUnifiedPdsPost("123", 2, true) for /pds/:postId?page=2');
        }
        if (state.screen !== 'post-view') {
            errors.push('Unified PDS detail direct route did not restore the post-view screen for /pds/:postId?page=2');
        }
        if (state.page !== 2) {
            errors.push(`Unified PDS detail direct route did not preserve page 2 state for /pds/:postId?page=2 (got ${state.page})`);
        }
        if (String(state.post?.id || '') !== '123') {
            errors.push(`Unified PDS detail direct route did not keep post.id in sync (got ${String(state.post?.id || '') || 'empty'})`);
        }
        if (buildURLForState() !== detailPageTwoUrl) {
            errors.push(`Unified PDS detail direct route left URL state out of sync for page 2 (got ${buildURLForState()})`);
        }
    } catch (error) {
        errors.push(`Unified PDS module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
}

// [LOG: 20260428_2327] HTTP fallback이 /service/weather도 API/모듈 수준으로 확인해
// Playwright 불가 환경에서도 날씨 route hydration 회귀를 더 일찍 잡는다.
async function verifyHttpWeatherCoverage(errors) {
    console.log('🌦️ Checking weather API coverage via HTTP fallback...');
    try {
        const weatherMenu = await fetchJsonData('/api/services/weather');
        const weatherRegions = Array.isArray(weatherMenu?.items) ? weatherMenu.items : null;

        if (!weatherRegions || weatherMenu?.kind !== 'weather') {
            errors.push('Weather menu payload shape is invalid at /api/services/weather');
            return;
        }

        if (weatherRegions.length === 0) {
            errors.push('Weather menu returned zero regions at /api/services/weather');
            return;
        }

        const firstRegionDoor = String(weatherRegions[0]?.door || '').trim();
        if (!firstRegionDoor) {
            errors.push('First weather region is missing a door value');
            return;
        }

        const weatherFeed = await fetchJsonData(`/api/services/weather/${encodeURIComponent(firstRegionDoor)}`);
        if (weatherFeed?.kind !== 'weather' || !weatherFeed?.region || !Array.isArray(weatherFeed?.items) || !Array.isArray(weatherFeed?.daily)) {
            errors.push(`Weather feed payload shape is invalid at /api/services/weather/${firstRegionDoor}`);
            return;
        }

        if (!hasNonEmptyText(weatherFeed.region?.title)) {
            errors.push(`Weather feed region title is empty at /api/services/weather/${firstRegionDoor}`);
            return;
        }

        if (weatherFeed.unavailable !== true && weatherFeed.items.length === 0 && weatherFeed.daily.length === 0) {
            errors.push(`Weather feed is empty at /api/services/weather/${firstRegionDoor}`);
        }
    } catch (error) {
        errors.push(error.message);
    }
}

// [LOG: 20260429_0427] When Playwright is blocked, /service/weather must still
// prove paginated region views keep ?page=N and restore the same page on reload.
async function verifyWeatherCoverage(errors) {
    console.log('🌦️ Checking weather route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createWeatherScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/weatherScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            history: [],
            page: 1,
            serviceData: {
                items: [{ door: '11', title: '서울' }],
                menuItems: []
            }
        };
        const screenEl = {
            innerHTML: '',
            querySelector() {
                return null;
            }
        };
        const pushedUrls = [];

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/service/weather/11',
                search: '?page=2'
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
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
        const { showWeatherView } = createWeatherScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async () => {},
            buildWeatherLocalAnsi: () => ({ text: 'LOCAL WEATHER', pageNo: 1, pageCount: 1 }),
            buildWeatherMenuAnsi: () => ({ text: 'WEATHER MENU', regionStartLine: 4, half: 1 }),
            buildWeatherAnsi: (_data, pageNo = 1) => ({
                text: `PC통신동호회 01410                 1993-04-29 04:27:00
WEATHER       서울                                   (${String(pageNo).padStart(2, '0')}/03)
────────────────────────────────────────────────────────────────────────────────

Weather page ${pageNo}
`,
                pageNo,
                pageCount: 3
            }),
            cmdInput: { focus() {} },
            getCommandFooterText: () => '',
            getMenuNodeByKey: () => ({ footer: 'WEATHER' }),
            loadLocalWeather: async () => ({ city: '서울', days: [] }),
            loadWeatherFeed: async () => ({
                region: { title: '서울' },
                items: [{ day: '2026-04-29', hour: '09', weather: '맑음', temperature: '20', rainProbability: '0', windDirection: 'N', windSpeed: '1' }],
                daily: [{ day: '2026-04-29', weather: '맑음', high: '22', low: '12', rainProbability: '0%' }]
            }),
            loadWeatherRegions: async () => ({ items: [{ door: '11', title: '서울' }] }),
            screenEl,
            state,
            updateURL: () => {
                pushedUrls.push(buildURLForState());
            },
            createHotspotLayer: () => ({ childElementCount: 0, appendChild() {} }),
            createHotspotButton: () => ({}),
            renderScreenSequential: async () => {}
        });

        await showWeatherView('11', { pageNo: 1 });
        const pageOneRender = String(screenEl.innerHTML || '');
        await showWeatherView('11', { pageNo: 2 });
        const pageTwoRender = String(screenEl.innerHTML || '');

        if (state.screen !== 'weather-view') {
            errors.push('Weather screen did not activate state.screen="weather-view" in weatherScreens.showWeatherView()');
        }
        if (Number(state.serviceData?.pageCount || 1) < 2) {
            errors.push('Weather screen did not expose multiple pages for pagination coverage');
        }
        if (Number(state.serviceData?.pageNo || 1) !== 2) {
            errors.push(`Weather screen did not normalize page 2 correctly (got ${state.serviceData?.pageNo || 'none'})`);
        }
        if (pageOneRender === pageTwoRender) {
            errors.push('Weather screen did not change rendered content between page 1 and page 2');
        }
        if (buildURLForState() !== '/service/weather/11?page=2') {
            errors.push(`Weather URL builder did not keep page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== '/service/weather/11?page=2') {
            errors.push('Weather pagination did not request /service/weather/11?page=2 when navigating to the next page');
        }

        let restoreArgs = null;
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
            showMemoList: async () => {},
            showMemoView: async () => {},
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
            showWeatherView: async (regionDoor, options = {}) => {
                restoreArgs = { regionDoor, options };
                return await showWeatherView(regionDoor, options);
            },
            isUnifiedPdsBoardId: () => false
        });

        state.screen = 'main';
        state.history = [];
        state.page = 1;
        state.serviceData = {
            items: [{ door: '11', title: '서울' }],
            menuItems: []
        };
        screenEl.innerHTML = '';
        await restorer.restoreStateFromURL();

        if (restoreArgs?.regionDoor !== '11' || restoreArgs?.options?.fromHistory !== true || restoreArgs?.options?.pageNo !== 2) {
            errors.push('Weather direct route did not invoke showWeatherView() with { fromHistory: true, pageNo: 2 } for /service/weather/11?page=2');
        }
        if (state.screen !== 'weather-view') {
            errors.push('Weather direct route did not restore the weather screen for /service/weather/11?page=2');
        }
        if (Number(state.serviceData?.pageNo || 1) !== 2) {
            errors.push(`Weather direct route did not restore page 2 for /service/weather/11?page=2 (got ${state.serviceData?.pageNo || 'none'})`);
        }
        if (String(screenEl.innerHTML || '') !== pageTwoRender) {
            errors.push('Weather direct route did not restore the same rendered page for /service/weather/11?page=2');
        }
        if (buildURLForState() !== '/service/weather/11?page=2') {
            errors.push(`Weather direct route left weather URL state out of sync for page 2 (got ${buildURLForState()})`);
        }
    } catch (error) {
        errors.push(`Weather module harness failed: ${error.message}`);
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

// [LOG: 20260428_2321] HTTP fallback도 /service/news, W, C, SYSLOG 경로의 API/모듈 건강도를 확인하고,
// Playwright 가능 환경에서는 H/C/SYSLOG/W를 실제 화면 상태로 검증한다.
async function verifyHttpNewsCoverage(errors) {
    console.log('📰 Checking news API coverage via HTTP fallback...');
    try {
        const newsMenu = await fetchJsonData('/api/services/news');
        const newsTopics = Array.isArray(newsMenu?.items) ? newsMenu.items : null;

        if (!newsTopics || newsMenu?.kind !== 'news') {
            errors.push('News menu payload shape is invalid at /api/services/news');
            return;
        }

        if (newsTopics.length === 0) {
            errors.push('News menu returned zero topics at /api/services/news');
            return;
        }

        const firstTopicDoor = String(newsTopics[0]?.door || '').trim();
        if (!firstTopicDoor) {
            errors.push('First news topic is missing a door value');
            return;
        }

        const newsFeed = await fetchJsonData(`/api/services/news/${encodeURIComponent(firstTopicDoor)}`);
        if (!Array.isArray(newsFeed?.items) || newsFeed?.kind !== 'news') {
            errors.push(`News feed payload shape is invalid at /api/services/news/${firstTopicDoor}`);
            return;
        }

        const firstArticleNo = String(newsFeed.items[0]?.no || '').trim();
        if (!firstArticleNo) {
            if (newsFeed.unavailable) {
                console.log(`ℹ️  News feed ${firstTopicDoor} is currently unavailable upstream; article detail fetch skipped.`);
            }
            return;
        }

        const articleDetail = await fetchJsonData(`/api/services/news/${encodeURIComponent(firstTopicDoor)}/${encodeURIComponent(firstArticleNo)}`);
        if (!articleDetail?.article || articleDetail?.kind !== 'news') {
            errors.push(`News article payload shape is invalid at /api/services/news/${firstTopicDoor}/${firstArticleNo}`);
            return;
        }

        if (!hasNonEmptyText(articleDetail.article.title) && !hasNonEmptyText(articleDetail.article.description) && !hasNonEmptyText(articleDetail.article.body)) {
            errors.push(`News article detail is empty at /api/services/news/${firstTopicDoor}/${firstArticleNo}`);
        }
    } catch (error) {
        errors.push(error.message);
    }
}

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
        // [LOG_ID: 20260725_1900] /api/system/info가 ensureAdmin으로 잠기면서(20260721_0400)
        // 익명 호출은 403이 정상이 됐다 — 보안 동작을 먼저 검증한 뒤, 개발환경 루프백 전용
        // 수동 신원 헤더로 관리자 컨텍스트를 만들어 페이로드 형태 검사를 이어간다.
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
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);

        const state = {
            screen: 'main',
            theme: 'default',
            assetCache: {}
        };
        const screenEl = {
            innerHTML: ''
        };
        const fetchCalls = [];
        let hint = '';
        let prompt = '';
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

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/',
                search: ''
            },
            matchMedia() {
                return { matches: true };
            },
            assign() {}
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

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
            buildActiveUsersAnsi: () => '',
            buildActivitySummaryAnsi,
            buildSystemDiagnosticsAnsi: () => '',
            getCommandFooterText: (category) => category === 'systemInfo' ? 'SYSTEMINFO FOOTER' : '',
            getSupportedFooterText: () => supportedFooterText,
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
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
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
            }
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
        if (prompt !== '>>') {
            errors.push(`Activity-summary screen did not set prompt to >> (got ${prompt || 'empty'})`);
        }
        if (hint !== 'ACT FOOTER') {
            errors.push(`Activity-summary screen did not apply the supported footer hint (got ${hint || 'empty'})`);
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
        hint = '';
        prompt = '';
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
        if (hint !== 'SYSTEMINFO FOOTER') {
            errors.push(`Activity-summary failure path did not fall back to the systemInfo footer text (got ${hint || 'empty'})`);
        }
        if (prompt !== '>>') {
            errors.push(`Activity-summary failure path did not restore prompt >> (got ${prompt || 'empty'})`);
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
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);

        const state = {
            screen: 'main',
            theme: 'default',
            assetCache: {}
        };
        const screenEl = {
            innerHTML: ''
        };
        const fetchCalls = [];
        let hint = '';
        let prompt = '';
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

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/',
                search: ''
            },
            matchMedia() {
                return { matches: true };
            },
            assign() {}
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

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
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
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
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
            }
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
        if (prompt !== '>>') {
            errors.push(`SYSINFO screen did not set prompt to >> (got ${prompt || 'empty'})`);
        }
        if (hint !== 'SYSINFO FOOTER') {
            errors.push(`SYSINFO screen did not apply the supported footer hint (got ${hint || 'empty'})`);
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
        if (!screenEl.innerHTML.includes(systemInfo.hostname) || !screenEl.innerHTML.includes('저장소 상태') || !screenEl.innerHTML.includes('저장소 메트릭')) {
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
        hint = '';
        prompt = '';
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
        if (hint !== 'SYSTEMINFO FOOTER') {
            errors.push(`SYSINFO failure path did not fall back to the systemInfo footer text (got ${hint || 'empty'})`);
        }
        if (prompt !== '>>') {
            errors.push(`SYSINFO failure path did not restore prompt >> (got ${prompt || 'empty'})`);
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
        const { createCommandFooterUtils } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandFooter.js'), moduleCache);
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);
        const { createPerformanceService } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/performanceService.js'), moduleCache);

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

// [LOG: 20260429_0420] When Playwright stays blocked, W should still prove
// global entry, post-list write conflict handling, and fail-closed render via a
// browser module harness instead of API-only fallback coverage.
async function verifyActiveUsersCommandCoverage(errors) {
    console.log('👤 Checking active-users command coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createSystemScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createGlobalNavigationCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterGlobalNavigation.js'), moduleCache);

        const state = {
            screen: 'main',
            user: { isGuest: true }
        };
        const screenEl = {
            innerHTML: ''
        };
        const fetchCalls = [];
        let hint = '';
        let prompt = '';
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

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/',
                search: ''
            },
            matchMedia() {
                return { matches: true };
            },
            assign() {}
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

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
            screenEl,
            updateURL: () => {
                updateUrlCalls += 1;
            },
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
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
            setHint: (value) => {
                hint = value;
            },
            setPrompt: (value) => {
                prompt = value;
            },
            findBoardByCode: () => null,
            showPostList: async () => {},
            showLogin: () => {},
            showConfirm: async () => true
        });

        const handled = await handleGlobalNavigationCommand({ cmd: 'W', rawCmd: 'W' });
        if (!handled) {
            errors.push('W global command was not handled by commandRouterGlobalNavigation.js');
        }
        if (fetchCalls[0] !== '/api/system/active-users') {
            errors.push(`W global command did not fetch /api/system/active-users (got ${fetchCalls[0] || 'none'})`);
        }
        if (state.screen !== 'active-users') {
            errors.push('W global command did not activate state.screen="active-users"');
        }
        if (prompt !== '>>') {
            errors.push(`Active-users screen did not set prompt to >> (got ${prompt || 'empty'})`);
        }
        if (hint !== 'ACTIVE FOOTER') {
            errors.push(`Active-users screen did not apply the supported footer hint (got ${hint || 'empty'})`);
        }
        if (updateUrlCalls !== 1) {
            errors.push(`Active-users screen did not request exactly one URL sync on W entry (got ${updateUrlCalls})`);
        }
        if (focusCalls !== 1) {
            errors.push(`Active-users screen did not focus the command input on desktop entry (got ${focusCalls})`);
        }
        if (!screenEl.innerHTML.includes('접속자 목록') || !screenEl.innerHTML.includes('WHO IS ONLINE')) {
            errors.push('W global command did not render the active-users title');
        }
        if (!screenEl.innerHTML.includes('alpha-user') || !screenEl.innerHTML.includes('/chat/1')) {
            errors.push('W global command did not render the expected active-users payload');
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
        hint = '';
        prompt = '';
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
        if (hint !== 'SYSTEMINFO FOOTER') {
            errors.push(`Active-users failure path did not fall back to the systemInfo footer text (got ${hint || 'empty'})`);
        }
        if (prompt !== '>>') {
            errors.push(`Active-users failure path did not restore prompt >> (got ${prompt || 'empty'})`);
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

// [LOG: 20260429_0214] When Playwright stays blocked, board fallback must still
// exercise restored post-write command-state (`P`/`S`), edit prefill, list-screen
// write entry, and guest/non-author guard hints instead of leaving those routes
// at shell-only checks.
// [LOG: 20260429_0229] The same module harness also keeps direct post-view
// recommend auth parity from regressing to a shell-only PASS.
async function verifyBoardPostWriteHarness(errors, options) {
    console.log('📝 Checking board post-write/create/recommend auth parity via module harness...');

    const {
        boardId,
        ownerUserId,
        otherUserId,
        postId,
        postTitle,
        postContent
    } = options;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function decodeHtml(value) {
        return String(value ?? '')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, '\'')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
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

    function createFakeDom() {
        const elements = new Map();
        // [LOG_ID: 20260725_1900] ansiTopbarScreen.js(모듈 그래프에 포함)가 screenEl?.querySelector를
        // 호출한다 — 스텁이 없어 하네스가 통째로 죽었다. null 반환이면 호출부의 옵셔널 체이닝/가드가
        // 그대로 동작한다.
        const screenEl = {
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };

        Object.defineProperty(screenEl, 'innerHTML', {
            get() {
                return this._html || '';
            },
            set(value) {
                this._html = String(value || '');
                for (const key of ['write-form', 'w-cancel', 'w-title', 'w-body', 'w-header']) {
                    elements.delete(key);
                }

                if (!this._html.includes('id="write-form"')) {
                    return;
                }

                const titleMatch = this._html.match(/id="w-title"[^>]*value="([^"]*)"/);
                const bodyMatch = this._html.match(/<textarea id="w-body"[^>]*>([\s\S]*?)<\/textarea>/);
                const headerMatch = this._html.match(/<select id="w-header">([\s\S]*?)<\/select>/);

                elements.set('write-form', new FakeElement('write-form'));
                elements.set('w-cancel', new FakeElement('w-cancel'));
                elements.set('w-title', new FakeElement('w-title', decodeHtml(titleMatch?.[1] || '')));
                elements.set('w-body', new FakeElement('w-body', decodeHtml(bodyMatch?.[1] || '')));

                if (headerMatch) {
                    const selectedOptionMatch = headerMatch[1].match(/<option value="([^"]*)"[^>]*selected[^>]*>/);
                    elements.set('w-header', new FakeElement('w-header', decodeHtml(selectedOptionMatch?.[1] || '')));
                }
            }
        });

        return {
            screenEl,
            document: {
                getElementById(id) {
                    return elements.get(id) || null;
                }
            }
        };
    }

    function buildUser(userId, overrides = {}) {
        return {
            userId,
            nickName: overrides.nickName || userId || 'guest',
            isGuest: Boolean(overrides.isGuest),
            isAdmin: Boolean(overrides.isAdmin),
            ...overrides
        };
    }

    function loadBrowserHarnessModule(modulePath, cache) {
        const resolvedPath = path.resolve(modulePath);
        if (cache.has(resolvedPath)) {
            return cache.get(resolvedPath);
        }

        let source = fs.readFileSync(resolvedPath, 'utf8');
        const exportNames = [];

        source = source.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?/g, (_match, bindings, specifier) => {
            const resolvedImportPath = path.resolve(path.dirname(resolvedPath), specifier);
            return `const { ${bindings.trim()} } = __loadModule(${JSON.stringify(resolvedImportPath)});`;
        });
        // [LOG_ID: 20260725_1900] ansiTopbarScreen.js가 export async function을 쓰는데 이 로더에만
        // 해당 규칙이 없어(아래 5700번대 다른 로더에는 이미 있음) "Unexpected token 'export'"로
        // 하네스가 통째로 죽고, 그 여파로 이후 게시글 상세/삭제 검사까지 연쇄 실패했다.
        source = source.replace(/export async function (\w+)\s*\(/g, (_match, name) => {
            exportNames.push(name);
            return `async function ${name}(`;
        });
        source = source.replace(/export function (\w+)\s*\(/g, (_match, name) => {
            exportNames.push(name);
            return `function ${name}(`;
        });
        source = source.replace(/export const (\w+)\s*=/g, (_match, name) => {
            exportNames.push(name);
            return `const ${name} =`;
        });
        source = source.replace(/export class (\w+)\s*/g, (_match, name) => {
            exportNames.push(name);
            return `class ${name} `;
        });
        source = source.replace(/export\s+\{[^}]+\};?/g, '');

        const uniqueExportNames = [...new Set(exportNames)];
        const wrapper = new Function('__loadModule', `${source}\nreturn { ${uniqueExportNames.join(', ')} };`);
        const moduleExports = wrapper((nextModulePath) => loadBrowserHarnessModule(nextModulePath, cache));
        cache.set(resolvedPath, moduleExports);
        return moduleExports;
    }

    try {
        const moduleCache = new Map();
        const { createPostWriteView } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/postWriteView.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);
        const { createEntryCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterEntry.js'), moduleCache);
        const { createBrowseCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterBrowse.js'), moduleCache);
        const { createPostViewCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterPostView.js'), moduleCache);
        const { createCommandDispatcherExecution } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandDispatcherExecution.js'), moduleCache);

        function createHarness(user, overrides = {}) {
            const { screenEl, document } = createFakeDom();
            globalThis.document = document;
            globalThis.window = {
                location: {
                    pathname: '/',
                    search: ''
                }
            };

            const state = {
                screen: 'main',
                page: 1,
                board: null,
                boardMenuPath: 'top',
                boardMenuTitle: 'TOP',
                post: null,
                posts: [],
                totalCount: 0,
                totalPages: 1,
                user,
                writeMode: 'create'
            };
            let hint = '';
            let prompt = '';

            const metrics = {
                createCalls: [],
                deleteCalls: [],
                replyCalls: [],
                recommendCalls: [],
                updateCalls: [],
                showPostListCalls: [],
                showPostViewCalls: []
            };

            const listPosts = Array.isArray(overrides.listPosts) && overrides.listPosts.length > 0
                ? overrides.listPosts.map((post) => ({ ...post }))
                : [{
                    id: Number(postId),
                    title: overrides.postTitle ?? postTitle,
                    content: overrides.postContent ?? postContent,
                    userId: overrides.postUserId || ownerUserId,
                    authorUserId: overrides.postUserId || ownerUserId
                }];

            const deps = {
                cmdInput: {},
                createPost: async (resolvedBoardId, payload) => {
                    metrics.createCalls.push({
                        boardId: String(resolvedBoardId),
                        payload: { ...payload }
                    });
                    return {
                        board: state.board,
                        post: { id: 9001, ...payload }
                    };
                },
                deletePost: async (resolvedBoardId, resolvedPostId) => {
                    metrics.deleteCalls.push({
                        boardId: String(resolvedBoardId),
                        postId: Number(resolvedPostId)
                    });
                    return { ok: true };
                },
                esc: escapeHtml,
                getSupportedFooterText: () => '',
                replyPost: async (resolvedBoardId, resolvedPostId, payload) => {
                    metrics.replyCalls.push({
                        boardId: String(resolvedBoardId),
                        postId: Number(resolvedPostId),
                        payload: { ...payload }
                    });
                    return {
                        board: state.board,
                        post: { id: 9002, parentId: Number(resolvedPostId), ...payload }
                    };
                },
                screenEl,
                setHint: (value) => {
                    hint = String(value || '').trim();
                },
                setPrompt: (value) => {
                    prompt = String(value || '').trim();
                },
                showMain: async () => {
                    state.screen = 'main';
                    screenEl.innerHTML = '<div>main</div>';
                },
                state,
                updatePost: async (resolvedBoardId, resolvedPostId, payload) => {
                    metrics.updateCalls.push({
                        boardId: String(resolvedBoardId),
                        postId: Number(resolvedPostId),
                        payload: { ...payload }
                    });
                    return {
                        board: state.board,
                        post: { ...(state.post || {}), id: Number(resolvedPostId), ...payload }
                    };
                },
                updateURL: () => {}
            };

            const { showPostWrite, handleWriteSubmit, cancelPostWrite } = createPostWriteView(deps);
            const handlers = {
                showPostList: async (resolvedBoardId, page = 1, showOptions = {}, fromHistory = false) => {
                    metrics.showPostListCalls.push({
                        boardId: String(resolvedBoardId),
                        page: Number(page),
                        options: { ...(showOptions || {}) },
                        fromHistory: Boolean(fromHistory)
                    });
                    state.screen = 'post-list';
                    state.page = Number(page) || 1;
                    state.board = {
                        id: String(resolvedBoardId),
                        boardId: String(resolvedBoardId),
                        name: String(resolvedBoardId),
                        writeSysopOnly: false,
                        replyEnabled: true,
                        postHeaders: [],
                        ...(overrides.board || {})
                    };
                    state.posts = listPosts.map((post) => ({ ...post }));
                    state.totalCount = state.posts.length;
                    state.totalPages = 1;
                    state.boardMenuPath = showOptions.menuPath ?? state.boardMenuPath ?? 'top';
                    state.boardMenuTitle = showOptions.menuTitle ?? state.boardMenuTitle ?? 'TOP';
                    screenEl.innerHTML = '<div>post-list</div>';
                },
                showPostView: async (resolvedBoardId, resolvedPostId, fromHistory = false) => {
                    metrics.showPostViewCalls.push({
                        boardId: String(resolvedBoardId),
                        postId: Number(resolvedPostId),
                        fromHistory: Boolean(fromHistory)
                    });
                    state.screen = 'post-view';
                    state.page = 1;
                    state.board = {
                        id: String(resolvedBoardId),
                        boardId: String(resolvedBoardId),
                        name: String(resolvedBoardId),
                        writeSysopOnly: false,
                        replyEnabled: true,
                        postHeaders: [],
                        ...(overrides.board || {})
                    };
                    state.post = {
                        id: Number(resolvedPostId),
                        title: overrides.postTitle ?? postTitle,
                        content: overrides.postContent ?? postContent,
                        userId: overrides.postUserId || ownerUserId,
                        authorUserId: overrides.postUserId || ownerUserId
                    };
                    screenEl.innerHTML = '<div>post-view</div>';
                }
            };

            handlers.showPostWrite = (mode, refPost) => showPostWrite(handlers, mode, refPost);
            handlers.handleWriteSubmit = () => handleWriteSubmit(handlers);
            handlers.cancelPostWrite = () => cancelPostWrite(handlers);
            const routingUrlBuilder = createRoutingUrlBuilder({
                getAuthLeafRoutePath: (leaf) => `/log/${leaf}`,
                getMenuNodeRoutePath: (menuPath) => `/menu/${menuPath}`,
                showPostList: handlers.showPostList,
                showPostView: handlers.showPostView,
                state
            });
            const browseCommandHandler = createBrowseCommandHandler({
                doLogout: async () => {},
                executeMenuNodeAction: async () => false,
                getBoardSelectTitle: () => state.boardMenuTitle || 'TOP',
                getMenuNodeKey: () => '',
                getMenuNodeTitle: () => '',
                getMenuParentKey: () => '',
                resolveMenuNodeTarget: () => null,
                deletePost: deps.deletePost,
                setHint: deps.setHint,
                setPrompt: deps.setPrompt,
                showBoardSelect: async () => {},
                showLogin: async () => {},
                showMain: deps.showMain,
                showPostList: handlers.showPostList,
                showPostView: handlers.showPostView,
                showPostWrite: handlers.showPostWrite,
                showToast: () => {},
                state
            });
            const postViewCommandHandler = createPostViewCommandHandler({
                deletePost: async () => {
                    throw new Error('Delete path should not run in board recommend harness.');
                },
                recommendPost: async (resolvedBoardId, resolvedPostId) => {
                    metrics.recommendCalls.push({
                        boardId: String(resolvedBoardId),
                        postId: Number(resolvedPostId)
                    });
                },
                restoreStateFromURL: async () => {},
                setHint: deps.setHint,
                setPrompt: deps.setPrompt,
                showAdjacentPost: async () => false,
                showMain: deps.showMain,
                showPostList: handlers.showPostList,
                showPostView: handlers.showPostView,
                showPostWrite: handlers.showPostWrite,
                showAttachmentList: async () => {
                    state.screen = 'attachment-list';
                },
                downloadAttachment: async () => {
                    throw new Error('Download path should not run in board recommend harness.');
                },
                state
            });

            const entryHandler = createEntryCommandHandler({
                showMain: deps.showMain,
                handleLoginSubmit: async () => {},
                handlePasswordResetSubmit: async () => {},
                handlePasswordResetCancel: async () => {},
                handleWriteSubmit: handlers.handleWriteSubmit,
                cancelPostWrite: handlers.cancelPostWrite
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
                showMain: deps.showMain,
                showMemoList: async () => {},
                showMemoView: async () => {},
                showMyInfo: async () => {},
                showNewsArticle: async () => {},
                showNewsList: async () => {},
                showNewsMenu: async () => {},
                showPasswordReset: async () => {},
                showAttachmentList: async () => {},
                showPostList: handlers.showPostList,
                showPostView: handlers.showPostView,
                showPostWrite: handlers.showPostWrite,
                showProfile: async () => {},
                showSignup: async () => {},
                showUnifiedPdsList: async () => {},
                showUnifiedPdsPost: async () => {},
                showWeatherMenu: async () => {},
                showWeatherView: async () => {},
                isUnifiedPdsBoardId: () => false
            });

            const dispatcherExecution = createCommandDispatcherExecution({
                state,
                terminalUiCore: {
                    showError: (message) => {
                        hint = String(message || '').trim();
                    },
                    showNotification: () => {}
                },
                statusManager: null,
                soundService: {
                    playBeep: () => {}
                },
                recordCommandExecution: () => {},
                logger: null,
                aliasService: null,
                handlers: {
                    handleGlobalCommand: async () => false,
                    handleEntryCommand: entryHandler,
                    handleBrowseCommand: browseCommandHandler,
                    handleServiceCommand: async () => false,
                    handleChatCommand: async () => false,
                    handleMemoCommand: async () => false,
                    handleMyInfoCommand: async () => false,
                    handlePostViewCommand: postViewCommandHandler,
                    handleVfsCommand: async () => false,
                    handleLogCommand: async () => false
                },
                screens: {
                    showMain: deps.showMain,
                    handleHistoryBack: async () => {},
                    postScreens: {
                        showPostList: handlers.showPostList
                    }
                },
                setPrompt: deps.setPrompt,
                handleCmd: async () => {}
            });

            return {
                state,
                browseCommandHandler,
                executeSingleCommand: (input, context = {}) => dispatcherExecution.executeSingleCommand(input, context),
                metrics,
                postViewCommandHandler,
                restorer,
                entryHandler,
                showPostList: handlers.showPostList,
                showPostView: handlers.showPostView,
                document,
                buildURLForState: () => routingUrlBuilder.buildURLForState(),
                getHint: () => hint,
                getPrompt: () => prompt
            };
        }

        const guestListWriteHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }));
        await guestListWriteHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const guestListWriteHandled = await guestListWriteHarness.browseCommandHandler({
            s: guestListWriteHarness.state.screen,
            cmd: 'W',
            rawCmd: 'W',
            context: {}
        });
        if (guestListWriteHandled !== true) {
            errors.push(`Board guest list write command was not handled at /board/${boardId}`);
        }
        if (guestListWriteHarness.state.screen !== 'post-list') {
            errors.push(`Board guest list write command should stay on post-list at /board/${boardId}`);
        }
        if (guestListWriteHarness.getHint() !== '로그인이 필요한 기능입니다.') {
            errors.push(`Board guest list write command is missing the login-required hint at /board/${boardId}`);
        }
        if (guestListWriteHarness.document.getElementById('w-title')) {
            errors.push(`Board guest list write command unexpectedly rendered post-write inputs at /board/${boardId}`);
        }
        if (guestListWriteHarness.metrics.createCalls.length !== 0) {
            errors.push(`Board guest list write command unexpectedly attempted a create at /board/${boardId}`);
        }

        const memberListWriteHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }));
        await memberListWriteHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const memberListWriteHandled = await memberListWriteHarness.browseCommandHandler({
            s: memberListWriteHarness.state.screen,
            cmd: 'W',
            rawCmd: 'W',
            context: {}
        });
        if (memberListWriteHandled !== true) {
            errors.push(`Board member list write command was not handled at /board/${boardId}`);
        }
        if (memberListWriteHarness.state.screen !== 'post-write') {
            errors.push(`Board member list write command did not enter post-write at /board/${boardId}`);
        } else if (!memberListWriteHarness.document.getElementById('w-title') || !memberListWriteHarness.document.getElementById('w-body')) {
            errors.push(`Board member list write command did not expose title/body inputs at /board/${boardId}`);
        }

        // [LOG: 20260429_0440] Keep pending LT/LI prompt follow-up input from regressing.
        const listSearchHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }));
        await listSearchHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const pendingTitleSearchHandled = await listSearchHarness.executeSingleCommand('LT');
        if (pendingTitleSearchHandled !== true) {
            errors.push(`Board list LT prompt command was not handled at /board/${boardId}`);
        }
        const clearedTitleSearchHandled = await listSearchHarness.executeSingleCommand('');
        if (clearedTitleSearchHandled !== true) {
            errors.push(`Board list LT prompt clear was not handled at /board/${boardId}`);
        } else {
            const clearedTitleSearchCall = listSearchHarness.metrics.showPostListCalls[listSearchHarness.metrics.showPostListCalls.length - 1];
            if (clearedTitleSearchCall?.options?.searchParams?.lt || clearedTitleSearchCall?.options?.searchParams?.li) {
                errors.push(`Board list LT prompt clear should reset search params at /board/${boardId}`);
            }
        }
        await listSearchHarness.executeSingleCommand('LT');
        const promptTitleSearchHandled = await listSearchHarness.executeSingleCommand('LT smoke keyword');
        if (promptTitleSearchHandled !== true) {
            errors.push(`Board list LT prompt submit was not handled at /board/${boardId}`);
        } else {
            const titleSearchCall = listSearchHarness.metrics.showPostListCalls[listSearchHarness.metrics.showPostListCalls.length - 1];
            if (titleSearchCall?.options?.searchParams?.lt !== 'smoke keyword') {
                errors.push(`Board list LT prompt submit did not strip the LT prefix at /board/${boardId}`);
            }
        }

        const postViewSearchHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await postViewSearchHarness.showPostView(boardId, postId);
        const pendingAuthorSearchHandled = await postViewSearchHarness.executeSingleCommand('LI');
        if (pendingAuthorSearchHandled !== true) {
            errors.push(`Board post-view LI prompt command was not handled at /board/${boardId}/${postId}`);
        }
        const promptAuthorSearchHandled = await postViewSearchHarness.executeSingleCommand(`LI ${ownerUserId}`);
        if (promptAuthorSearchHandled !== true) {
            errors.push(`Board post-view LI prompt submit was not handled at /board/${boardId}/${postId}`);
        } else {
            const authorSearchCall = postViewSearchHarness.metrics.showPostListCalls[postViewSearchHarness.metrics.showPostListCalls.length - 1];
            if (authorSearchCall?.options?.searchParams?.li !== ownerUserId) {
                errors.push(`Board post-view LI prompt submit did not strip the LI prefix at /board/${boardId}/${postId}`);
            }
        }

        const guestListEditHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await guestListEditHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const guestListEditHandled = await guestListEditHarness.browseCommandHandler({
            s: guestListEditHarness.state.screen,
            input: 'E 1',
            cmd: 'E 1',
            rawCmd: 'E 1',
            context: {}
        });
        if (guestListEditHandled !== true) {
            errors.push(`Board guest list edit command was not handled at /board/${boardId}`);
        }
        if (guestListEditHarness.getHint() !== '로그인이 필요한 기능입니다.') {
            errors.push(`Board guest list edit command is missing the login-required hint at /board/${boardId}`);
        }
        if (guestListEditHarness.state.screen !== 'post-list') {
            errors.push(`Board guest list edit command should stay on post-list at /board/${boardId}`);
        }
        if (guestListEditHarness.document.getElementById('w-title')) {
            errors.push(`Board guest list edit command unexpectedly rendered post-write inputs at /board/${boardId}`);
        }

        const ownerListEditHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await ownerListEditHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const ownerListEditHandled = await ownerListEditHarness.browseCommandHandler({
            s: ownerListEditHarness.state.screen,
            input: 'E 1',
            cmd: 'E 1',
            rawCmd: 'E 1',
            context: {}
        });
        if (ownerListEditHandled !== true) {
            errors.push(`Board owner list edit command was not handled at /board/${boardId}`);
        }
        if (ownerListEditHarness.state.screen !== 'post-write') {
            errors.push(`Board owner list edit command did not enter post-write at /board/${boardId}`);
        } else {
            const ownerListEditTitleInput = ownerListEditHarness.document.getElementById('w-title');
            const ownerListEditBodyInput = ownerListEditHarness.document.getElementById('w-body');
            if (!ownerListEditTitleInput || !ownerListEditBodyInput) {
                errors.push(`Board owner list edit command did not expose title/body inputs at /board/${boardId}`);
            } else {
                if (ownerListEditTitleInput.value !== postTitle || ownerListEditBodyInput.value !== postContent) {
                    errors.push(`Board owner list edit command did not prefill title/body at /board/${boardId}`);
                }
                const ownerListEditTitle = `${postTitle} via list edit`;
                const ownerListEditBody = `${postContent} via list edit`;
                ownerListEditTitleInput.value = ownerListEditTitle;
                ownerListEditBodyInput.value = ownerListEditBody;
                await ownerListEditHarness.entryHandler({
                    s: ownerListEditHarness.state.screen,
                    cmd: 'S',
                    context: {}
                });
                if (ownerListEditHarness.metrics.createCalls.length !== 0) {
                    errors.push(`Board owner list edit command unexpectedly attempted a create at /board/${boardId}`);
                }
                if (ownerListEditHarness.metrics.updateCalls.length !== 1) {
                    errors.push(`Board owner list edit command did not trigger an update exactly once at /board/${boardId}`);
                } else if (ownerListEditHarness.metrics.updateCalls[0].boardId !== String(boardId)
                    || ownerListEditHarness.metrics.updateCalls[0].postId !== Number(postId)
                    || ownerListEditHarness.metrics.updateCalls[0].payload.title !== ownerListEditTitle
                    || ownerListEditHarness.metrics.updateCalls[0].payload.content !== ownerListEditBody) {
                    errors.push(`Board owner list edit command update payload is invalid at /board/${boardId}`);
                }
                if (ownerListEditHarness.state.screen !== 'post-list') {
                    errors.push(`Board owner list edit submit did not return to post-list at /board/${boardId}`);
                }
            }
        }

        const nonAuthorListEditHarness = createHarness(buildUser(otherUserId, { nickName: 'board-other', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await nonAuthorListEditHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const nonAuthorListEditHandled = await nonAuthorListEditHarness.browseCommandHandler({
            s: nonAuthorListEditHarness.state.screen,
            input: 'E 1',
            cmd: 'E 1',
            rawCmd: 'E 1',
            context: {}
        });
        if (nonAuthorListEditHandled !== true) {
            errors.push(`Board non-author list edit command was not handled at /board/${boardId}`);
        }
        if (nonAuthorListEditHarness.getHint() !== '본인의 글만 수정할 수 있습니다.') {
            errors.push(`Board non-author list edit command is missing the author-only hint at /board/${boardId}`);
        }
        if (nonAuthorListEditHarness.state.screen !== 'post-list') {
            errors.push(`Board non-author list edit command should stay on post-list at /board/${boardId}`);
        }
        if (nonAuthorListEditHarness.document.getElementById('w-title')) {
            errors.push(`Board non-author list edit command unexpectedly rendered post-write inputs at /board/${boardId}`);
        }

        const deleteConfirmHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await deleteConfirmHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        const listDeleteHandled = await deleteConfirmHarness.browseCommandHandler({
            s: deleteConfirmHarness.state.screen,
            input: 'D 1',
            cmd: 'D 1',
            rawCmd: 'D 1',
            context: {}
        });
        if (listDeleteHandled !== true) {
            errors.push(`Board list delete command was not handled at /board/${boardId}`);
        }
        if (!deleteConfirmHarness.state._deleteConfirmStage || deleteConfirmHarness.state._deleteConfirmStage.postId !== Number(postId)) {
            errors.push(`Board list delete command did not enter confirm stage for visible row 1 at /board/${boardId}`);
        }
        if (deleteConfirmHarness.metrics.deleteCalls.length !== 0) {
            errors.push(`Board list delete command unexpectedly deleted before confirmation at /board/${boardId}`);
        }
        const listDeleteConfirmHandled = await deleteConfirmHarness.browseCommandHandler({
            s: deleteConfirmHarness.state.screen,
            input: '',
            cmd: 'F',
            rawCmd: 'F',
            context: {}
        });
        if (listDeleteConfirmHandled !== true) {
            errors.push(`Board list delete confirmation was not handled at /board/${boardId}`);
        }
        if (deleteConfirmHarness.metrics.deleteCalls.length !== 1) {
            errors.push(`Board list delete confirmation did not trigger delete exactly once at /board/${boardId}`);
        } else if (deleteConfirmHarness.metrics.deleteCalls[0].boardId !== String(boardId)
            || deleteConfirmHarness.metrics.deleteCalls[0].postId !== Number(postId)) {
            errors.push(`Board list delete confirmation payload is invalid at /board/${boardId}`);
        }
        if (deleteConfirmHarness.state._deleteConfirmStage) {
            errors.push(`Board list delete confirmation did not clear confirm stage at /board/${boardId}`);
        }
        if (deleteConfirmHarness.state.screen !== 'post-list') {
            errors.push(`Board list delete confirmation should stay on post-list at /board/${boardId}`);
        }

        const deleteCancelHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        await deleteCancelHarness.showPostList(boardId, 1, {
            menuPath: 'top',
            menuTitle: 'TOP'
        });
        await deleteCancelHarness.browseCommandHandler({
            s: deleteCancelHarness.state.screen,
            input: 'D 1',
            cmd: 'D 1',
            rawCmd: 'D 1',
            context: {}
        });
        const listDeleteCancelHandled = await deleteCancelHarness.browseCommandHandler({
            s: deleteCancelHarness.state.screen,
            input: 'N',
            cmd: 'N',
            rawCmd: 'N',
            context: {}
        });
        if (listDeleteCancelHandled !== true) {
            errors.push(`Board list delete cancel was not handled at /board/${boardId}`);
        }
        if (deleteCancelHarness.metrics.deleteCalls.length !== 0) {
            errors.push(`Board list delete cancel unexpectedly triggered delete at /board/${boardId}`);
        }
        if (deleteCancelHarness.state._deleteConfirmStage) {
            errors.push(`Board list delete cancel did not clear confirm stage at /board/${boardId}`);
        }
        if (deleteCancelHarness.state.screen !== 'post-list') {
            errors.push(`Board list delete cancel should stay on post-list at /board/${boardId}`);
        }

        const guestHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }));
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/write`;
        globalThis.window.location.search = '';
        await guestHarness.restorer.restoreStateFromURL();
        if (guestHarness.state.screen !== 'post-list') {
            errors.push(`Board guest write restore should stay on post-list at /board/${boardId}/write`);
        }
        if (guestHarness.getHint() !== '로그인이 필요한 기능입니다.') {
            errors.push(`Board guest write restore is missing the login-required hint at /board/${boardId}/write`);
        }
        if (guestHarness.document.getElementById('w-title')) {
            errors.push(`Board guest write restore unexpectedly rendered post-write inputs at /board/${boardId}/write`);
        }

        const createCancelHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }));
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/write`;
        globalThis.window.location.search = '';
        await createCancelHarness.restorer.restoreStateFromURL();
        if (createCancelHarness.state.screen !== 'post-write') {
            errors.push(`Board write restore did not enter post-write state at /board/${boardId}/write`);
        } else {
            await createCancelHarness.entryHandler({
                s: createCancelHarness.state.screen,
                cmd: 'P',
                context: {}
            });
            if (createCancelHarness.state.screen !== 'post-list') {
                errors.push(`Board write restore cancel did not return to post-list at /board/${boardId}/write`);
            }
            if (createCancelHarness.metrics.createCalls.length !== 0) {
                errors.push(`Board write restore cancel unexpectedly attempted a create at /board/${boardId}/write`);
            }
        }

        const createSubmitHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }));
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/write`;
        globalThis.window.location.search = '';
        await createSubmitHarness.restorer.restoreStateFromURL();
        if (createSubmitHarness.state.screen !== 'post-write') {
            errors.push(`Board write restore submit path did not enter post-write state at /board/${boardId}/write`);
        } else {
            const titleInput = createSubmitHarness.document.getElementById('w-title');
            const bodyInput = createSubmitHarness.document.getElementById('w-body');
            if (!titleInput || !bodyInput) {
                errors.push(`Board write restore submit path did not expose title/body inputs at /board/${boardId}/write`);
            } else {
                const submitTitle = `board harness create ${postId}`;
                const submitBody = `board harness create body ${postId}`;
                titleInput.value = submitTitle;
                bodyInput.value = submitBody;
                await createSubmitHarness.entryHandler({
                    s: createSubmitHarness.state.screen,
                    cmd: 'S',
                    context: {}
                });
                if (createSubmitHarness.metrics.createCalls.length !== 1) {
                    errors.push(`Board write restore submit did not trigger a create exactly once at /board/${boardId}/write`);
                } else if (createSubmitHarness.metrics.createCalls[0].payload.title !== submitTitle
                    || createSubmitHarness.metrics.createCalls[0].payload.content !== submitBody) {
                    errors.push(`Board write restore submit payload is invalid at /board/${boardId}/write`);
                }
                if (createSubmitHarness.state.screen !== 'post-list') {
                    errors.push(`Board write restore submit did not return to post-list at /board/${boardId}/write`);
                }
            }
        }

        const editHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}/edit`;
        globalThis.window.location.search = '';
        await editHarness.restorer.restoreStateFromURL();
        if (editHarness.state.screen !== 'post-write') {
            errors.push(`Board edit restore did not enter post-write state at /board/${boardId}/${postId}/edit`);
        } else {
            const editTitleInput = editHarness.document.getElementById('w-title');
            const editBodyInput = editHarness.document.getElementById('w-body');
            if (!editTitleInput || !editBodyInput) {
                errors.push(`Board edit restore did not expose title/body inputs at /board/${boardId}/${postId}/edit`);
            } else {
                if (editTitleInput.value !== postTitle || editBodyInput.value !== postContent) {
                    errors.push(`Board edit restore did not prefill title/body at /board/${boardId}/${postId}/edit`);
                }
                const updatedHarnessTitle = `${postTitle} via harness`;
                const updatedHarnessBody = `${postContent} via harness`;
                editTitleInput.value = updatedHarnessTitle;
                editBodyInput.value = updatedHarnessBody;
                await editHarness.entryHandler({
                    s: editHarness.state.screen,
                    cmd: 'S',
                    context: {}
                });
                if (editHarness.metrics.updateCalls.length !== 1) {
                    errors.push(`Board edit restore submit did not trigger an update exactly once at /board/${boardId}/${postId}/edit`);
                } else if (editHarness.metrics.updateCalls[0].boardId !== String(boardId)
                    || editHarness.metrics.updateCalls[0].postId !== Number(postId)
                    || editHarness.metrics.updateCalls[0].payload.title !== updatedHarnessTitle
                    || editHarness.metrics.updateCalls[0].payload.content !== updatedHarnessBody) {
                    errors.push(`Board edit restore submit payload is invalid at /board/${boardId}/${postId}/edit`);
                }
                if (editHarness.state.screen !== 'post-list') {
                    errors.push(`Board edit restore submit did not return to post-list at /board/${boardId}/${postId}/edit`);
                }
            }
        }

        const nonAuthorHarness = createHarness(buildUser(otherUserId, { nickName: 'board-other', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}/edit`;
        globalThis.window.location.search = '';
        await nonAuthorHarness.restorer.restoreStateFromURL();
        if (nonAuthorHarness.state.screen !== 'post-view') {
            errors.push(`Board non-author edit restore should stay on post-view at /board/${boardId}/${postId}/edit`);
        }
        if (nonAuthorHarness.getHint() !== '본인의 글만 수정할 수 있습니다.') {
            errors.push(`Board non-author edit restore is missing the author-only hint at /board/${boardId}/${postId}/edit`);
        }
        if (nonAuthorHarness.document.getElementById('w-title')) {
            errors.push(`Board non-author edit restore unexpectedly rendered post-write inputs at /board/${boardId}/${postId}/edit`);
        }

        // [LOG: 20260429_0328] Keep post-view guest edit/delete auth parity out of shell-only PASS
        // so direct detail E/D reuse the existing login-required hint instead of falling through.
        const guestEditHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await guestEditHarness.restorer.restoreStateFromURL();
        if (guestEditHarness.state.screen !== 'post-view') {
            errors.push(`Board guest edit harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const guestEditHandled = await guestEditHarness.postViewCommandHandler({
                cmd: 'E',
                context: {}
            });
            if (guestEditHandled !== true) {
                errors.push(`Board guest edit command was not handled at /board/${boardId}/${postId}`);
            }
            if (guestEditHarness.getHint() !== '로그인이 필요한 기능입니다.') {
                errors.push(`Board guest edit command is missing the login-required hint at /board/${boardId}/${postId}`);
            }
            if (guestEditHarness.state.screen !== 'post-view') {
                errors.push(`Board guest edit command should stay on post-view at /board/${boardId}/${postId}`);
            }
            if (guestEditHarness.document.getElementById('w-title')) {
                errors.push(`Board guest edit command unexpectedly rendered post-write inputs at /board/${boardId}/${postId}`);
            }
        }

        const guestDeleteHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await guestDeleteHarness.restorer.restoreStateFromURL();
        if (guestDeleteHarness.state.screen !== 'post-view') {
            errors.push(`Board guest delete harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const guestDeleteHandled = await guestDeleteHarness.postViewCommandHandler({
                cmd: 'D',
                context: {}
            });
            if (guestDeleteHandled !== true) {
                errors.push(`Board guest delete command was not handled at /board/${boardId}/${postId}`);
            }
            if (guestDeleteHarness.getHint() !== '로그인이 필요한 기능입니다.') {
                errors.push(`Board guest delete command is missing the login-required hint at /board/${boardId}/${postId}`);
            }
            if (guestDeleteHarness.state.screen !== 'post-view') {
                errors.push(`Board guest delete command should stay on post-view at /board/${boardId}/${postId}`);
            }
        }

        const guestReplyHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await guestReplyHarness.restorer.restoreStateFromURL();
        if (guestReplyHarness.state.screen !== 'post-view') {
            errors.push(`Board guest reply harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const guestReplyHandled = await guestReplyHarness.postViewCommandHandler({
                cmd: 'R',
                context: {}
            });
            if (guestReplyHandled !== true) {
                errors.push(`Board guest reply command was not handled at /board/${boardId}/${postId}`);
            }
            if (guestReplyHarness.getHint() !== '로그인이 필요한 기능입니다.') {
                errors.push(`Board guest reply command is missing the login-required hint at /board/${boardId}/${postId}`);
            }
            if (guestReplyHarness.state.screen !== 'post-view') {
                errors.push(`Board guest reply command should stay on post-view at /board/${boardId}/${postId}`);
            }
            if (guestReplyHarness.document.getElementById('w-title')) {
                errors.push(`Board guest reply command unexpectedly rendered post-write inputs at /board/${boardId}/${postId}`);
            }
            if (guestReplyHarness.metrics.replyCalls.length !== 0) {
                errors.push(`Board guest reply command unexpectedly attempted a reply submit at /board/${boardId}/${postId}`);
            }
        }

        const memberReplyHarness = createHarness(buildUser(otherUserId, { nickName: 'board-replier', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        const expectedReplyRoute = `/board/${boardId}/${postId}/reply`;
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await memberReplyHarness.restorer.restoreStateFromURL();
        if (memberReplyHarness.state.screen !== 'post-view') {
            errors.push(`Board member reply harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const memberReplyHandled = await memberReplyHarness.postViewCommandHandler({
                cmd: 'R',
                context: {}
            });
            if (memberReplyHandled !== true) {
                errors.push(`Board member reply command was not handled at /board/${boardId}/${postId}`);
            }
            if (memberReplyHarness.state.screen !== 'post-write') {
                errors.push(`Board member reply command did not enter post-write at /board/${boardId}/${postId}`);
            } else {
                // [LOG: 20260429_0621] Keep reply compose addressable so browser
                // reload/history does not collapse reply mode into generic write mode.
                const memberReplyRoute = memberReplyHarness.buildURLForState();
                if (memberReplyRoute !== expectedReplyRoute) {
                    errors.push(`Board member reply command built ${memberReplyRoute || 'empty'} instead of ${expectedReplyRoute}`);
                }

                const replyTitleInput = memberReplyHarness.document.getElementById('w-title');
                const replyBodyInput = memberReplyHarness.document.getElementById('w-body');
                if (!replyTitleInput || !replyBodyInput) {
                    errors.push(`Board member reply command did not expose title/body inputs at /board/${boardId}/${postId}`);
                } else {
                    if (replyTitleInput.value !== `Re: ${postTitle}`) {
                        errors.push(`Board member reply command did not prefill the reply title at /board/${boardId}/${postId}`);
                    }
                    const replyTitle = `Re: ${postTitle} via harness`;
                    const replyBody = `board harness reply body ${postId}`;
                    replyTitleInput.value = replyTitle;
                    replyBodyInput.value = replyBody;
                    await memberReplyHarness.entryHandler({
                        s: memberReplyHarness.state.screen,
                        cmd: 'S',
                        context: {}
                    });
                    if (memberReplyHarness.metrics.replyCalls.length !== 1) {
                        errors.push(`Board member reply command did not trigger a reply exactly once at /board/${boardId}/${postId}`);
                    } else if (memberReplyHarness.metrics.replyCalls[0].boardId !== String(boardId)
                        || memberReplyHarness.metrics.replyCalls[0].postId !== Number(postId)
                        || memberReplyHarness.metrics.replyCalls[0].payload.title !== replyTitle
                        || memberReplyHarness.metrics.replyCalls[0].payload.content !== replyBody) {
                        errors.push(`Board member reply payload is invalid at /board/${boardId}/${postId}`);
                    }
                    if (memberReplyHarness.state.screen !== 'post-list') {
                        errors.push(`Board member reply submit did not return to post-list at /board/${boardId}/${postId}`);
                    }
                }

                const memberReplyRestoreHarness = createHarness(buildUser(otherUserId, { nickName: 'board-replier', isGuest: false }), {
                    postTitle,
                    postContent,
                    postUserId: ownerUserId
                });
                globalThis.window.location.pathname = expectedReplyRoute;
                globalThis.window.location.search = '';
                await memberReplyRestoreHarness.restorer.restoreStateFromURL();
                if (memberReplyRestoreHarness.state.screen !== 'post-write') {
                    errors.push(`Board reply direct route did not restore post-write at ${expectedReplyRoute}`);
                } else {
                    if (memberReplyRestoreHarness.state.writeMode !== 'reply') {
                        errors.push(`Board reply direct route did not keep writeMode=reply at ${expectedReplyRoute}`);
                    }
                    const restoredReplyTitleInput = memberReplyRestoreHarness.document.getElementById('w-title');
                    const restoredReplyBodyInput = memberReplyRestoreHarness.document.getElementById('w-body');
                    if (!restoredReplyTitleInput || !restoredReplyBodyInput) {
                        errors.push(`Board reply direct route did not expose reply inputs at ${expectedReplyRoute}`);
                    } else if (restoredReplyTitleInput.value !== `Re: ${postTitle}`) {
                        errors.push(`Board reply direct route did not prefill the reply title at ${expectedReplyRoute}`);
                    }
                    if (memberReplyRestoreHarness.metrics.showPostViewCalls.length !== 1) {
                        errors.push(`Board reply direct route did not hydrate the source post exactly once at ${expectedReplyRoute}`);
                    }
                }
            }
        }

        const guestRecommendHarness = createHarness(buildUser('guest', { nickName: '손님', isGuest: true }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await guestRecommendHarness.restorer.restoreStateFromURL();
        if (guestRecommendHarness.state.screen !== 'post-view') {
            errors.push(`Board guest recommend harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const guestShowPostViewCallsBeforeRecommend = guestRecommendHarness.metrics.showPostViewCalls.length;
            const guestRecommendHandled = await guestRecommendHarness.postViewCommandHandler({
                cmd: 'V',
                context: {}
            });
            if (guestRecommendHandled !== true) {
                errors.push(`Board guest recommend command was not handled at /board/${boardId}/${postId}`);
            }
            if (guestRecommendHarness.getHint() !== '로그인이 필요한 기능입니다.') {
                errors.push(`Board guest recommend command is missing the login-required hint at /board/${boardId}/${postId}`);
            }
            if (guestRecommendHarness.metrics.recommendCalls.length !== 0) {
                errors.push(`Board guest recommend command unexpectedly attempted an API call at /board/${boardId}/${postId}`);
            }
            if (guestRecommendHarness.metrics.showPostViewCalls.length !== guestShowPostViewCallsBeforeRecommend) {
                errors.push(`Board guest recommend command unexpectedly reloaded the post at /board/${boardId}/${postId}`);
            }
        }

        const memberRecommendHarness = createHarness(buildUser(otherUserId, { nickName: 'board-voter', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await memberRecommendHarness.restorer.restoreStateFromURL();
        if (memberRecommendHarness.state.screen !== 'post-view') {
            errors.push(`Board member recommend harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const memberShowPostViewCallsBeforeRecommend = memberRecommendHarness.metrics.showPostViewCalls.length;
            const memberRecommendHandled = await memberRecommendHarness.postViewCommandHandler({
                cmd: 'V',
                context: {}
            });
            if (memberRecommendHandled !== true) {
                errors.push(`Board member recommend command was not handled at /board/${boardId}/${postId}`);
            }
            if (memberRecommendHarness.metrics.recommendCalls.length !== 1) {
                errors.push(`Board member recommend command did not trigger recommendPost exactly once at /board/${boardId}/${postId}`);
            } else if (memberRecommendHarness.metrics.recommendCalls[0].boardId !== String(boardId)
                || memberRecommendHarness.metrics.recommendCalls[0].postId !== Number(postId)) {
                errors.push(`Board member recommend payload is invalid at /board/${boardId}/${postId}`);
            }
            if (memberRecommendHarness.metrics.showPostViewCalls.length !== memberShowPostViewCallsBeforeRecommend + 1) {
                errors.push(`Board member recommend command did not refresh post-view at /board/${boardId}/${postId}`);
            }
        }
    } catch (error) {
        errors.push(`Board post-write harness failed: ${error.message}`);
    } finally {
        delete globalThis.document;
        delete globalThis.window;
    }
}

// [LOG: 20260429_0103] When Playwright is blocked, board fallback must now prove
// create/reply/delete contracts on an empty-table Supabase dataset, not just direct-route reads.
// [LOG: 20260429_0123] Board fallback must also prove recommend success + self 400
// + duplicate 409 so the remaining board write path does not stay shell-only.
// [LOG: 20260429_0130] Board fallback must also prove author PATCH success/persistence
// and non-author 403 so board edit/update does not stay shell-only in spawn EPERM environments.
// [LOG: 20260429_0147] Board fallback must also prove non-author attachment POST 403
// + unchanged list persistence so attachment create auth does not stay shell-only.
// [LOG: 20260429_0248] Board fallback must also prove guest create 401 + unchanged
// first-page list so board create auth parity does not regress in spawn EPERM environments.
// [LOG: 20260429_0229] Board fallback must also prove guest recommend 401 + unchanged
// recommend count so `V` login-required parity does not regress in spawn EPERM environments.
async function verifyHttpBoardCoverage(errors) {
    console.log('📚 Checking board API coverage via HTTP fallback...');
    const smokeSuffix = String(Date.now());
    const smokeUserId = `board-fallback-${smokeSuffix}`;
    const smokeNickName = 'board-smoke';
    const recommendUserId = `board-recommend-${smokeSuffix}`;
    const recommendNickName = 'board-vote';
    const smokeAttachmentName = `board-fallback-${smokeSuffix}.txt`;
    const smokeAttachmentBody = `board attachment fallback ${smokeSuffix}`;
    const authHeaders = {
        'Content-Type': 'application/json',
        'x-bbs-user-id': smokeUserId,
        'x-bbs-nick-name': smokeNickName
    };
    const recommendHeaders = {
        'Content-Type': 'application/json',
        'x-bbs-user-id': recommendUserId,
        'x-bbs-nick-name': recommendNickName
    };
    let cleanupBoardId = '';
    let createdPostId = 0;
    let attachmentId = 0;
    let replyPostId = 0;

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

    async function expectAppShell(pathname) {
        const response = await fetch(`${BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${pathname}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${pathname}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${pathname}`);
        }
    }

    function serializeBoardPage(items = []) {
        return JSON.stringify(items.map((post) => ({
            id: Number(post?.id || 0),
            title: String(post?.title || ''),
            family: Number(post?.family ?? post?.familyId ?? 0)
        })));
    }

    try {
        const boards = await fetchJsonData('/api/boards');
        if (!Array.isArray(boards)) {
            errors.push('Boards payload shape is invalid at /api/boards');
            return;
        }

        const writableBoard = boards.find((board) =>
            extractBoardId(board) === 'plaza'
            && board.writeSysopOnly !== true
            && board.replyEnabled !== false
            && board.attachmentEnabled === true
        )
            || boards.find((board) =>
                extractBoardId(board)
                && board.writeSysopOnly !== true
                && board.replyEnabled !== false
                && board.attachmentEnabled === true
            )
            || boards.find((board) => extractBoardId(board) === 'plaza')
            || boards.find((board) => extractBoardId(board) && board.writeSysopOnly !== true && board.replyEnabled !== false);
        const boardId = extractBoardId(writableBoard);
        if (!boardId) {
            errors.push('No writable board was available for board fallback coverage');
            return;
        }
        cleanupBoardId = boardId;

        // [LOG: 20260429_0206] Keep board write direct-route restore from staying shell-only
        // when Playwright is blocked by checking the app shell for /board/:boardId/write
        // and /board/:boardId/:postId/reply here.
        await expectAppShell(`/board/${encodeURIComponent(boardId)}/write`);

        const guestCreateTitle = `board fallback guest create ${smokeSuffix}`;
        const guestCreateBody = `board fallback guest create body ${smokeSuffix}`;
        const boardListBeforeGuestCreateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}?page=1`, {}, 200, `Board list before guest create failed at /api/boards/${boardId}?page=1`);
        if (!boardListBeforeGuestCreateResponse.data?.board || extractBoardId(boardListBeforeGuestCreateResponse.data.board) !== boardId) {
            errors.push(`Board list payload shape is invalid before guest create at /api/boards/${boardId}?page=1`);
            return;
        }
        const guestCreatePageSignatureBefore = serializeBoardPage(extractBoardItems(boardListBeforeGuestCreateResponse.data));

        const guestCreateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: guestCreateTitle,
                content: guestCreateBody
            })
        }, 401, `Board guest create should require auth at /api/boards/${boardId}/posts`);
        if (!hasNonEmptyText(extractApiMessage(guestCreateResponse.payload))) {
            errors.push(`Board guest create unauthorized response is missing a message at /api/boards/${boardId}/posts`);
            return;
        }

        const boardListAfterGuestCreateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}?page=1`, {}, 200, `Board list after guest create failed at /api/boards/${boardId}?page=1`);
        if (serializeBoardPage(extractBoardItems(boardListAfterGuestCreateResponse.data)) !== guestCreatePageSignatureBefore) {
            errors.push(`Board list changed after guest create at /api/boards/${boardId}/posts`);
            return;
        }

        const createResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                title: `board fallback ${smokeSuffix}`,
                content: `board fallback body ${smokeSuffix}`
            })
        }, 201, `Board post create failed at /api/boards/${boardId}/posts`);
        if (extractBoardId(createResponse.data?.board) !== boardId || !Number(createResponse.data?.post?.id)) {
            errors.push(`Board post create payload shape is invalid at /api/boards/${boardId}/posts`);
            return;
        }
        // [LOG_ID: 20260725_1900] 게시글 상세/수정/삭제 API는 게시판별 번호(localId)로 주소를 잡는다
        // (클라이언트도 항상 post.localId ?? post.id를 씀, Supabase 드라이버의 fetchPostByLocalId 참고).
        // 전역 row id(post.id)로 조회하던 종전 코드는 메모리 드라이버(둘이 같은 값)에서만 우연히
        // 통과했고 Supabase에서는 상세 조회부터 404가 났다.
        createdPostId = Number(createResponse.data.post.localId ?? createResponse.data.post.id);
        // family_id(답글 스레드 묶음)는 부모의 전역 row id를 가리키므로 스레드 대조용으로 따로 든다.
        const createdPostGlobalId = Number(createResponse.data.post.id);
        const extractPostLocalId = (post) => Number(post?.localId ?? post?.id ?? 0);

        const boardListResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}?page=1`, {}, 200, `Board list failed at /api/boards/${boardId}?page=1`);
        const boardInfo = boardListResponse.data?.board;
        if (!boardInfo || extractBoardId(boardInfo) !== boardId) {
            errors.push(`Board list payload shape is invalid at /api/boards/${boardId}?page=1`);
            return;
        }

        const boardItems = extractBoardItems(boardListResponse.data);
        if (!boardItems.some((post) => extractPostLocalId(post) === createdPostId)) {
            errors.push(`Created board post did not appear at /api/boards/${boardId}?page=1`);
            return;
        }
        const countReplyThreadItems = (items = []) => items.filter((post) => {
            const itemId = extractPostLocalId(post);
            const familyId = Number(post?.family ?? post?.familyId ?? 0);
            return itemId === createdPostId || familyId === createdPostGlobalId;
        }).length;
        const threadItemCountBeforeReply = countReplyThreadItems(boardItems);

        await expectAppShell(`/board/${encodeURIComponent(boardId)}/${encodeURIComponent(createdPostId)}`);
        await expectAppShell(`/board/${encodeURIComponent(boardId)}/${encodeURIComponent(createdPostId)}/edit`);
        await expectAppShell(`/board/${encodeURIComponent(boardId)}/${encodeURIComponent(createdPostId)}/reply`);
        await verifyBoardPostWriteHarness(errors, {
            boardId,
            ownerUserId: smokeUserId,
            otherUserId: recommendUserId,
            postId: createdPostId,
            postTitle: String(createResponse.data?.post?.title || ''),
            postContent: String(createResponse.data?.post?.content || '')
        });

        const postDetailResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}?view=1`, {}, 200, `Board post detail failed at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
        const postDetail = postDetailResponse.data;
        if (!postDetail?.board || extractBoardId(postDetail.board) !== boardId || extractPostLocalId(postDetail?.post) !== createdPostId) {
            errors.push(`Board post detail payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
            return;
        }

        if (!hasNonEmptyText(postDetail.post?.title) && !hasNonEmptyText(postDetail.post?.content)) {
            errors.push(`Board post detail is empty at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
            return;
        }

        if (!hasNonEmptyText(postDetail.board?.menuPath)) {
            errors.push(`Board menuPath is empty at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
            return;
        }

        if (Number(postDetail.post?.hit) < 1) {
            errors.push(`Board post hit did not increment at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
            return;
        }

        const navigation = postDetail.navigation;
        if (!navigation || !Object.prototype.hasOwnProperty.call(navigation, 'latestId') || !Object.prototype.hasOwnProperty.call(navigation, 'prevId') || !Object.prototype.hasOwnProperty.call(navigation, 'nextId')) {
            errors.push(`Board post navigation payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}?view=1`);
            return;
        }

        let expectedRecommendCount = Number(postDetail.post?.recommend || 0);
        const updatedTitle = `board fallback updated ${smokeSuffix}`;
        const updatedContent = `board fallback updated body ${smokeSuffix}`;

        const updateSuccessResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
                title: updatedTitle,
                content: updatedContent
            })
        }, 200, `Board post update failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (extractBoardId(updateSuccessResponse.data?.board) !== boardId || extractPostLocalId(updateSuccessResponse.data?.post) !== createdPostId) {
            errors.push(`Board post update payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }
        if (updateSuccessResponse.data?.post?.title !== updatedTitle || updateSuccessResponse.data?.post?.content !== updatedContent) {
            errors.push(`Board post update did not persist the author patch at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const updateDetailResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {}, 200, `Board post detail after update failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (updateDetailResponse.data?.post?.title !== updatedTitle || updateDetailResponse.data?.post?.content !== updatedContent) {
            errors.push(`Board post detail did not reflect the updated content at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const updateForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {
            method: 'PATCH',
            headers: recommendHeaders,
            body: JSON.stringify({
                title: `board fallback forbidden ${smokeSuffix}`,
                content: `board fallback forbidden body ${smokeSuffix}`
            })
        }, 403, `Board non-author update should be forbidden at /api/boards/${boardId}/posts/${createdPostId}`);
        if (!hasNonEmptyText(extractApiMessage(updateForbiddenResponse.payload))) {
            errors.push(`Board non-author update unauthorized response is missing a message at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const updateDetailAfterForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {}, 200, `Board post detail after forbidden update failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (updateDetailAfterForbiddenResponse.data?.post?.title !== updatedTitle || updateDetailAfterForbiddenResponse.data?.post?.content !== updatedContent) {
            errors.push(`Board post changed after forbidden update at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        if (postDetail.board?.attachmentEnabled === true) {
            const attachmentCreateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    originalName: smokeAttachmentName,
                    mimeType: 'text/plain',
                    contentBase64: Buffer.from(smokeAttachmentBody, 'utf8').toString('base64')
                })
            }, 201, `Board attachment create failed at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
            if (!Number(attachmentCreateResponse.data?.id) || attachmentCreateResponse.data?.originalName !== smokeAttachmentName) {
                errors.push(`Board attachment create payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            attachmentId = Number(attachmentCreateResponse.data.id);

            const attachmentListResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments`, {
                headers: authHeaders
            }, 200, `Board attachment list failed at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
            if (!Array.isArray(attachmentListResponse.data)) {
                errors.push(`Board attachment list payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            if (!attachmentListResponse.data.some((attachment) => Number(attachment?.id) === attachmentId && attachment?.originalName === smokeAttachmentName)) {
                errors.push(`Board attachment list did not include the uploaded file at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            const attachmentRouteResponse = await fetch(`${BASE_URL}/board/${encodeURIComponent(boardId)}/${encodeURIComponent(createdPostId)}/files`);
            const attachmentRouteContent = await attachmentRouteResponse.text();
            if (!attachmentRouteResponse.ok) {
                errors.push(`HTTP ${attachmentRouteResponse.status} at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!hasNonEmptyText(attachmentRouteContent)) {
                errors.push(`Empty page content at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!attachmentRouteContent.includes(APP_SHELL_MARKER)) {
                errors.push(`App shell module entry missing at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!attachmentRouteContent.includes('id="terminal-wrapper"')) {
                errors.push(`Terminal wrapper missing at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!attachmentRouteContent.includes('id="cmd-input"')) {
                errors.push(`Command input missing at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            const attachmentListCountBeforeForbiddenCreate = attachmentListResponse.data.length;

            // [LOG: 20260429_0147] Keep attachment create authorization out of shell-only PASS in HTTP fallback mode.
            const forbiddenAttachmentName = `board-fallback-forbidden-${smokeSuffix}.txt`;
            const attachmentCreateForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments`, {
                method: 'POST',
                headers: recommendHeaders,
                body: JSON.stringify({
                    originalName: forbiddenAttachmentName,
                    mimeType: 'text/plain',
                    contentBase64: Buffer.from(`board attachment forbidden fallback ${smokeSuffix}`, 'utf8').toString('base64')
                })
            }, 403, `Board non-author attachment create should be forbidden at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
            if (!hasNonEmptyText(extractApiMessage(attachmentCreateForbiddenResponse.payload))) {
                errors.push(`Board non-author attachment create forbidden response is missing a message at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }

            const attachmentListAfterForbiddenCreateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments`, {
                headers: authHeaders
            }, 200, `Board attachment list after forbidden create failed at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
            if (!Array.isArray(attachmentListAfterForbiddenCreateResponse.data)) {
                errors.push(`Board attachment list payload shape is invalid after forbidden create at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            if (attachmentListAfterForbiddenCreateResponse.data.length !== attachmentListCountBeforeForbiddenCreate) {
                errors.push(`Board attachment list count changed after forbidden create at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            if (attachmentListAfterForbiddenCreateResponse.data.some((attachment) => attachment?.originalName === forbiddenAttachmentName)) {
                errors.push(`Board forbidden attachment unexpectedly persisted at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            if (!attachmentListAfterForbiddenCreateResponse.data.some((attachment) => Number(attachment?.id) === attachmentId && attachment?.originalName === smokeAttachmentName)) {
                errors.push(`Board attachment changed after forbidden create at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }

            const attachmentDownloadResponse = await fetch(`${BASE_URL}/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments/${encodeURIComponent(attachmentId)}/download`, {
                headers: authHeaders
            });
            const attachmentDownloadText = await attachmentDownloadResponse.text();
            if (attachmentDownloadResponse.status !== 200) {
                errors.push(`Board attachment download failed at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}/download (expected 200, got ${attachmentDownloadResponse.status})`);
                return;
            }
            if (attachmentDownloadText !== smokeAttachmentBody) {
                errors.push(`Board attachment download payload is invalid at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}/download`);
                return;
            }
            if (!String(attachmentDownloadResponse.headers.get('content-disposition') || '').includes(encodeURIComponent(smokeAttachmentName))) {
                errors.push(`Board attachment download headers are invalid at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}/download`);
                return;
            }

            // [LOG: 20260429_0145] Keep attachment delete authorization out of shell-only PASS in HTTP fallback mode.
            const attachmentDeleteForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments/${encodeURIComponent(attachmentId)}`, {
                method: 'DELETE',
                headers: recommendHeaders
            }, 403, `Board non-author attachment delete should be forbidden at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}`);
            if (!hasNonEmptyText(extractApiMessage(attachmentDeleteForbiddenResponse.payload))) {
                errors.push(`Board non-author attachment delete forbidden response is missing a message at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}`);
                return;
            }

            const attachmentListAfterForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments`, {
                headers: authHeaders
            }, 200, `Board attachment list after forbidden delete failed at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
            if (!Array.isArray(attachmentListAfterForbiddenResponse.data)) {
                errors.push(`Board attachment list payload shape is invalid after forbidden delete at /api/boards/${boardId}/posts/${createdPostId}/attachments`);
                return;
            }
            if (!attachmentListAfterForbiddenResponse.data.some((attachment) => Number(attachment?.id) === attachmentId && attachment?.originalName === smokeAttachmentName)) {
                errors.push(`Board attachment changed after forbidden delete at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}`);
                return;
            }

            const attachmentDeleteResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments/${encodeURIComponent(attachmentId)}`, {
                method: 'DELETE',
                headers: authHeaders
            }, 200, `Board attachment delete failed at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}`);
            if (Number(attachmentDeleteResponse.data?.id) !== attachmentId) {
                errors.push(`Board attachment delete payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}/attachments/${attachmentId}`);
                return;
            }
            attachmentId = 0;
        } else {
            console.log(`ℹ️  Board ${boardId} has attachments disabled; attachment fallback checks skipped.`);
        }

        const recommendGuestResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/recommend`, {
            method: 'POST'
        }, 401, `Board guest recommend should require auth at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
        if (!hasNonEmptyText(extractApiMessage(recommendGuestResponse.payload))) {
            errors.push(`Board guest recommend unauthorized response is missing a message at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
            return;
        }

        const postDetailAfterGuestRecommendResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {}, 200, `Board post detail after guest recommend failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (Number(postDetailAfterGuestRecommendResponse.data?.post?.recommend || 0) !== expectedRecommendCount) {
            errors.push(`Board recommend count changed after guest recommend at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const recommendSuccessResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/recommend`, {
            method: 'POST',
            headers: recommendHeaders
        }, 200, `Board recommend failed at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
        if (extractBoardId(recommendSuccessResponse.data?.board) !== boardId || extractPostLocalId(recommendSuccessResponse.data?.post) !== createdPostId) {
            errors.push(`Board recommend success payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
            return;
        }
        expectedRecommendCount += 1;
        if (Number(recommendSuccessResponse.data?.post?.recommend) !== expectedRecommendCount) {
            errors.push(`Board recommend count did not increment at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
            return;
        }

        const recommendSelfResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/recommend`, {
            method: 'POST',
            headers: authHeaders
        }, 400, `Board recommend self-check failed at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
        if (!hasNonEmptyText(extractApiMessage(recommendSelfResponse.payload))) {
            errors.push(`Board recommend self-check message is empty at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
            return;
        }

        const recommendDuplicateResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/recommend`, {
            method: 'POST',
            headers: recommendHeaders
        }, 409, `Board recommend duplicate-check failed at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
        if (!hasNonEmptyText(extractApiMessage(recommendDuplicateResponse.payload))) {
            errors.push(`Board recommend duplicate-check message is empty at /api/boards/${boardId}/posts/${createdPostId}/recommend`);
            return;
        }

        const postDetailAfterRecommendResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {}, 200, `Board post detail after recommend failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (Number(postDetailAfterRecommendResponse.data?.post?.recommend) !== expectedRecommendCount) {
            errors.push(`Board recommend count did not persist at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        // [LOG: 20260429_0135] Keep board delete authorization out of shell-only PASS in HTTP fallback mode.
        const deleteForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {
            method: 'DELETE',
            headers: recommendHeaders
        }, 403, `Board non-author delete should be forbidden at /api/boards/${boardId}/posts/${createdPostId}`);
        if (!hasNonEmptyText(extractApiMessage(deleteForbiddenResponse.payload))) {
            errors.push(`Board non-author delete forbidden response is missing a message at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const deleteDetailAfterForbiddenResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {}, 200, `Board post detail after forbidden delete failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (extractPostLocalId(deleteDetailAfterForbiddenResponse.data?.post) !== createdPostId) {
            errors.push(`Board post detail is missing after forbidden delete at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }
        if (deleteDetailAfterForbiddenResponse.data?.post?.title !== updatedTitle
            || deleteDetailAfterForbiddenResponse.data?.post?.content !== updatedContent
            || Number(deleteDetailAfterForbiddenResponse.data?.post?.recommend || 0) !== expectedRecommendCount) {
            errors.push(`Board post changed after forbidden delete at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }

        const guestReplyResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: `board fallback guest reply ${smokeSuffix}`,
                content: `board fallback guest reply body ${smokeSuffix}`
            })
        }, 401, `Board guest reply should require auth at /api/boards/${boardId}/posts/${createdPostId}/reply`);
        if (!hasNonEmptyText(extractApiMessage(guestReplyResponse.payload))) {
            errors.push(`Board guest reply unauthorized response is missing a message at /api/boards/${boardId}/posts/${createdPostId}/reply`);
            return;
        }

        const boardListAfterGuestReplyResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}?page=1`, {}, 200, `Board list after guest reply failed at /api/boards/${boardId}?page=1`);
        if (countReplyThreadItems(extractBoardItems(boardListAfterGuestReplyResponse.data)) !== threadItemCountBeforeReply) {
            errors.push(`Board reply thread changed after guest reply at /api/boards/${boardId}/posts/${createdPostId}/reply`);
            return;
        }

        const replyResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/reply`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                title: `board fallback reply ${smokeSuffix}`,
                content: `board fallback reply body ${smokeSuffix}`
            })
        }, 201, `Board reply create failed at /api/boards/${boardId}/posts/${createdPostId}/reply`);
        if (extractBoardId(replyResponse.data?.board) !== boardId || !extractPostLocalId(replyResponse.data?.post) || extractPostLocalId(replyResponse.data?.post) === createdPostId) {
            errors.push(`Board reply payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}/reply`);
            return;
        }
        replyPostId = extractPostLocalId(replyResponse.data.post);

        const deleteReplyResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(replyPostId)}`, {
            method: 'DELETE',
            headers: authHeaders,
            body: JSON.stringify({
                userId: smokeUserId,
                nickName: smokeNickName
            })
        }, 200, `Board reply delete failed at /api/boards/${boardId}/posts/${replyPostId}`);
        if (extractPostLocalId(deleteReplyResponse.data?.post) !== replyPostId) {
            errors.push(`Board reply delete payload shape is invalid at /api/boards/${boardId}/posts/${replyPostId}`);
            return;
        }
        replyPostId = 0;

        const deleteCreatedResponse = await expectJsonResponse(`/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}`, {
            method: 'DELETE',
            headers: authHeaders,
            body: JSON.stringify({
                userId: smokeUserId,
                nickName: smokeNickName
            })
        }, 200, `Board post delete failed at /api/boards/${boardId}/posts/${createdPostId}`);
        if (extractPostLocalId(deleteCreatedResponse.data?.post) !== createdPostId) {
            errors.push(`Board post delete payload shape is invalid at /api/boards/${boardId}/posts/${createdPostId}`);
            return;
        }
        createdPostId = 0;
    } catch (error) {
        errors.push(error.message);
    } finally {
        if (attachmentId && cleanupBoardId && createdPostId) {
            try {
                await fetchJsonResponse(`/api/boards/${encodeURIComponent(cleanupBoardId)}/posts/${encodeURIComponent(createdPostId)}/attachments/${encodeURIComponent(attachmentId)}`, {
                    method: 'DELETE',
                    headers: authHeaders
                });
            } catch (cleanupError) {
                errors.push(`Board attachment cleanup failed at /api/boards/${cleanupBoardId}/posts/${createdPostId}/attachments/${attachmentId}: ${cleanupError.message}`);
            }
        }

        if (replyPostId && cleanupBoardId) {
            try {
                await fetchJsonResponse(`/api/boards/${encodeURIComponent(cleanupBoardId)}/posts/${encodeURIComponent(replyPostId)}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                    body: JSON.stringify({
                        userId: smokeUserId,
                        nickName: smokeNickName
                    })
                });
            } catch (cleanupError) {
                errors.push(`Board reply cleanup failed at /api/boards/${cleanupBoardId}/posts/${replyPostId}: ${cleanupError.message}`);
            }
        }

        if (createdPostId && cleanupBoardId) {
            try {
                await fetchJsonResponse(`/api/boards/${encodeURIComponent(cleanupBoardId)}/posts/${encodeURIComponent(createdPostId)}`, {
                    method: 'DELETE',
                    headers: authHeaders,
                    body: JSON.stringify({
                        userId: smokeUserId,
                        nickName: smokeNickName
                    })
                });
            } catch (cleanupError) {
                errors.push(`Board post cleanup failed at /api/boards/${cleanupBoardId}/posts/${createdPostId}: ${cleanupError.message}`);
            }
        }
    }
}

// [LOG: 20260428_2339] When Playwright is blocked, /memo should still prove
// auth-driven API behavior and browser module entry points instead of shell-only PASS.
// [LOG: 20260429_0021] Keep guest auth coverage on /api/memos/:memoId* so parameterized
// memo guards regressions surface even when Playwright cannot launch.
// [LOG: 20260429_0042] Authenticated /memo/:memoId fallback must also cover the direct route shell
// and memo-view hydration markers so detail-only restores are not left as shell-only PASS.
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

        const directRouteResponse = await fetch(`${BASE_URL}/memo/${encodeURIComponent(createdMemoId)}`);
        const directRouteContent = await directRouteResponse.text();
        if (!directRouteResponse.ok) {
            errors.push(`HTTP ${directRouteResponse.status} at /memo/${createdMemoId}`);
            return;
        }
        if (!hasNonEmptyText(directRouteContent)) {
            errors.push(`Empty page content at /memo/${createdMemoId}`);
            return;
        }
        if (!directRouteContent.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at /memo/${createdMemoId}`);
        }
        if (!directRouteContent.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at /memo/${createdMemoId}`);
        }
        if (!directRouteContent.includes('id="cmd-input"')) {
            errors.push(`Command input missing at /memo/${createdMemoId}`);
        }

        const memoWriteRouteResponse = await fetch(`${BASE_URL}/memo/write`);
        const memoWriteRouteContent = await memoWriteRouteResponse.text();
        if (!memoWriteRouteResponse.ok) {
            errors.push(`HTTP ${memoWriteRouteResponse.status} at /memo/write`);
            return;
        }
        if (!hasNonEmptyText(memoWriteRouteContent)) {
            errors.push('Empty page content at /memo/write');
            return;
        }
        if (!memoWriteRouteContent.includes(APP_SHELL_MARKER)) {
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

// [LOG: 20260429_0545] Password recovery bootstrap must stay pinned to the
// actual reset route so /log/login#type=recovery does not hijack auth entry.
async function verifyAuthRecoveryCoverage(errors) {
    console.log('🔐 Checking auth recovery route coverage via module harness...');

    const originalWindow = globalThis.window;

    async function expectAppShell(pathname) {
        const response = await fetch(`${BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${pathname}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${pathname}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${pathname}`);
        }
    }

    try {
        await expectAppShell('/log/login');
        await expectAppShell('/log/password');

        const moduleCache = new Map();
        const { createMenuService } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/menuService.js'), moduleCache);
        const { createAuthServiceBootstrap } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/authServiceBootstrap.js'), moduleCache);

        const menuService = createMenuService({
            apiFetch: async () => null,
            compareDoor: () => 0,
            state: {
                user: { isGuest: true },
                menuLookup: {},
                menuParents: {}
            }
        });

        if (!menuService.isPasswordResetRoutePath('/log/password')) {
            errors.push('menuService.isPasswordResetRoutePath() did not recognize /log/password as the recovery route');
        }
        if (menuService.isPasswordResetRoutePath('/log/login')) {
            errors.push('menuService.isPasswordResetRoutePath() incorrectly matched /log/login as the recovery route');
        }

        async function runBootstrapCase(pathname) {
            const state = {
                menuLookup: {},
                menuParents: {},
                _passwordRecoveryActive: false,
                _passwordResetMode: 'request'
            };

            globalThis.window = {
                location: {
                    pathname,
                    search: '',
                    hash: '#type=recovery'
                },
                localStorage: {
                    getItem() {
                        return null;
                    },
                    removeItem() {}
                },
                history: {
                    replaceState() {}
                },
                supabase: {
                    createClient() {
                        return {
                            auth: {
                                async getSession() {
                                    return {
                                        data: {
                                            session: { access_token: 'auth-recovery-smoke-token' }
                                        }
                                    };
                                },
                                onAuthStateChange() {
                                    return {
                                        data: {
                                            subscription: { unsubscribe() {} }
                                        }
                                    };
                                }
                            }
                        };
                    }
                }
            };

            const { initAuth } = createAuthServiceBootstrap({
                apiFetch: async (requestPath) => {
                    if (requestPath === '/api/auth/config') {
                        return {
                            enabled: true,
                            url: 'https://example.supabase.co',
                            publishableKey: 'sb_publishable_smoke'
                        };
                    }
                    return null;
                },
                getAuthLeafRoutePath: menuService.getAuthLeafRoutePath,
                isPasswordResetRoutePath: menuService.isPasswordResetRoutePath,
                showPasswordReset: async () => {},
                state,
                refreshUser: async () => {}
            });

            await initAuth();
            return state;
        }

        const loginState = await runBootstrapCase('/log/login');
        if (loginState._passwordRecoveryActive || loginState._passwordResetMode !== 'request') {
            errors.push(`Auth bootstrap incorrectly armed recovery mode on /log/login (got active=${Boolean(loginState._passwordRecoveryActive)}, mode=${loginState._passwordResetMode || 'empty'})`);
        }

        const passwordState = await runBootstrapCase('/log/password');
        if (!passwordState._passwordRecoveryActive || passwordState._passwordResetMode !== 'update') {
            errors.push(`Auth bootstrap did not arm recovery mode on /log/password (got active=${Boolean(passwordState._passwordRecoveryActive)}, mode=${passwordState._passwordResetMode || 'empty'})`);
        }
    } catch (error) {
        errors.push(`Auth recovery module harness failed: ${error.message}`);
    } finally {
        if (typeof originalWindow === 'undefined') {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
}

// [LOG: 20260429_0646] When Playwright is blocked, /log/login, /log/password,
// /log/signup/email, /log/signup/agree, and /log/signup/profile must still
// restore directly without depending on menu-tree hydration, and signup
// fallbacks must normalize back to the right auth entry route.
async function verifyAuthEntryRouteCoverage(errors) {
    console.log('🚪 Checking auth entry route coverage via module harness...');

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

    class StorageMock {
        constructor(seed = {}) {
            this.map = new Map(Object.entries(seed));
        }

        getItem(key) {
            return this.map.has(key) ? this.map.get(key) : null;
        }

        setItem(key, value) {
            this.map.set(key, String(value));
        }

        removeItem(key) {
            this.map.delete(key);
        }
    }

    class FakeElement {
        constructor(id) {
            this.id = id;
            this.value = '';
            this.innerHTML = '';
            this.textContent = '';
            this.style = {};
            this.listeners = new Map();
            this.classList = {
                add() {},
                remove() {}
            };
        }

        focus() {}

        select() {}

        addEventListener(type, handler) {
            this.listeners.set(type, handler);
        }

        querySelector() {
            return null;
        }

        querySelectorAll() {
            return [];
        }
    }

    async function expectAppShell(pathname) {
        const response = await fetch(`${BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${pathname}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${pathname}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${pathname}`);
        }
    }

    try {
        await expectAppShell('/log/signup');
        await expectAppShell('/log/signup/email');
        await expectAppShell('/log/signup/agree');
        await expectAppShell('/log/signup/profile');

        const moduleCache = new Map();
        const { createSignupModule } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/signupModule.js'), moduleCache);
        const { createSignupScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/signupScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        async function runAuthRouteCase({ pathname, pendingOAuth = null, signupPendingMethod = '', signupDraft = null }) {
            const state = {
                screen: 'main',
                _signupFlow: '',
                _oauthSignupError: '',
                _signupPendingMethod: signupPendingMethod,
                _signupDraft: signupDraft,
                user: { isGuest: true }
            };
            const screenEl = new FakeElement('terminal-screen');
            const hintEl = new FakeElement('cmd-hint');
            const cmdInput = new FakeElement('cmd-input');
            const elements = new Map([
                ['terminal-prompt-row', new FakeElement('terminal-prompt-row')],
                ['signup-inline-form', new FakeElement('signup-inline-form')],
                ['signup-field-hint', new FakeElement('signup-field-hint')],
                ['signup-userid', new FakeElement('signup-userid')],
                ['signup-password', new FakeElement('signup-password')],
                ['signup-password-confirm', new FakeElement('signup-password-confirm')],
                ['signup-nickname', new FakeElement('signup-nickname')],
                ['signup-email', new FakeElement('signup-email')],
                ['signup-oauth-userid', new FakeElement('signup-oauth-userid')],
                ['signup-oauth-nickname', new FakeElement('signup-oauth-nickname')],
                ['signup-oauth-confirm-input', new FakeElement('signup-oauth-confirm-input')],
                ['signup-oauth-field-hint', new FakeElement('signup-oauth-field-hint')],
                ['signup-confirm-input', new FakeElement('signup-confirm-input')],
                ['signup-agree-input', new FakeElement('signup-agree-input')],
                ['signup-agree-hint', new FakeElement('signup-agree-hint')]
            ]);
            const updateRequests = [];
            const footerVisibilityCalls = [];
            let loadMenuTreeCalls = 0;
            let loginCalls = 0;
            let passwordResetCalls = 0;
            const boardSelectCalls = [];

            globalThis.window = {
                location: {
                    pathname,
                    search: ''
                },
                history: {
                    replaceState(_state, _title, nextUrl) {
                        const [nextPath, query = ''] = String(nextUrl || '').split('?');
                        globalThis.window.location.pathname = nextPath || '/';
                        globalThis.window.location.search = query ? `?${query}` : '';
                    },
                    pushState(_state, _title, nextUrl) {
                        const [nextPath, query = ''] = String(nextUrl || '').split('?');
                        globalThis.window.location.pathname = nextPath || '/';
                        globalThis.window.location.search = query ? `?${query}` : '';
                    }
                },
                localStorage: new StorageMock(
                    pendingOAuth
                        ? { '01410-oauth-pending-profile': JSON.stringify(pendingOAuth) }
                        : {}
                ),
                sessionStorage: new StorageMock(),
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

            const getAuthLeafRoutePath = (leafKey) => `/log/${encodeURIComponent(String(leafKey || '').trim())}`;
            const { buildURLForState } = createRoutingUrlBuilder({
                getAuthLeafRoutePath,
                getMenuNodeRoutePath: (nodeOrKey) => (String(nodeOrKey || '').trim() === 'log' ? '/log' : '/'),
                showPostList: async () => {},
                showPostView: async () => {},
                state
            });

            const signupModule = createSignupModule({
                SIGNUP_PRIVACY_TEXT: ['privacy'],
                SIGNUP_TOS_TEXT: ['tos'],
                cmdInput,
                createSignupScreens,
                doSignup: async () => {},
                esc: escapeHtml,
                getCommandFooterText: () => '',
                getMenuNodeByKey: () => null,
                getMenuNodeLabel: (node) => String(node?.name || '회원가입'),
                getMenuParentNode: () => ({ name: '회원가입 / 로그인' }),
                hintEl,
                screenEl,
                searchMember: async () => null,
                // [LOG: 20260429_0710] Signup direct-route harness must verify
                // that inline-footer flows reopen the shared footer explicitly.
                setFooterVisibility: (visible) => {
                    footerVisibilityCalls.push(Boolean(visible));
                },
                setHint: () => {},
                setPrompt: () => {},
                showMain: async () => {
                    state.screen = 'main';
                },
                state,
                updateURL: async (replace = false) => {
                    const nextUrl = buildURLForState();
                    updateRequests.push({ replace, url: nextUrl });
                    if (replace) {
                        globalThis.window.history.replaceState({ screen: state.screen }, '', nextUrl);
                    } else {
                        globalThis.window.history.pushState({ screen: state.screen }, '', nextUrl);
                    }
                }
            });

            const restorer = createRoutingStateRestorer({
                getMenuNodeByKey: () => null,
                getMenuNodeKey: () => '',
                loadMenuTree: async () => {
                    loadMenuTreeCalls += 1;
                },
                logger: null,
                resolveMenuRoute: () => null,
                state,
                showBoardSelect: async (menuPath = 'top', search = '', fromHistory = false) => {
                    boardSelectCalls.push({ menuPath, search, fromHistory });
                    state.screen = 'board-select';
                    state.boardMenuPath = menuPath;
                },
                showChatLobby: async () => {},
                showChatRoom: async () => {},
                showHelp: async () => {},
                showHistory: async () => {},
                showLogin: async () => {
                    loginCalls += 1;
                    state.screen = 'login';
                },
                showMain: async () => {
                    state.screen = 'main';
                },
                showMemoList: async () => {},
                showMemoView: async () => {},
                showMemoWrite: async () => {},
                showMyInfo: async () => {},
                showNewsArticle: async () => {},
                showNewsList: async () => {},
                showNewsMenu: async () => {},
                showPasswordReset: async () => {
                    passwordResetCalls += 1;
                    state.screen = 'password-reset';
                },
                showAttachmentList: async () => {},
                showPostList: async () => {},
                showPostView: async () => {},
                showPostWrite: async () => {},
                showProfile: async () => {},
                showSignup: async (fromHistory, signupFlow) => signupModule.showSignup(fromHistory, signupFlow),
                showUnifiedPdsList: async () => {},
                showUnifiedPdsPost: async () => {},
                showWeatherMenu: async () => {},
                showWeatherView: async () => {},
                isUnifiedPdsBoardId: () => false
            });

            await restorer.restoreStateFromURL();

            return {
                boardSelectCalls,
                builtUrl: buildURLForState(),
                footerVisibilityCalls,
                hintEl,
                loadMenuTreeCalls,
                loginCalls,
                path: `${globalThis.window.location.pathname}${globalThis.window.location.search}`,
                passwordResetCalls,
                screenEl,
                state,
                updateRequests
            };
        }

        function assertSignupFooterRoute(caseData, routeLabel, expectedInputId) {
            if (!String(caseData.hintEl?.innerHTML || '').includes(`id="${expectedInputId}"`)) {
                errors.push(`${routeLabel} did not render ${expectedInputId} in the shared footer hint area`);
            }
            if (!caseData.footerVisibilityCalls.some((visible) => visible === true)) {
                errors.push(`${routeLabel} did not request shared footer visibility for the inline confirm input`);
            }
        }

        const loginCase = await runAuthRouteCase({ pathname: '/log/login' });
        if (loginCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth login direct route should not depend on loadMenuTree() for /log/login (got ${loginCase.loadMenuTreeCalls} calls)`);
        }
        if (loginCase.loginCalls !== 1 || loginCase.state.screen !== 'login') {
            errors.push('Auth login direct route did not invoke showLogin() for /log/login');
        }
        if (loginCase.boardSelectCalls.length !== 0) {
            errors.push('Auth login direct route incorrectly fell back to showBoardSelect() for /log/login');
        }
        if (loginCase.path !== '/log/login' || loginCase.builtUrl !== '/log/login') {
            errors.push(`Auth login direct route left URL state out of sync for /log/login (path=${loginCase.path}, built=${loginCase.builtUrl})`);
        }

        const passwordCase = await runAuthRouteCase({ pathname: '/log/password' });
        if (passwordCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth password direct route should not depend on loadMenuTree() for /log/password (got ${passwordCase.loadMenuTreeCalls} calls)`);
        }
        if (passwordCase.passwordResetCalls !== 1 || passwordCase.state.screen !== 'password-reset') {
            errors.push('Auth password direct route did not invoke showPasswordReset() for /log/password');
        }
        if (passwordCase.boardSelectCalls.length !== 0) {
            errors.push('Auth password direct route incorrectly fell back to showBoardSelect() for /log/password');
        }
        if (passwordCase.path !== '/log/password' || passwordCase.builtUrl !== '/log/password') {
            errors.push(`Auth password direct route left URL state out of sync for /log/password (path=${passwordCase.path}, built=${passwordCase.builtUrl})`);
        }

        const signupEmailCase = await runAuthRouteCase({ pathname: '/log/signup/email' });
        if (signupEmailCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup email direct route should not depend on loadMenuTree() for /log/signup/email (got ${signupEmailCase.loadMenuTreeCalls} calls)`);
        }
        if (signupEmailCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup email direct route incorrectly fell back to showBoardSelect() for /log/signup/email');
        }
        if (signupEmailCase.state.screen !== 'signup' || signupEmailCase.state._signupFlow !== 'email') {
            errors.push(`Auth signup email direct route did not restore the email flow for /log/signup/email (got screen=${signupEmailCase.state.screen}, flow=${signupEmailCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupEmailCase.screenEl.innerHTML || '').includes('signup-inline-form')) {
            errors.push('Auth signup email direct route did not render the inline email signup form for /log/signup/email');
        }
        if (signupEmailCase.path !== '/log/signup/email' || signupEmailCase.builtUrl !== '/log/signup/email') {
            errors.push(`Auth signup email direct route left URL state out of sync for /log/signup/email (path=${signupEmailCase.path}, built=${signupEmailCase.builtUrl})`);
        }
        if (!signupEmailCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/email')) {
            errors.push('Auth signup email direct route did not request replaceState URL sync for /log/signup/email');
        }
        assertSignupFooterRoute(signupEmailCase, 'Auth signup email direct route', 'signup-confirm-input');

        const signupAgreeFallbackCase = await runAuthRouteCase({ pathname: '/log/signup/agree' });
        if (signupAgreeFallbackCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup agree fallback direct route should not depend on loadMenuTree() for /log/signup/agree (got ${signupAgreeFallbackCase.loadMenuTreeCalls} calls)`);
        }
        if (signupAgreeFallbackCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup agree fallback direct route incorrectly fell back to showBoardSelect() instead of showSignup()');
        }
        if (signupAgreeFallbackCase.state.screen !== 'signup' || signupAgreeFallbackCase.state._signupFlow !== 'menu') {
            errors.push(`Auth signup agree fallback direct route did not fail closed to the signup menu for /log/signup/agree (got screen=${signupAgreeFallbackCase.state.screen}, flow=${signupAgreeFallbackCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupAgreeFallbackCase.screenEl.innerHTML || '').includes('entry-signup-method-list')) {
            errors.push('Auth signup agree fallback direct route did not render the signup menu when pending signup state is missing');
        }
        if (signupAgreeFallbackCase.path !== '/log/signup' || signupAgreeFallbackCase.builtUrl !== '/log/signup') {
            errors.push(`Auth signup agree fallback direct route did not normalize the URL back to /log/signup (path=${signupAgreeFallbackCase.path}, built=${signupAgreeFallbackCase.builtUrl})`);
        }
        if (!signupAgreeFallbackCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup')) {
            errors.push('Auth signup agree fallback direct route did not request replaceState URL sync back to /log/signup');
        }

        const signupAgreeEmailFallbackCase = await runAuthRouteCase({
            pathname: '/log/signup/agree',
            signupPendingMethod: '1'
        });
        if (signupAgreeEmailFallbackCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup agree email fallback should not depend on loadMenuTree() for /log/signup/agree (got ${signupAgreeEmailFallbackCase.loadMenuTreeCalls} calls)`);
        }
        if (signupAgreeEmailFallbackCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup agree email fallback incorrectly fell back to showBoardSelect() instead of showSignup()');
        }
        if (signupAgreeEmailFallbackCase.state.screen !== 'signup' || signupAgreeEmailFallbackCase.state._signupFlow !== 'email') {
            errors.push(`Auth signup agree email fallback did not normalize to the email form for /log/signup/agree (got screen=${signupAgreeEmailFallbackCase.state.screen}, flow=${signupAgreeEmailFallbackCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupAgreeEmailFallbackCase.screenEl.innerHTML || '').includes('signup-inline-form')) {
            errors.push('Auth signup agree email fallback did not render the inline email signup form when the draft is missing');
        }
        if (signupAgreeEmailFallbackCase.path !== '/log/signup/email' || signupAgreeEmailFallbackCase.builtUrl !== '/log/signup/email') {
            errors.push(`Auth signup agree email fallback did not normalize the URL to /log/signup/email (path=${signupAgreeEmailFallbackCase.path}, built=${signupAgreeEmailFallbackCase.builtUrl})`);
        }
        if (!signupAgreeEmailFallbackCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/email')) {
            errors.push('Auth signup agree email fallback did not request replaceState URL sync to /log/signup/email');
        }
        assertSignupFooterRoute(signupAgreeEmailFallbackCase, 'Auth signup agree email fallback', 'signup-confirm-input');

        const signupAgreeCase = await runAuthRouteCase({
            pathname: '/log/signup/agree',
            signupPendingMethod: '1',
            signupDraft: {
                userId: 'signup-smoke-user',
                password: 'secret123',
                passwordConfirm: 'secret123',
                nickName: 'signup-smoke',
                email: 'signup@example.com'
            }
        });
        if (signupAgreeCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup agree direct route should not depend on loadMenuTree() for /log/signup/agree (got ${signupAgreeCase.loadMenuTreeCalls} calls)`);
        }
        if (signupAgreeCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup agree direct route incorrectly fell back to showBoardSelect() for /log/signup/agree');
        }
        if (signupAgreeCase.state.screen !== 'signup' || signupAgreeCase.state._signupFlow !== 'agree') {
            errors.push(`Auth signup agree direct route did not restore the agreement flow for /log/signup/agree (got screen=${signupAgreeCase.state.screen}, flow=${signupAgreeCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupAgreeCase.screenEl.innerHTML || '').includes('entry-signup-agreement')) {
            errors.push('Auth signup agree direct route did not render the agreement screen for /log/signup/agree');
        }
        if (signupAgreeCase.path !== '/log/signup/agree' || signupAgreeCase.builtUrl !== '/log/signup/agree') {
            errors.push(`Auth signup agree direct route left URL state out of sync for /log/signup/agree (path=${signupAgreeCase.path}, built=${signupAgreeCase.builtUrl})`);
        }
        if (!signupAgreeCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/agree')) {
            errors.push('Auth signup agree direct route did not request replaceState URL sync for /log/signup/agree');
        }
        assertSignupFooterRoute(signupAgreeCase, 'Auth signup agree direct route', 'signup-agree-input');

        const oauthProfileCase = await runAuthRouteCase({
            pathname: '/log/signup/profile',
            pendingOAuth: {
                userId: 'oauth-smoke-user',
                nickName: 'oauth smoke',
                provider: 'google'
            }
        });
        if (oauthProfileCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup profile direct route should not depend on loadMenuTree() for /log/signup/profile (got ${oauthProfileCase.loadMenuTreeCalls} calls)`);
        }
        if (oauthProfileCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup profile direct route incorrectly fell back to showBoardSelect() for /log/signup/profile');
        }
        if (oauthProfileCase.state.screen !== 'signup' || oauthProfileCase.state._signupFlow !== 'oauth-profile') {
            errors.push(`Auth signup profile direct route did not restore oauth-profile flow for /log/signup/profile (got screen=${oauthProfileCase.state.screen}, flow=${oauthProfileCase.state._signupFlow || 'empty'})`);
        }
        if (!String(oauthProfileCase.screenEl.innerHTML || '').includes('signup-oauth-profile-form')) {
            errors.push('Auth signup profile direct route did not render the oauth profile form for /log/signup/profile');
        }
        if (oauthProfileCase.path !== '/log/signup/profile' || oauthProfileCase.builtUrl !== '/log/signup/profile') {
            errors.push(`Auth signup profile direct route left URL state out of sync for /log/signup/profile (path=${oauthProfileCase.path}, built=${oauthProfileCase.builtUrl})`);
        }
        if (!oauthProfileCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/profile')) {
            errors.push('Auth signup profile direct route did not request replaceState URL sync for /log/signup/profile');
        }
        assertSignupFooterRoute(oauthProfileCase, 'Auth signup profile direct route', 'signup-oauth-confirm-input');

        const signupFallbackCase = await runAuthRouteCase({ pathname: '/log/signup/profile' });
        if (signupFallbackCase.loadMenuTreeCalls !== 0) {
            errors.push(`Auth signup fallback direct route should not depend on loadMenuTree() for /log/signup/profile (got ${signupFallbackCase.loadMenuTreeCalls} calls)`);
        }
        if (signupFallbackCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup fallback direct route incorrectly fell back to showBoardSelect() instead of showSignup()');
        }
        if (signupFallbackCase.state.screen !== 'signup' || signupFallbackCase.state._signupFlow !== 'menu') {
            errors.push(`Auth signup fallback direct route did not fail closed to the signup menu for /log/signup/profile (got screen=${signupFallbackCase.state.screen}, flow=${signupFallbackCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupFallbackCase.screenEl.innerHTML || '').includes('entry-signup-method-list')) {
            errors.push('Auth signup fallback direct route did not render the signup menu when oauth state is missing');
        }
        if (signupFallbackCase.path !== '/log/signup' || signupFallbackCase.builtUrl !== '/log/signup') {
            errors.push(`Auth signup fallback direct route did not normalize the URL back to /log/signup (path=${signupFallbackCase.path}, built=${signupFallbackCase.builtUrl})`);
        }
        if (!signupFallbackCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup')) {
            errors.push('Auth signup fallback direct route did not request replaceState URL sync back to /log/signup');
        }
    } catch (error) {
        errors.push(`Auth entry module harness failed: ${error.message}`);
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

// [LOG: 20260429_0556] When Playwright is blocked, /profile/:userId must still
// restore the target member screen and keep valid profile markup/url state.
async function verifyProfileRouteCoverage(errors) {
    console.log('👤 Checking profile route coverage via module harness...');

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

    async function expectAppShell(pathname) {
        const response = await fetch(`${BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(APP_SHELL_MARKER)) {
            errors.push(`App shell module entry missing at ${pathname}`);
        }

        if (!content.includes('id="terminal-wrapper"')) {
            errors.push(`Terminal wrapper missing at ${pathname}`);
        }

        if (!content.includes('id="cmd-input"')) {
            errors.push(`Command input missing at ${pathname}`);
        }
    }

    try {
        // [LOG: 20260429_0606] Missing profile lookups must stay in-band so
        // /profile/:userId can render an error screen without 404 console noise.
        const missingProfileLookupResponse = await fetchJsonResponse('/api/members/smoke-route-user?allowMissing=1');
        if (missingProfileLookupResponse.parseError) {
            throw new Error(`Invalid JSON at /api/members/smoke-route-user?allowMissing=1: ${missingProfileLookupResponse.parseError.message}`);
        }
        if (missingProfileLookupResponse.status !== 200) {
            throw new Error(`Expected 200 at /api/members/smoke-route-user?allowMissing=1, got ${missingProfileLookupResponse.status}`);
        }
        if (missingProfileLookupResponse.data?.found !== false || missingProfileLookupResponse.data?.member !== null) {
            errors.push('Missing profile lookup did not return { found: false, member: null } for /api/members/:userId?allowMissing=1');
        }

        await expectAppShell('/profile/smoke-route-user');

        const moduleCache = new Map();
        const { createProfileScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/profileScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            _profileUserId: ''
        };
        const screenEl = {
            innerHTML: ''
        };
        const updateRequests = [];
        const apiRequests = [];
        let lastHint = '';
        let lastPrompt = '';
        let loadMenuTreeCalls = 0;

        globalThis.window = {
            location: {
                pathname: '/profile/demo-user',
                search: ''
            },
            history: {
                replaceState(_state, _title, nextUrl) {
                    const [nextPath, query = ''] = String(nextUrl || '').split('?');
                    globalThis.window.location.pathname = nextPath || '/';
                    globalThis.window.location.search = query ? `?${query}` : '';
                },
                pushState(_state, _title, nextUrl) {
                    const [nextPath, query = ''] = String(nextUrl || '').split('?');
                    globalThis.window.location.pathname = nextPath || '/';
                    globalThis.window.location.search = query ? `?${query}` : '';
                }
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

        const { buildURLForState } = createRoutingUrlBuilder({
            getAuthLeafRoutePath: (leafKey) => `/log/${encodeURIComponent(String(leafKey || '').trim())}`,
            getMenuNodeRoutePath: () => '/',
            showPostList: async () => {},
            showPostView: async () => {},
            state
        });
        const profileScreens = createProfileScreens({
            apiFetch: async (requestPath) => {
                apiRequests.push(requestPath);
                if (requestPath === '/api/members/demo-user?allowMissing=1') {
                    return {
                        found: true,
                        member: {
                            userId: 'demo-user',
                            nickName: 'demo-user',
                            level: 2,
                            isAdmin: false,
                            registrationDateTime: '2026-04-29'
                        }
                    };
                }
                if (requestPath === '/api/members/smoke-route-user?allowMissing=1') {
                    return {
                        found: false,
                        member: null
                    };
                }
                return null;
            },
            cmdInput: { focus() {} },
            esc: escapeHtml,
            getCommandFooterText: () => 'PROFILE FOOTER',
            getSupportedFooterText: () => 'PROFILE FOOTER',
            screenEl,
            setHint: (value) => {
                lastHint = String(value || '');
            },
            setPrompt: (value) => {
                lastPrompt = String(value || '');
            },
            state,
            updateURL: async (replace = false) => {
                const nextUrl = buildURLForState();
                updateRequests.push({ replace, url: nextUrl });
                if (replace) {
                    globalThis.window.history.replaceState({ screen: state.screen }, '', nextUrl);
                } else {
                    globalThis.window.history.pushState({ screen: state.screen }, '', nextUrl);
                }
            }
        });

        const restorer = createRoutingStateRestorer({
            getMenuNodeByKey: () => null,
            getMenuNodeKey: () => '',
            loadMenuTree: async () => {
                loadMenuTreeCalls += 1;
            },
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
            showMemoList: async () => {},
            showMemoView: async () => {},
            showMemoWrite: async () => {},
            showMyInfo: async () => {},
            showNewsArticle: async () => {},
            showNewsList: async () => {},
            showNewsMenu: async () => {},
            showPasswordReset: async () => {},
            showAttachmentList: async () => {},
            showPostList: async () => {},
            showPostView: async () => {},
            showPostWrite: async () => {},
            showProfile: async (userId, fromHistory) => profileScreens.showProfile(userId, fromHistory),
            showSignup: async () => {},
            showUnifiedPdsList: async () => {},
            showUnifiedPdsPost: async () => {},
            showWeatherMenu: async () => {},
            showWeatherView: async () => {},
            isUnifiedPdsBoardId: () => false
        });

        await restorer.restoreStateFromURL();

        if (loadMenuTreeCalls !== 0) {
            errors.push(`Profile direct route should not depend on loadMenuTree() for /profile/:userId (got ${loadMenuTreeCalls} calls)`);
        }
        if (state.screen !== 'profile') {
            errors.push('Profile direct route did not restore state.screen="profile" for /profile/:userId');
        }
        if (state._profileUserId !== 'demo-user') {
            errors.push(`Profile direct route did not preserve the target user id for /profile/:userId (got ${state._profileUserId || 'empty'})`);
        }
        if (apiRequests.length !== 1 || apiRequests[0] !== '/api/members/demo-user?allowMissing=1') {
            errors.push(`Profile direct route did not fetch the expected member payload for /profile/:userId (got ${apiRequests.join(', ') || 'no calls'})`);
        }
        if (lastHint !== 'PROFILE FOOTER') {
            errors.push(`Profile direct route did not restore the profile footer hint (got ${lastHint || 'empty'})`);
        }
        if (lastPrompt !== '>>') {
            errors.push(`Profile direct route did not restore the default prompt for /profile/:userId (got ${lastPrompt || 'empty'})`);
        }
        if (updateRequests.length !== 0) {
            errors.push('Profile direct route should not push or replace history while restoring /profile/:userId');
        }
        if (buildURLForState() !== '/profile/demo-user') {
            errors.push(`Profile URL builder did not stay in sync for /profile/:userId (got ${buildURLForState()})`);
        }
        if (`${globalThis.window.location.pathname}${globalThis.window.location.search}` !== '/profile/demo-user') {
            errors.push(`Profile direct route changed the browser URL unexpectedly for /profile/:userId (got ${globalThis.window.location.pathname}${globalThis.window.location.search})`);
        }

        const renderedProfile = String(screenEl.innerHTML || '').trim();
        if (!renderedProfile.includes('사용자 정보 (PROFILE)')) {
            errors.push('Profile direct route did not render the profile title for /profile/:userId');
        }
        if (!renderedProfile.includes('아이디  : demo-user')) {
            errors.push('Profile direct route did not render the target member id for /profile/:userId');
        }
        if (!renderedProfile.endsWith('</div>')) {
            errors.push('Profile screen markup did not close the wrapper container for /profile/:userId');
        }

        globalThis.window.location.pathname = '/profile/smoke-route-user';
        globalThis.window.location.search = '';
        screenEl.innerHTML = '';
        lastHint = '';
        lastPrompt = '';

        await restorer.restoreStateFromURL();

        if (loadMenuTreeCalls !== 0) {
            errors.push(`Missing profile direct route should not depend on loadMenuTree() for /profile/:userId (got ${loadMenuTreeCalls} calls)`);
        }
        if (state.screen !== 'profile') {
            errors.push('Missing profile direct route did not keep state.screen="profile" for /profile/:userId');
        }
        if (state._profileUserId !== 'smoke-route-user') {
            errors.push(`Missing profile direct route did not preserve the missing target user id (got ${state._profileUserId || 'empty'})`);
        }
        if (apiRequests.length !== 2 || apiRequests[1] !== '/api/members/smoke-route-user?allowMissing=1') {
            errors.push(`Missing profile direct route did not fetch the allowMissing lookup for /profile/:userId (got ${apiRequests.join(', ') || 'no calls'})`);
        }
        if (lastHint !== 'PROFILE FOOTER') {
            errors.push(`Missing profile direct route did not restore the profile footer hint (got ${lastHint || 'empty'})`);
        }
        if (lastPrompt !== '>>') {
            errors.push(`Missing profile direct route did not restore the default prompt for /profile/:userId (got ${lastPrompt || 'empty'})`);
        }
        if (updateRequests.length !== 0) {
            errors.push('Missing profile direct route should not push or replace history while restoring /profile/:userId');
        }
        if (buildURLForState() !== '/profile/smoke-route-user') {
            errors.push(`Profile URL builder did not stay in sync for missing /profile/:userId (got ${buildURLForState()})`);
        }
        if (`${globalThis.window.location.pathname}${globalThis.window.location.search}` !== '/profile/smoke-route-user') {
            errors.push(`Missing profile direct route changed the browser URL unexpectedly for /profile/:userId (got ${globalThis.window.location.pathname}${globalThis.window.location.search})`);
        }

        const missingProfileMarkup = String(screenEl.innerHTML || '').trim();
        if (!missingProfileMarkup.includes('회원 정보를 찾을 수 없습니다.')) {
            errors.push('Missing profile direct route did not render the missing-member message for /profile/:userId');
        }
        if (!missingProfileMarkup.includes('대상 ID : smoke-route-user')) {
            errors.push('Missing profile direct route did not render the missing target member id for /profile/:userId');
        }
        if (!missingProfileMarkup.endsWith('</div>')) {
            errors.push('Missing profile screen markup did not close the wrapper container for /profile/:userId');
        }
    } catch (error) {
        errors.push(`Profile module harness failed: ${error.message}`);
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

// [LOG: 20260429_0010] When Playwright is blocked, /myinfo must prove
// auth-protected profile/password/delete behavior instead of route-shell coverage only.
async function verifyHttpMyInfoCoverage(errors) {
    console.log('🙍 Checking myinfo API coverage via HTTP fallback...');
    const smokeSuffix = String(Date.now()).slice(-6);
    const smokeUserId = `myinfo-fallback-${smokeSuffix}`;
    const smokeNickName = `myinfo${smokeSuffix}`;
    const smokeEmail = `${smokeUserId}@example.com`;
    const authHeaders = {
        'x-bbs-user-id': smokeUserId,
        'x-bbs-nick-name': smokeNickName
    };
    let shouldCleanup = false;

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
        const guestProfileResponse = await expectJsonResponse('/api/members/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickName: '게스트차단',
                email: smokeEmail
            })
        }, 401, 'Guest myinfo profile update should require auth at POST /api/members/profile');
        if (!hasNonEmptyText(extractApiMessage(guestProfileResponse.payload))) {
            errors.push('Guest myinfo profile update unauthorized response is missing a message at POST /api/members/profile');
            return;
        }

        const guestPasswordResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: '1234' })
        }, 401, `Guest myinfo password change should require auth at POST /api/members/${smokeUserId}/password`);
        if (!hasNonEmptyText(extractApiMessage(guestPasswordResponse.payload))) {
            errors.push(`Guest myinfo password change unauthorized response is missing a message at POST /api/members/${smokeUserId}/password`);
            return;
        }

        const guestDeleteResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}`, {
            method: 'DELETE'
        }, 401, `Guest myinfo delete should require auth at DELETE /api/members/${smokeUserId}`);
        if (!hasNonEmptyText(extractApiMessage(guestDeleteResponse.payload))) {
            errors.push(`Guest myinfo delete unauthorized response is missing a message at DELETE /api/members/${smokeUserId}`);
            return;
        }

        const authedProfileResponse = await expectJsonResponse('/api/members/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
                nickName: smokeNickName,
                email: smokeEmail
            })
        }, 200, 'Authenticated myinfo profile update failed at POST /api/members/profile');
        shouldCleanup = true;
        if (authedProfileResponse.data?.userId !== smokeUserId || authedProfileResponse.data?.nickName !== smokeNickName || authedProfileResponse.data?.email !== smokeEmail) {
            errors.push('Authenticated myinfo profile payload shape is invalid at POST /api/members/profile');
            return;
        }

        const authedMemberResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}`, {
            headers: authHeaders
        }, 200, `Authenticated myinfo detail failed at GET /api/members/${smokeUserId}`);
        if (authedMemberResponse.data?.userId !== smokeUserId || authedMemberResponse.data?.nickName !== smokeNickName) {
            errors.push(`Authenticated myinfo detail payload shape is invalid at GET /api/members/${smokeUserId}`);
            return;
        }

        const authedPasswordResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ password: 'myinfo-1234' })
        }, 200, `Authenticated myinfo password change failed at POST /api/members/${smokeUserId}/password`);
        if (authedPasswordResponse.data?.userId !== smokeUserId || authedPasswordResponse.data?.nickName !== smokeNickName) {
            errors.push(`Authenticated myinfo password payload shape is invalid at POST /api/members/${smokeUserId}/password`);
            return;
        }

        const authedDeleteResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}`, {
            method: 'DELETE',
            headers: authHeaders
        }, 200, `Authenticated myinfo delete failed at DELETE /api/members/${smokeUserId}`);
        if (authedDeleteResponse.data?.success !== true || authedDeleteResponse.data?.member?.userId !== smokeUserId) {
            errors.push(`Authenticated myinfo delete payload shape is invalid at DELETE /api/members/${smokeUserId}`);
            return;
        }
        shouldCleanup = false;

        const deletedMemberResponse = await expectJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}`, {}, 404, `Deleted myinfo member should not be readable at GET /api/members/${smokeUserId}`);
        if (!hasNonEmptyText(extractApiMessage(deletedMemberResponse.payload))) {
            errors.push(`Deleted myinfo member response is missing a message at GET /api/members/${smokeUserId}`);
        }
    } catch (error) {
        errors.push(error.message);
    } finally {
        if (shouldCleanup) {
            try {
                await fetchJsonResponse(`/api/members/${encodeURIComponent(smokeUserId)}`, {
                    method: 'DELETE',
                    headers: authHeaders
                });
            } catch (cleanupError) {
                errors.push(`Myinfo cleanup failed for /api/members/${smokeUserId}: ${cleanupError.message}`);
            }
        }
    }
}

// [LOG: 20260429_0524] When Playwright stays blocked, /myinfo must still prove
// guest direct-route and stale command states fail closed instead of exposing edit flows.
async function verifyMyInfoRouteCoverage(errors) {
    console.log('🙍 Checking myinfo route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const guestGuardMessage = '정보관리 및 프로필 편집은 로그인 후 사용하실 수 있습니다.';

    try {
        const moduleCache = new Map();
        const { createMyInfoActions } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/myInfoActions.js'), moduleCache);
        const { createMyInfoCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterMyInfo.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);

        const state = {
            screen: 'main',
            user: {
                userId: 'guest',
                nickName: '손님',
                isGuest: true
            },
            _myInfoMode: 'view',
            _myInfoDraft: {},
            _myInfoMessage: '',
            _myInfoMessageType: ''
        };
        const hints = [];
        const prompts = [];
        const showMainCalls = [];
        const renderCalls = [];

        function resetMyInfoState() {
            state._myInfoMode = 'view';
            state._myInfoDraft = {};
            state._myInfoMessage = '';
            state._myInfoMessageType = '';
        }

        const setHint = (value) => {
            hints.push(String(value || ''));
        };
        const setPrompt = (value) => {
            prompts.push(String(value || ''));
        };
        const showMain = async () => {
            showMainCalls.push({ mode: state._myInfoMode, screen: state.screen });
            state.screen = 'main';
            if (globalThis.window?.location) {
                globalThis.window.location.pathname = '/';
                globalThis.window.location.search = '';
            }
        };

        globalThis.window = {
            location: {
                pathname: '/myinfo',
                search: ''
            },
            matchMedia: () => ({ matches: false })
        };
        globalThis.document = {
            getElementById: () => null
        };

        const myInfoActions = createMyInfoActions({
            apiFetch: async () => {
                throw new Error('guest myinfo guard should not call apiFetch');
            },
            doLogout: async () => {},
            guestUser: () => ({
                userId: 'guest',
                nickName: '손님',
                isGuest: true
            }),
            showMain,
            state,
            setHint,
            setPrompt,
            renderMyInfo: async () => {
                renderCalls.push({ mode: state._myInfoMode, screen: state.screen });
                state.screen = 'myinfo';
            },
            clearDraft: () => {
                state._myInfoDraft = {};
            },
            clearMessage: () => {
                state._myInfoMessage = '';
                state._myInfoMessageType = '';
            },
            resetMyInfoState,
            setDraft: (draft) => {
                state._myInfoDraft = { ...(state._myInfoDraft || {}), ...(draft || {}) };
            },
            setMessage: (message, messageType) => {
                state._myInfoMessage = String(message || '');
                state._myInfoMessageType = String(messageType || '');
            },
            setMode: (mode) => {
                state._myInfoMode = String(mode || 'view').trim().toLowerCase() || 'view';
            }
        });

        const restorer = createRoutingStateRestorer({
            getMenuNodeByKey: () => null,
            getMenuNodeKey: () => null,
            loadMenuTree: async () => {},
            resolveMenuRoute: () => null,
            state,
            showBoardSelect: async () => {},
            showChatLobby: async () => {},
            showChatRoom: async () => {},
            showHelp: async () => {},
            showHistory: async () => {},
            showLogin: async () => {},
            showMain,
            showMemoList: async () => {},
            showMemoView: async () => {},
            showMemoWrite: async () => {},
            showMyInfo: myInfoActions.showMyInfo,
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

        if (showMainCalls.length !== 1) {
            errors.push(`Guest /myinfo direct route should redirect to main exactly once (got ${showMainCalls.length})`);
        }
        if (state.screen !== 'main') {
            errors.push(`Guest /myinfo direct route should stay on main instead of ${state.screen || 'unknown'}`);
        }
        if (renderCalls.length !== 0) {
            errors.push(`Guest /myinfo direct route unexpectedly rendered myinfo ${renderCalls.length} time(s)`);
        }
        if ((hints[hints.length - 1] || '') !== guestGuardMessage) {
            errors.push(`Guest /myinfo direct route is missing the login-required hint (got ${hints[hints.length - 1] || 'none'})`);
        }
        if ((prompts[prompts.length - 1] || '') !== '>>') {
            errors.push(`Guest /myinfo direct route did not restore the default prompt (got ${prompts[prompts.length - 1] || 'none'})`);
        }
        if (globalThis.window.location.pathname !== '/') {
            errors.push(`Guest /myinfo direct route did not redirect the URL back to / (got ${globalThis.window.location.pathname || 'none'})`);
        }

        const handleMyInfoCommand = createMyInfoCommandHandler({
            ...myInfoActions,
            showMain,
            state
        });
        const staleGuestCommands = [
            { cmd: 'N', label: 'nickname' },
            { cmd: 'PW', label: 'password' },
            { cmd: 'X', label: 'delete' }
        ];

        for (const entry of staleGuestCommands) {
            state.screen = 'myinfo';
            resetMyInfoState();
            hints.length = 0;
            prompts.length = 0;
            showMainCalls.length = 0;
            renderCalls.length = 0;
            globalThis.window.location.pathname = '/myinfo';
            globalThis.window.location.search = '';

            const handled = await handleMyInfoCommand({ cmd: entry.cmd, context: {} });

            if (!handled) {
                errors.push(`Guest myinfo ${entry.label} command was not handled on a stale myinfo screen`);
                continue;
            }
            if (showMainCalls.length !== 1) {
                errors.push(`Guest myinfo ${entry.label} command should redirect to main exactly once (got ${showMainCalls.length})`);
            }
            if (state.screen !== 'main') {
                errors.push(`Guest myinfo ${entry.label} command should stay on main instead of ${state.screen || 'unknown'}`);
            }
            if (renderCalls.length !== 0) {
                errors.push(`Guest myinfo ${entry.label} command unexpectedly rendered myinfo ${renderCalls.length} time(s)`);
            }
            if ((hints[hints.length - 1] || '') !== guestGuardMessage) {
                errors.push(`Guest myinfo ${entry.label} command is missing the login-required hint (got ${hints[hints.length - 1] || 'none'})`);
            }
            if ((prompts[prompts.length - 1] || '') !== '>>') {
                errors.push(`Guest myinfo ${entry.label} command did not restore the default prompt (got ${prompts[prompts.length - 1] || 'none'})`);
            }
        }
    } catch (error) {
        errors.push(`Myinfo module harness failed: ${error.message}`);
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

// [LOG: 20260429_0414] Strip broader CSI control sequences in the harness so
// ANSI-based module coverage asserts on actual rendered text, not cursor codes.
function stripHarnessAnsi(text) {
    return String(text || '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function ansiToHTMLHarnessStub(text) {
    const plainText = stripHarnessAnsi(text);
    return {
        html: plainText,
        rows: plainText.split('\n')
    };
}

function loadBrowserHarnessModule(modulePath, cache) {
    const resolvedPath = path.resolve(modulePath);
    if (cache.has(resolvedPath)) {
        return cache.get(resolvedPath);
    }

    let source = fs.readFileSync(resolvedPath, 'utf8');
    const exportNames = [];

    source = source.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?/g, (_match, bindings, specifier) => {
        const resolvedImportPath = path.resolve(path.dirname(resolvedPath), specifier);
        return `const { ${bindings.trim()} } = __loadModule(${JSON.stringify(resolvedImportPath)});`;
    });
    source = source.replace(/export async function (\w+)\s*\(/g, (_match, name) => {
        exportNames.push(name);
        return `async function ${name}(`;
    });
    source = source.replace(/export function (\w+)\s*\(/g, (_match, name) => {
        exportNames.push(name);
        return `function ${name}(`;
    });
    source = source.replace(/export const (\w+)\s*=/g, (_match, name) => {
        exportNames.push(name);
        return `const ${name} =`;
    });
    source = source.replace(/export class (\w+)\s*/g, (_match, name) => {
        exportNames.push(name);
        return `class ${name} `;
    });
    source = source.replace(/export\s+\{([^}]+)\};?/g, (_match, bindings) => {
        const aliasStatements = [];
        String(bindings || '')
            .split(',')
            .map((binding) => binding.trim())
            .filter(Boolean)
            .forEach((binding) => {
                const aliasMatch = binding.match(/^(\w+)\s+as\s+(\w+)$/);
                if (aliasMatch) {
                    exportNames.push(aliasMatch[2]);
                    aliasStatements.push(`const ${aliasMatch[2]} = ${aliasMatch[1]};`);
                    return;
                }

                exportNames.push(binding);
            });
        return aliasStatements.join('\n');
    });

    const uniqueExportNames = [...new Set(exportNames)];
    const wrapper = new Function('__loadModule', `${source}\nreturn { ${uniqueExportNames.join(', ')} };`);
    const moduleExports = wrapper((nextModulePath) => loadBrowserHarnessModule(nextModulePath, cache));
    cache.set(resolvedPath, moduleExports);
    return moduleExports;
}

// [LOG: 20260429_0515] When Playwright stays blocked, /memo/write must still
// prove authenticated direct-route restore into the compose screen instead of
// silently collapsing back to the memo list after reload/history restore.
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
        const { createMemoScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/memoScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

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
        const screenEl = {
            innerHTML: ''
        };
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
        if (!String(screenEl.innerHTML || '').includes('id="memo-form"')) {
            errors.push('Memo write direct route did not render the compose form for /memo/write');
        }
        if (!String(screenEl.innerHTML || '').includes('쪽지 보내기')) {
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

// [LOG: 20260429_0355] When Playwright is blocked, /help must still prove
// that later pages keep ?page=N and restore the same page on direct reload.
async function verifyHelpCoverage(errors) {
    console.log('🧾 Checking help route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createHelpScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/helpScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            page: 1,
            helpTotalPages: 1
        };
        const screenEl = {
            innerHTML: '',
            querySelector() {
                return null;
            }
        };
        const pushedUrls = [];

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/help',
                search: ''
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
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
        const { showHelp } = createHelpScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async () => {},
            cmdInput: { focus() {} },
            displayWidth: (value = '') => String(value || '').length,
            getCommandFooterText: () => '',
            isWideChar: () => false,
            screenEl,
            state,
            updateURL: () => {
                pushedUrls.push(buildURLForState());
            }
        });

        await showHelp('', 1);
        const pageOneRender = String(screenEl.innerHTML || '');
        await showHelp('', 2);
        const pageTwoRender = String(screenEl.innerHTML || '');

        if (state.screen !== 'help') {
            errors.push('Help screen did not activate state.screen="help" in helpScreens.showHelp()');
        }
        if (state.helpTotalPages < 2) {
            errors.push('Help screen did not expose multiple pages for pagination coverage');
        }
        if (state.page !== 2) {
            errors.push(`Help screen did not normalize page 2 correctly (got ${state.page})`);
        }
        if (pageOneRender === pageTwoRender) {
            errors.push('Help screen did not change rendered content between page 1 and page 2');
        }
        if (buildURLForState() !== '/help?page=2') {
            errors.push(`Help URL builder did not keep page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== '/help?page=2') {
            errors.push('Help pagination did not request /help?page=2 when navigating to the next page');
        }

        let restoreArgs = null;
        globalThis.window.location.search = '?page=2';
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
            showHelp: async (cmdKey = '', options = 1) => {
                restoreArgs = { cmdKey, options };
                return await showHelp(cmdKey, options);
            },
            showHistory: async () => {},
            showLogin: async () => {},
            showMain: async () => {
                state.screen = 'main';
            },
            showMemoList: async () => {},
            showMemoView: async () => {},
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

        state.screen = 'main';
        state.page = 1;
        state.helpTotalPages = 1;
        screenEl.innerHTML = '';
        await restorer.restoreStateFromURL();

        if (restoreArgs?.cmdKey !== '' || restoreArgs?.options?.fromHistory !== true || restoreArgs?.options?.page !== 2) {
            errors.push('Help direct route did not invoke showHelp() with { fromHistory: true, page: 2 } for /help?page=2');
        }
        if (state.screen !== 'help') {
            errors.push('Help direct route did not restore the help screen for /help?page=2');
        }
        if (state.page !== 2) {
            errors.push(`Help direct route did not restore page 2 for /help?page=2 (got ${state.page})`);
        }
        if (String(screenEl.innerHTML || '') !== pageTwoRender) {
            errors.push('Help direct route did not restore the same rendered page for /help?page=2');
        }
        if (buildURLForState() !== '/help?page=2') {
            errors.push(`Help direct route left help URL state out of sync for page 2 (got ${buildURLForState()})`);
        }
    } catch (error) {
        errors.push(`Help module harness failed: ${error.message}`);
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

// [LOG: 20260429_0348] When Playwright is blocked, /history must still prove
// newest-first command ordering and direct-route restore at module level.
async function verifyHistoryCoverage(errors) {
    console.log('🕘 Checking history route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createHelpScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/helpScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);

        const state = {
            screen: 'main',
            cmdHistory: [
                { cmd: 'LATEST', screen: 'main', ts: 3 },
                { cmd: 'MIDDLE', screen: 'help', ts: 2 },
                { cmd: 'OLDEST', screen: 'history', ts: 1 }
            ]
        };
        const screenEl = {
            innerHTML: '',
            querySelector() {
                return null;
            }
        };

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/history',
                search: ''
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

        const { showHistory } = createHelpScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async () => {},
            cmdInput: { focus() {} },
            displayWidth: (value = '') => String(value || '').length,
            getCommandFooterText: () => '',
            isWideChar: () => false,
            screenEl,
            state,
            updateURL: () => {}
        });

        await showHistory();
        if (state.screen !== 'history') {
            errors.push('History screen did not activate state.screen="history" in helpScreens.showHistory()');
        }

        const initialRender = String(screenEl.innerHTML || '');
        const latestIndex = initialRender.indexOf('LATEST');
        const middleIndex = initialRender.indexOf('MIDDLE');
        const oldestIndex = initialRender.indexOf('OLDEST');
        if (latestIndex < 0 || middleIndex < 0 || oldestIndex < 0) {
            errors.push('History screen did not render expected command entries for /history');
        } else if (!(latestIndex < middleIndex && middleIndex < oldestIndex)) {
            errors.push('History screen should render newest-first command history on /history');
        }

        let restoreCalls = 0;
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
            showHistory: async () => {
                restoreCalls += 1;
                return await showHistory();
            },
            showLogin: async () => {},
            showMain: async () => {
                state.screen = 'main';
            },
            showMemoList: async () => {},
            showMemoView: async () => {},
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

        state.screen = 'main';
        screenEl.innerHTML = '';
        await restorer.restoreStateFromURL();

        if (restoreCalls !== 1) {
            errors.push('History direct route did not invoke showHistory() for /history');
        }
        if (state.screen !== 'history') {
            errors.push('History direct route did not restore the history screen for /history');
        }

        const restoredRender = String(screenEl.innerHTML || '');
        const restoredLatestIndex = restoredRender.indexOf('LATEST');
        const restoredOldestIndex = restoredRender.indexOf('OLDEST');
        if (restoredLatestIndex < 0 || restoredOldestIndex < 0) {
            errors.push('History direct route did not render expected command entries for /history');
        } else if (!(restoredLatestIndex < restoredOldestIndex)) {
            errors.push('History direct route restored stale command ordering on /history');
        }
    } catch (error) {
        errors.push(`History module harness failed: ${error.message}`);
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

// [LOG: 20260429_0404] When Playwright is blocked, /service/news must still
// prove list/article pagination and direct-route restore at module level
// instead of leaving /service/news/:topic and ?article routes at shell-only PASS.
async function verifyNewsCoverage(errors) {
    console.log('📰 Checking news route coverage via module harness...');

    class FakeAnsiScreenNode {
        constructor(host) {
            this.host = host;
        }

        querySelector(selector) {
            if (selector === '.ansi-screen-body') {
                return this.host.bodyNode;
            }
            return null;
        }

        querySelectorAll() {
            return [];
        }

        appendChild() {}
    }

    class FakeAnsiBodyNode {
        constructor(host) {
            this.host = host;
            this._html = '';
        }

        set innerHTML(value) {
            this._html = String(value || '');
            this.host.rebuild();
        }

        get innerHTML() {
            return this._html;
        }

        querySelectorAll() {
            return [];
        }
    }

    class FakeAnsiScreenEl {
        constructor() {
            this._html = '';
            this._template = '';
            this.bodyNode = new FakeAnsiBodyNode(this);
            this.screenNode = new FakeAnsiScreenNode(this);
        }

        set innerHTML(value) {
            this._template = String(value || '');
            if (this._template.includes('<div class="ansi-screen-body"></div>')) {
                this.bodyNode._html = '';
                this.rebuild();
                return;
            }
            this._html = this._template;
        }

        get innerHTML() {
            return this._html;
        }

        rebuild() {
            if (this._template.includes('<div class="ansi-screen-body"></div>')) {
                this._html = this._template.replace(
                    '<div class="ansi-screen-body"></div>',
                    `<div class="ansi-screen-body">${this.bodyNode._html}</div>`
                );
                return;
            }
            this._html = this._template;
        }

        querySelector(selector) {
            if (selector === '.ansi-screen-body' && this._template.includes('ansi-screen-body')) {
                return this.bodyNode;
            }
            if (selector === '.ansi-screen' && this._template.includes('class="ansi-screen"')) {
                return this.screenNode;
            }
            return null;
        }
    }

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createNewsScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/newsScreens.js'), moduleCache);
        const { createNewsAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/newsAnsiBuilders.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const topicDoor = 'politics';
        const topicTitle = '정치';
        const articleNo = '16';
        const items = Array.from({ length: 20 }, (_item, index) => ({
            no: index + 1,
            title: `기사 ${index + 1}`,
            date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
            description: `요약 ${index + 1}`,
            body: Array.from({ length: 40 }, (_line, lineIndex) => `본문 ${index + 1}-${lineIndex + 1}`).join('\n'),
            link: `https://example.com/news/${index + 1}`
        }));
        const screenEl = new FakeAnsiScreenEl();
        const pushedUrls = [];
        const state = {
            screen: 'main',
            history: [],
            serviceData: {}
        };

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: `/service/news/${topicDoor}`,
                search: '?page=2'
            },
            matchMedia() {
                return { matches: false };
            }
        };
        globalThis.document = {
            querySelectorAll() {
                return [];
            }
        };

        const newsAnsiBuilders = createNewsAnsiBuilders({
            displayWidth: (value = '') => String(value || '').length,
            isWideChar: () => false
        });
        const { buildURLForState } = createRoutingUrlBuilder({
            getAuthLeafRoutePath: () => '/',
            getMenuNodeRoutePath: () => '/',
            showPostList: async () => {},
            showPostView: async () => {},
            state
        });
        const { showNewsList, showNewsArticle } = createNewsScreens({
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async () => {},
            buildBoardSelectAnsi: () => '',
            buildNewsArticleAnsi: newsAnsiBuilders.buildNewsArticleAnsi,
            buildNewsListAnsi: newsAnsiBuilders.buildNewsListAnsi,
            cmdInput: { focus() {} },
            getCommandFooterText: () => '',
            getMenuNodeByKey: () => ({ footer: null }),
            loadNewsArticle: async (_topicDoor, requestedArticleNo) => ({
                kind: 'news',
                topic: { title: topicTitle },
                article: items.find((item, index) => String(item?.no || index + 1) === String(requestedArticleNo)) || null
            }),
            loadNewsArticles: async () => ({
                kind: 'news',
                topic: { title: topicTitle },
                items: items.map((item) => ({ ...item }))
            }),
            loadNewsMenu: async () => ({
                kind: 'news',
                items: [{ door: topicDoor, title: topicTitle }]
            }),
            screenEl,
            setLoading: () => {},
            state,
            updateURL: () => {
                pushedUrls.push(buildURLForState());
            },
            measureServiceLineBounds: () => null,
            estimateServiceLineBounds: () => null,
            measureLineSegmentBounds: () => null,
            createHotspotLayer: () => ({ childElementCount: 0, appendChild() {} }),
            createHotspotButton: () => ({}),
            renderScreenSequential: async () => {}
        });

        pushedUrls.length = 0;
        await showNewsList(topicDoor, { pageNo: 1 });
        const listPageOneRender = String(screenEl.innerHTML || '');
        await showNewsList(topicDoor, { pageNo: 2 });
        const listPageTwoRender = String(screenEl.innerHTML || '');
        const listPageTwoUrl = `/service/news/${topicDoor}?page=2`;

        if (state.screen !== 'news-list') {
            errors.push('News list screen did not activate state.screen="news-list" in newsScreens.showNewsList()');
        }
        if (state.serviceData?.pageNo !== 2) {
            errors.push(`News list screen did not normalize page 2 correctly (got ${state.serviceData?.pageNo})`);
        }
        if (state.serviceData?.listPageNo !== 2) {
            errors.push(`News list screen did not keep listPageNo in sync for page 2 (got ${state.serviceData?.listPageNo})`);
        }
        if (listPageOneRender === listPageTwoRender) {
            errors.push('News list pagination did not change rendered content between page 1 and page 2');
        }
        if (!listPageTwoRender.includes('16.')) {
            errors.push('News list page 2 did not render the expected second-page article rows');
        }
        if (buildURLForState() !== listPageTwoUrl) {
            errors.push(`News list URL builder did not keep page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== listPageTwoUrl) {
            errors.push(`News list pagination did not request ${listPageTwoUrl} when navigating to page 2`);
        }

        let restoredListArgs = null;
        let restoredArticleArgs = null;
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
            showMemoList: async () => {},
            showMemoView: async () => {},
            showMyInfo: async () => {},
            showNewsArticle: async (...args) => {
                restoredArticleArgs = args;
                return await showNewsArticle(...args);
            },
            showNewsList: async (...args) => {
                restoredListArgs = args;
                return await showNewsList(...args);
            },
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

        state.screen = 'main';
        state.serviceData = {};
        screenEl.innerHTML = '';
        await restorer.restoreStateFromURL();

        if (restoredListArgs?.[0] !== topicDoor || restoredListArgs?.[1]?.fromHistory !== true || restoredListArgs?.[1]?.pageNo !== 2) {
            errors.push('News list direct route did not invoke showNewsList() with { fromHistory: true, pageNo: 2 } for /service/news/:topic?page=2');
        }
        if (state.screen !== 'news-list') {
            errors.push('News list direct route did not restore the news-list screen for /service/news/:topic?page=2');
        }
        if (state.serviceData?.pageNo !== 2) {
            errors.push(`News list direct route did not restore page 2 for /service/news/:topic?page=2 (got ${state.serviceData?.pageNo})`);
        }
        if (String(screenEl.innerHTML || '') !== listPageTwoRender) {
            errors.push('News list direct route did not restore the same rendered page for /service/news/:topic?page=2');
        }
        if (buildURLForState() !== listPageTwoUrl) {
            errors.push(`News list direct route left URL state out of sync for page 2 (got ${buildURLForState()})`);
        }

        pushedUrls.length = 0;
        await showNewsArticle(topicDoor, articleNo, { pageNo: 1 });
        const articlePageOneRender = String(screenEl.innerHTML || '');
        await showNewsArticle(topicDoor, articleNo, { pageNo: 2 });
        const articlePageTwoRender = String(screenEl.innerHTML || '');
        const articlePageTwoUrl = `/service/news/${topicDoor}?article=${articleNo}&page=2`;

        if (state.screen !== 'news-view') {
            errors.push('News article screen did not activate state.screen="news-view" in newsScreens.showNewsArticle()');
        }
        if (state.serviceData?.pageNo !== 2) {
            errors.push(`News article screen did not normalize page 2 correctly (got ${state.serviceData?.pageNo})`);
        }
        if (state.serviceData?.listPageNo !== 2) {
            errors.push(`News article screen did not infer listPageNo from article position on page 2 (got ${state.serviceData?.listPageNo})`);
        }
        if (String(state.serviceData?.articleNo || '') !== articleNo) {
            errors.push(`News article screen did not keep articleNo in state for direct route coverage (got ${state.serviceData?.articleNo})`);
        }
        if (articlePageOneRender === articlePageTwoRender) {
            errors.push('News article pagination did not change rendered content between page 1 and page 2');
        }
        if (!articlePageTwoRender.includes('본문 16-')) {
            errors.push('News article page 2 did not render expected article body content');
        }
        if (buildURLForState() !== articlePageTwoUrl) {
            errors.push(`News article URL builder did not keep article/page query for page 2 (got ${buildURLForState()})`);
        }
        if (pushedUrls[pushedUrls.length - 1] !== articlePageTwoUrl) {
            errors.push(`News article pagination did not request ${articlePageTwoUrl} when navigating to page 2`);
        }

        state.screen = 'main';
        state.serviceData = {};
        screenEl.innerHTML = '';
        globalThis.window.location.search = `?article=${articleNo}&page=2`;
        await restorer.restoreStateFromURL();

        if (restoredArticleArgs?.[0] !== topicDoor || String(restoredArticleArgs?.[1] || '') !== articleNo || restoredArticleArgs?.[2]?.fromHistory !== true || restoredArticleArgs?.[2]?.pageNo !== 2) {
            errors.push('News article direct route did not invoke showNewsArticle() with { fromHistory: true, pageNo: 2 } for /service/news/:topic?article=:article&page=2');
        }
        if (state.screen !== 'news-view') {
            errors.push('News article direct route did not restore the news-view screen for /service/news/:topic?article=:article&page=2');
        }
        if (state.serviceData?.pageNo !== 2) {
            errors.push(`News article direct route did not restore page 2 for /service/news/:topic?article=:article&page=2 (got ${state.serviceData?.pageNo})`);
        }
        if (state.serviceData?.listPageNo !== 2) {
            errors.push(`News article direct route did not preserve inferred listPageNo 2 (got ${state.serviceData?.listPageNo})`);
        }
        if (String(screenEl.innerHTML || '') !== articlePageTwoRender) {
            errors.push('News article direct route did not restore the same rendered page for /service/news/:topic?article=:article&page=2');
        }
        if (buildURLForState() !== articlePageTwoUrl) {
            errors.push(`News article direct route left URL state out of sync for page 2 (got ${buildURLForState()})`);
        }
    } catch (error) {
        errors.push(`News module harness failed: ${error.message}`);
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

// [LOG: 20260429_0414] When Playwright is blocked, SYSLOG should still prove
// the global command entry plus in-screen C/R/CP command-state via a module harness.
async function verifySystemLogCoverage(errors) {
    console.log('📜 Checking SYSLOG coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalNavigator = globalThis.navigator;

    try {
        const moduleCache = new Map();
        const { createGlobalRuntimeCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/commandRouterGlobalRuntime.js'), moduleCache);
        const { createSystemLogScreens } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemLogScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);

        const state = {
            screen: 'main'
        };
        const screenEl = {
            innerHTML: '',
            querySelector() {
                return null;
            },
            querySelectorAll() {
                return [];
            }
        };
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

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/',
                search: ''
            }
        };
        globalThis.navigator = {};

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
        if (typeof originalNavigator === 'undefined') {
            delete globalThis.navigator;
        } else {
            globalThis.navigator = originalNavigator;
        }
    }
}

async function verifyHttpModuleCoverage(errors) {
    console.log('🧩 Checking browser module coverage via HTTP fallback...');

    for (const moduleCheck of FALLBACK_MODULE_CHECKS) {
        try {
            const response = await fetch(`${BASE_URL}${moduleCheck.path}`);
            const content = await response.text();

            if (!response.ok) {
                errors.push(`HTTP ${response.status} at ${moduleCheck.path}`);
                continue;
            }

            if (!hasNonEmptyText(content)) {
                errors.push(`${moduleCheck.label} is empty at ${moduleCheck.path}`);
                continue;
            }

            if (!content.includes(moduleCheck.expectedText)) {
                errors.push(`${moduleCheck.label} is missing expected marker "${moduleCheck.expectedText}" at ${moduleCheck.path}`);
            }
        } catch (error) {
            errors.push(`Failed to load ${moduleCheck.path}: ${error.message}`);
        }
    }
}

async function ensureTerminalReady(page, label, errors) {
    try {
        await page.waitForSelector('#terminal-wrapper', { timeout: TIMEOUT });
        await page.waitForFunction((selectors) => {
            const isVisibleInteractiveInput = (element) => {
                if (!element) {
                    return false;
                }
                if (typeof element.disabled === 'boolean' && element.disabled) {
                    return false;
                }
                const style = window.getComputedStyle(element);
                if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                    return false;
                }
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            };

            return selectors.some((selector) => isVisibleInteractiveInput(document.querySelector(selector)));
        }, ['#cmd-input', '#signup-confirm-input', '#signup-agree-input', '#signup-oauth-confirm-input'], { timeout: TIMEOUT });
        await page.waitForFunction(() => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.trim().length > 0;
        }, null, { timeout: TIMEOUT });
        return true;
    } catch (error) {
        errors.push(`Terminal screen did not render at ${label}: ${error.message}`);
        return false;
    }
}

async function openHomeAndWait(page, errors, label) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    return ensureTerminalReady(page, label, errors);
}

async function submitCommand(page, cmd) {
    await page.fill('#cmd-input', cmd);
    await page.keyboard.press('Enter');
}

async function verifyPlaywrightCommands(page, errors) {
    console.log('⌨️  Testing Global Commands...');

    console.log('   > Executing command: H');
    if (await openHomeAndWait(page, errors, 'home before H')) {
        await submitCommand(page, 'H');
        try {
            await page.waitForURL((url) => url.pathname === '/help', { timeout: TIMEOUT });
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
            }, previousTheme, { timeout: TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: TIMEOUT });
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
            }, null, { timeout: TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: TIMEOUT });
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
            }, null, { timeout: TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: TIMEOUT });
        } catch (error) {
            errors.push(`SYSLOG command did not render the system log screen: ${error.message}`);
        }
    }

    console.log('   > Executing command: SYSINFO');
    if (await openHomeAndWait(page, errors, 'home before SYSINFO')) {
        await page.evaluate(() => {
            try {
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
            }, null, { timeout: TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: TIMEOUT });
        } catch (error) {
            errors.push(`SYSINFO command did not render the diagnostics screen: ${error.message}`);
        }
    }

    console.log('   > Executing command: W');
    if (await openHomeAndWait(page, errors, 'home before W')) {
        await submitCommand(page, 'W');
        try {
            await page.waitForFunction(() => {
                const screenText = document.getElementById('terminal-screen')?.textContent || '';
                return screenText.includes('접속자 목록') || screenText.includes('WHO IS ONLINE');
            }, null, { timeout: TIMEOUT });
            await page.waitForSelector('#cmd-input', { timeout: TIMEOUT });
        } catch (error) {
            errors.push(`W command did not render the active-users screen: ${error.message}`);
        }
    }
}

// [LOG: 20260428_2339] When Playwright is available, /chat must prove room entry,
// message send, and reload hydration instead of stopping at lobby shell coverage.
async function verifyPlaywrightChatFlow(page, errors) {
    console.log('💬 Testing Chat Room Flow...');
    const smokeMessage = `smoke-chat-${Date.now()}`;

    try {
        await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (!(await ensureTerminalReady(page, '/chat lobby', errors))) {
            return;
        }

        // [LOG_ID: 20260715_1500] 20260713_1000 대기실 상황판(ST) 재설계로 방 목록 표기가
        // "[1] 제목" 형식에서 나우누리 원전 형식 "#1 공개(인원/정원) [개설자] 방제목"으로
        // 바뀌었는데, 이 테스트는 갱신되지 않아 "[1]" 리터럴을 계속 찾다가 항상 실패
        // 판정을 내리고 있었다(실제 UI는 정상 — full-traversal을 이번에 처음 돌려보다 발견).
        const lobbyText = await page.evaluate(() => document.getElementById('terminal-screen')?.textContent || '');
        if (!hasNonEmptyText(lobbyText) || !lobbyText.includes('공개')) {
            errors.push('Chat lobby did not expose a selectable first room.');
            return;
        }

        await submitCommand(page, '1');
        await page.waitForURL((url) => /^\/chat\/[^/]+$/.test(url.pathname), { timeout: TIMEOUT });
        await page.waitForFunction(() => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes('참여자:') && screenText.includes('/Q');
        }, null, { timeout: TIMEOUT });

        await submitCommand(page, smokeMessage);
        await page.waitForFunction((expectedMessage) => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes(expectedMessage);
        }, smokeMessage, { timeout: TIMEOUT });

        const roomUrl = page.url();
        await page.goto(roomUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (!(await ensureTerminalReady(page, roomUrl, errors))) {
            return;
        }

        await page.waitForFunction((expectedMessage) => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes(expectedMessage);
        }, smokeMessage, { timeout: TIMEOUT });
    } catch (error) {
        errors.push(`Chat room flow failed: ${error.message}`);
    }
}

// [LOG: 20260428_2311] Restricted shells can block Playwright browser launches.
async function runHttpTraversal(errors) {
    console.log('⚠️  Playwright browser launch is unavailable here. Falling back to HTTP traversal.');

    for (const route of TEST_ROUTES) {
        console.log(`📡 Checking route via HTTP: ${route}`);
        const response = await fetch(`${BASE_URL}${route}`);
        const content = await response.text();

        if (!response.ok) {
            errors.push(`HTTP ${response.status} at ${route}`);
        }

        if (!content || content.trim().length === 0) {
            errors.push(`Empty page content at ${route}`);
            continue;
        }

        if (!content.includes(APP_SHELL_MARKER)) {
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

    await verifyHttpChatCoverage(errors);
    await verifyChatHistorySnapshotCoverage(errors);
    await verifyHttpBoardCoverage(errors);
    await verifyHttpMemoCoverage(errors);
    await verifyAuthEntryRouteCoverage(errors);
    await verifyProfileRouteCoverage(errors);
    await verifyHttpMyInfoCoverage(errors);
    await verifyMyInfoRouteCoverage(errors);
    await verifyHttpWeatherCoverage(errors);
    await verifyHttpNewsCoverage(errors);
    await verifyHttpSystemInfoCoverage(errors);
    await verifyHttpActivitySummaryCoverage(errors);
    await verifyHttpActiveUsersCoverage(errors);
    await verifySystemDiagnosticsCommandCoverage(errors);
    await verifyActivitySummaryCommandCoverage(errors);
    await verifyPerformanceCommandCoverage(errors);
    await verifyActiveUsersCommandCoverage(errors);
    await verifyMemoWriteCoverage(errors);
    await verifyHelpCoverage(errors);
    await verifyHistoryCoverage(errors);
    await verifyWeatherCoverage(errors);
    await verifyNewsCoverage(errors);
    await verifySystemLogCoverage(errors);
    await verifyHttpModuleCoverage(errors);
}

async function runPlaywrightTraversal(browser, errors) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(TIMEOUT);
    page.setDefaultTimeout(TIMEOUT);

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
    console.log(`🔗 Visiting: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await ensureTerminalReady(page, '/', errors);

    // 2. Traversal Logic (Simplified Crawler)
    for (const route of TEST_ROUTES) {
        console.log(`📡 Checking route: ${route}`);
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await ensureTerminalReady(page, route, errors);
    }

    // 3. Command Interaction Test
    await verifyPlaywrightCommands(page, errors);
    await verifyPlaywrightChatFlow(page, errors);

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

        await verifyHttpUnifiedPdsCoverage(errors);
        await verifyUnifiedPdsCoverage(errors);
        await verifyBoardNavigationSemantics(errors);
        await verifyAuthRecoveryCoverage(errors);
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
