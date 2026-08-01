/**
 * [LOG_ID: 20260801_1243] PDS E2E smoke tests.
 */
'use strict';

const path = require('path');
const {
    config,
    fetchJsonResponse,
    hasNonEmptyText,
    extractBoardId,
    resolveUnifiedPdsDirectRouteTarget,
    loadBrowserHarnessModule,
    ansiToHTMLHarnessStub
} = require('./common-utils');

async function verifyHttpUnifiedPdsCoverage(errors) {
    console.log('🗂️ Checking unified PDS route coverage via HTTP fallback...');

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
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

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

module.exports = {
    verifyHttpUnifiedPdsCoverage,
    verifyUnifiedPdsCoverage
};
