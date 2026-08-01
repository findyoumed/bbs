/**
 * [LOG_ID: 20260801_1243] Weather E2E smoke tests.
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
        const { createWeatherScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/weatherScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        const state = {
            screen: 'main',
            history: [],
            page: 1,
            serviceData: {
                items: [{ door: '11', title: '서울' }],
                menuItems: []
            }
        };
        const screenEl = createHarnessScreenEl();
        const pushedUrls = [];

        const env = createHarnessBrowserGlobals({ innerWidth: 1280, pathname: '/service/weather/11', search: '?page=2' });
        globalThis.window = env.window;
        globalThis.document = env.document;

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
            setLoading: () => {},
            renderScreenSequential: async (html, options) => {
                if (options?.container) {
                    options.container.innerHTML = html;
                }
            }
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

module.exports = {
    verifyHttpWeatherCoverage,
    verifyWeatherCoverage
};
