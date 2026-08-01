/**
 * [LOG_ID: 20260801_1243] Misc E2E smoke tests (News, Help, History, Modules).
 */
'use strict';

const path = require('path');
const {
    config,
    fetchJsonData,
    hasNonEmptyText,
    loadBrowserHarnessModule,
    createHarnessScreenEl,
    createHarnessBrowserGlobals,
    ansiToHTMLHarnessStub
} = require('./common-utils');

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

async function verifyHelpCoverage(errors) {
    console.log('🧾 Checking help route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createHelpScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/helpScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            page: 1,
            helpTotalPages: 1
        };
        const screenEl = createHarnessScreenEl();
        const pushedUrls = [];

        const env = createHarnessBrowserGlobals({ innerWidth: 1280, pathname: '/help' });
        globalThis.window = env.window;
        globalThis.document = env.document;

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

async function verifyHistoryCoverage(errors) {
    console.log('🕘 Checking history route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;

    try {
        const moduleCache = new Map();
        const { createHelpScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/helpScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);

        const state = {
            screen: 'main',
            cmdHistory: [
                { cmd: 'LATEST', screen: 'main', ts: 3 },
                { cmd: 'MIDDLE', screen: 'help', ts: 2 },
                { cmd: 'OLDEST', screen: 'history', ts: 1 }
            ]
        };
        const screenEl = createHarnessScreenEl();

        const env = createHarnessBrowserGlobals({ innerWidth: 1280, pathname: '/history' });
        globalThis.window = env.window;
        globalThis.document = env.document;

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
        const { createNewsScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/newsScreens.js'), moduleCache);
        const { createNewsAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/newsAnsiBuilders.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

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

        const env = createHarnessBrowserGlobals({ innerWidth: 1280, pathname: `/service/news/${topicDoor}`, search: '?page=2' });
        globalThis.window = env.window;
        globalThis.document = env.document;

        const sessionStore = new Map();
        globalThis.sessionStorage = {
            getItem: (key) => (sessionStore.has(key) ? sessionStore.get(key) : null),
            setItem: (key, value) => sessionStore.set(key, String(value)),
            removeItem: (key) => sessionStore.delete(key)
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
            setReady: () => {},
            renderScreenSequential: async (html, options) => {
                if (options?.container) {
                    options.container.innerHTML = html;
                }
            }
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
        if (!listPageTwoRender.includes('기사 16')) {
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
        delete globalThis.sessionStorage;
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

async function verifyHttpModuleCoverage(errors) {
    console.log('🧩 Checking browser module coverage via HTTP fallback...');

    for (const moduleCheck of config.FALLBACK_MODULE_CHECKS) {
        try {
            const response = await fetch(`${config.BASE_URL}${moduleCheck.path}`);
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

module.exports = {
    verifyHttpNewsCoverage,
    verifyHelpCoverage,
    verifyHistoryCoverage,
    verifyNewsCoverage,
    verifyHttpModuleCoverage
};
