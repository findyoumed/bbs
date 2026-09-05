/**
 * [LOG_ID: 20260801_1243] Board E2E smoke tests.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const {
    config,
    fetchJsonResponse,
    fetchJsonData,
    extractBoardId,
    extractBoardItems,
    extractApiMessage,
    hasNonEmptyText,
    createHarnessBrowserGlobals,
    createHarnessScreenEl,
    loadBrowserHarnessModule,
    ansiToHTMLHarnessStub
} = require('./common-utils');

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
        const moduleCache = new Map();
        const { getNavigation: getSupabaseBoardNavigation } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'src/server/SupabaseBoardRepositoryPostReads.js'), moduleCache);
        const navigation = await getSupabaseBoardNavigation(repo, 'plaza', 4);

        if (navigation.latestId !== 5 || navigation.prevId !== 5 || navigation.nextId !== 3) {
            errors.push(`Board non-threaded navigation is reversed (expected latest/prev/next 5/5/3, got ${navigation.latestId}/${navigation.prevId}/${navigation.nextId})`);
        }
    } catch (error) {
        errors.push(`Board navigation semantics check failed: ${error.message}`);
    }
}

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
            this.disabled = false;
            this.selectionStart = 0;
            this.selectionEnd = 0;
            this.style = {};
            this.listeners = new Map();
        }

        focus() {}

        select() {}

        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }

        addEventListener(type, handler) {
            this.listeners.set(type, handler);
        }

        removeEventListener(type) {
            this.listeners.delete(type);
        }

        dispatchKeydown(eventInit = {}) {
            const handler = this.listeners.get('keydown');
            if (!handler) return;
            handler({ preventDefault() {}, ...eventInit });
        }
    }

    function createFakeDom() {
        const elements = new Map();
        elements.set('terminal-prompt-row', new FakeElement('terminal-prompt-row'));
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
                elements.delete('bbs-ed-title');
                elements.delete('bbs-ed-body');
                elements.delete('bbs-ed-body-row');

                if (this._html.includes('id="bbs-ed-title"')) {
                    elements.set('bbs-ed-title', new FakeElement('bbs-ed-title'));
                }
                if (this._html.includes('id="bbs-ed-body"')) {
                    elements.set('bbs-ed-body', new FakeElement('bbs-ed-body'));
                }
                if (this._html.includes('id="bbs-ed-body-row"')) {
                    const row = new FakeElement('bbs-ed-body-row');
                    row.style.display = /id="bbs-ed-body-row"[^>]*display:none/.test(this._html)
                        ? 'none'
                        : 'flex';
                    elements.set('bbs-ed-body-row', row);
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

    async function flushAsync() {
        for (let i = 0; i < 5; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    async function saveBbsEditor(harness, { title, body } = {}) {
        const titleEl = harness.document.getElementById('bbs-ed-title');
        const bodyEl = harness.document.getElementById('bbs-ed-body');
        if (!titleEl || !bodyEl) {
            throw new Error('bbs-ed-title/bbs-ed-body not present when trying to save');
        }
        if (title !== undefined) titleEl.value = title;
        if (body !== undefined) bodyEl.value = body;
        bodyEl.dispatchKeydown({ ctrlKey: true, key: 's' });
        await flushAsync();
    }

    async function cancelBbsEditor(harness) {
        const titleEl = harness.document.getElementById('bbs-ed-title');
        if (!titleEl) {
            throw new Error('bbs-ed-title not present when trying to cancel');
        }
        titleEl.dispatchKeydown({ key: 'Escape' });
        await flushAsync();
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

    function loadLocalHarnessModule(modulePath, cache) {
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
        source = source.replace(/export\s+\{[^}]+\};?/g, '');

        const uniqueExportNames = [...new Set(exportNames)];
        const wrapper = new Function('__loadModule', `${source}\nreturn { ${uniqueExportNames.join(', ')} };`);
        const moduleExports = wrapper((nextModulePath) => loadLocalHarnessModule(nextModulePath, cache));
        cache.set(resolvedPath, moduleExports);
        return moduleExports;
    }

    try {
        const moduleCache = new Map();
        const { createPostWriteView } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/postWriteView.js'), moduleCache);
        const { createRoutingStateRestorer } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);
        const { createEntryCommandHandler } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterEntry.js'), moduleCache);
        const { createBrowseCommandHandler } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterBrowse.js'), moduleCache);
        const { createPostViewCommandHandler } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterPostView.js'), moduleCache);
        const { createCommandDispatcherExecution } = loadLocalHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandDispatcherExecution.js'), moduleCache);

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
                    authorUserId: overrides.postAuthorUserId ?? overrides.postUserId ?? ownerUserId
                }];

            const deps = {
                cmdInput: new FakeElement('cmdInput'),
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
                findBoardByKey: (key) => (String(key || '').toLowerCase() === String(boardId).toLowerCase()
                    ? { boardId, id: boardId }
                    : null),
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
                    handleVoteCommand: async () => false,
                    handleConfCommand: async () => false,
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
        if (guestListWriteHarness.document.getElementById('bbs-ed-title')) {
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
        } else if (!memberListWriteHarness.document.getElementById('bbs-ed-title') || !memberListWriteHarness.document.getElementById('bbs-ed-body')) {
            errors.push(`Board member list write command did not expose title/body inputs at /board/${boardId}`);
        }

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
        if (guestListEditHarness.document.getElementById('bbs-ed-title')) {
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
            const ownerListEditTitleInput = ownerListEditHarness.document.getElementById('bbs-ed-title');
            const ownerListEditBodyInput = ownerListEditHarness.document.getElementById('bbs-ed-body');
            if (!ownerListEditTitleInput || !ownerListEditBodyInput) {
                errors.push(`Board owner list edit command did not expose title/body inputs at /board/${boardId}`);
            } else {
                if (ownerListEditTitleInput.value !== postTitle || ownerListEditBodyInput.value !== postContent) {
                    errors.push(`Board owner list edit command did not prefill title/body at /board/${boardId}`);
                }
                const ownerListEditTitle = `${postTitle} via list edit`;
                const ownerListEditBody = `${postContent} via list edit`;
                await saveBbsEditor(ownerListEditHarness, { title: ownerListEditTitle, body: ownerListEditBody });
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
                if (ownerListEditHarness.state.screen !== 'post-view') {
                    errors.push(`Board owner list edit submit did not return to post-view at /board/${boardId}`);
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
        if (nonAuthorListEditHarness.document.getElementById('bbs-ed-title')) {
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
        if (guestHarness.document.getElementById('bbs-ed-title')) {
            errors.push(`Board guest write restore unexpectedly rendered post-write inputs at /board/${boardId}/write`);
        }

        const createCancelHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }));
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/write`;
        globalThis.window.location.search = '';
        await createCancelHarness.restorer.restoreStateFromURL();
        if (createCancelHarness.state.screen !== 'post-write') {
            errors.push(`Board write restore did not enter post-write state at /board/${boardId}/write`);
        } else {
            await cancelBbsEditor(createCancelHarness);
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
            const titleInput = createSubmitHarness.document.getElementById('bbs-ed-title');
            const bodyInput = createSubmitHarness.document.getElementById('bbs-ed-body');
            if (!titleInput || !bodyInput) {
                errors.push(`Board write restore submit path did not expose title/body inputs at /board/${boardId}/write`);
            } else {
                const bodyRow = createSubmitHarness.document.getElementById('bbs-ed-body-row');
                if (bodyRow?.style.display !== 'none') {
                    errors.push(`Board write did not start in the Coroke title-only stage at /board/${boardId}/write`);
                }
                titleInput.dispatchKeydown({ key: 'Enter' });
                if (bodyRow?.style.display !== 'flex') {
                    errors.push(`Board write title Enter did not reveal the Coroke body stage at /board/${boardId}/write`);
                }
                const submitTitle = `board harness create ${postId}`;
                const submitBody = `board harness create body ${postId}`;
                await saveBbsEditor(createSubmitHarness, { title: submitTitle, body: submitBody });
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
            const editTitleInput = editHarness.document.getElementById('bbs-ed-title');
            const editBodyInput = editHarness.document.getElementById('bbs-ed-body');
            if (!editTitleInput || !editBodyInput) {
                errors.push(`Board edit restore did not expose title/body inputs at /board/${boardId}/${postId}/edit`);
            } else {
                if (editTitleInput.value !== postTitle || editBodyInput.value !== postContent) {
                    errors.push(`Board edit restore did not prefill title/body at /board/${boardId}/${postId}/edit`);
                }
                const updatedHarnessTitle = `${postTitle} via harness`;
                const updatedHarnessBody = `${postContent} via harness`;
                await saveBbsEditor(editHarness, { title: updatedHarnessTitle, body: updatedHarnessBody });
                if (editHarness.metrics.updateCalls.length !== 1) {
                    errors.push(`Board edit restore submit did not trigger an update exactly once at /board/${boardId}/${postId}/edit`);
                } else if (editHarness.metrics.updateCalls[0].boardId !== String(boardId)
                    || editHarness.metrics.updateCalls[0].postId !== Number(postId)
                    || editHarness.metrics.updateCalls[0].payload.title !== updatedHarnessTitle
                    || editHarness.metrics.updateCalls[0].payload.content !== updatedHarnessBody) {
                    errors.push(`Board edit restore submit payload is invalid at /board/${boardId}/${postId}/edit`);
                }
                if (editHarness.state.screen !== 'post-view') {
                    errors.push(`Board edit restore submit did not return to post-view at /board/${boardId}/${postId}/edit`);
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
        if (nonAuthorHarness.document.getElementById('bbs-ed-title')) {
            errors.push(`Board non-author edit restore unexpectedly rendered post-write inputs at /board/${boardId}/${postId}/edit`);
        }

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
            if (guestEditHarness.document.getElementById('bbs-ed-title')) {
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
            if (guestReplyHarness.document.getElementById('bbs-ed-title')) {
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
        const expectedReplyRoute = `/${boardId}/${postId}/reply`;
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
                const memberReplyRoute = memberReplyHarness.buildURLForState();
                if (memberReplyRoute !== expectedReplyRoute) {
                    errors.push(`Board member reply command built ${memberReplyRoute || 'empty'} instead of ${expectedReplyRoute}`);
                }

                const replyTitleInput = memberReplyHarness.document.getElementById('bbs-ed-title');
                const replyBodyInput = memberReplyHarness.document.getElementById('bbs-ed-body');
                if (!replyTitleInput || !replyBodyInput) {
                    errors.push(`Board member reply command did not expose title/body inputs at /board/${boardId}/${postId}`);
                } else {
                    if (replyTitleInput.value !== `Re: ${postTitle}`) {
                        errors.push(`Board member reply command did not prefill the reply title at /board/${boardId}/${postId}`);
                    }
                    const replyTitle = `Re: ${postTitle} via harness`;
                    const replyBody = `board harness reply body ${postId}`;
                    await saveBbsEditor(memberReplyHarness, { title: replyTitle, body: replyBody });
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
                    const restoredReplyTitleInput = memberReplyRestoreHarness.document.getElementById('bbs-ed-title');
                    const restoredReplyBodyInput = memberReplyRestoreHarness.document.getElementById('bbs-ed-body');
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

        const selfRecommendHarness = createHarness(buildUser(ownerUserId, { nickName: 'board-owner', isGuest: false }), {
            postTitle,
            postContent,
            postUserId: ownerUserId,
            postAuthorUserId: '00000000-0000-0000-0000-000000000001'
        });
        globalThis.window.location.pathname = `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(postId)}`;
        globalThis.window.location.search = '';
        await selfRecommendHarness.restorer.restoreStateFromURL();
        if (selfRecommendHarness.state.screen !== 'post-view') {
            errors.push(`Board self recommend harness did not enter post-view at /board/${boardId}/${postId}`);
        } else {
            const selfShowPostViewCallsBeforeRecommend = selfRecommendHarness.metrics.showPostViewCalls.length;
            const selfRecommendHandled = await selfRecommendHarness.postViewCommandHandler({
                cmd: 'OK',
                context: {}
            });
            if (selfRecommendHandled !== true) {
                errors.push(`Board self recommend command was not handled at /board/${boardId}/${postId}`);
            }
            if (selfRecommendHarness.getHint() !== '자신의 글은 추천할 수 없습니다.') {
                errors.push(`Board self recommend command is missing the self-recommend hint at /board/${boardId}/${postId}`);
            }
            if (selfRecommendHarness.metrics.recommendCalls.length !== 0) {
                errors.push(`Board self recommend command attempted an API call when authorUserId differs at /board/${boardId}/${postId}`);
            }
            if (selfRecommendHarness.metrics.showPostViewCalls.length !== selfShowPostViewCallsBeforeRecommend) {
                errors.push(`Board self recommend command unexpectedly reloaded the post at /board/${boardId}/${postId}`);
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
        const response = await fetch(`${config.BASE_URL}${pathname}`);
        const content = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} at ${pathname}`);
        }

        if (!hasNonEmptyText(content)) {
            throw new Error(`Empty page content at ${pathname}`);
        }

        if (!content.includes(config.APP_SHELL_MARKER)) {
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
        createdPostId = Number(createResponse.data.post.localId ?? createResponse.data.post.id);
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
            const attachmentRouteResponse = await fetch(`${config.BASE_URL}/board/${encodeURIComponent(boardId)}/${encodeURIComponent(createdPostId)}/files`);
            const attachmentRouteContent = await attachmentRouteResponse.text();
            if (!attachmentRouteResponse.ok) {
                errors.push(`HTTP ${attachmentRouteResponse.status} at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!hasNonEmptyText(attachmentRouteContent)) {
                errors.push(`Empty page content at /board/${boardId}/${createdPostId}/files`);
                return;
            }
            if (!attachmentRouteContent.includes(config.APP_SHELL_MARKER)) {
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

            const attachmentDownloadResponse = await fetch(`${config.BASE_URL}/api/boards/${encodeURIComponent(boardId)}/posts/${encodeURIComponent(createdPostId)}/attachments/${encodeURIComponent(attachmentId)}/download`, {
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

module.exports = {
    verifyBoardNavigationSemantics,
    verifyBoardPostWriteHarness,
    verifyHttpBoardCoverage
};
