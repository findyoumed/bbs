/**
 * [LOG_ID: 20260801_1243] Profile and MyInfo E2E smoke tests.
 */
'use strict';

const path = require('path');
const {
    config,
    fetchJsonResponse,
    extractApiMessage,
    hasNonEmptyText,
    loadBrowserHarnessModule,
    createHarnessScreenEl,
    ansiToHTMLHarnessStub
} = require('./common-utils');

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

        await expectAppShell('/profile');

        const moduleCache = new Map();
        const { createProfileScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/profileScreens.js'), moduleCache);
        const { createSystemAnsiBuilders } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/systemAnsiBuilders.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

        function createProfileAnsiBuilderForHarness() {
            const { buildProfileAnsi } = createSystemAnsiBuilders({
                displayWidth: (value = '') => String(value || '').length,
                isWideChar: () => false
            });
            return buildProfileAnsi;
        }

        const state = {
            screen: 'main',
            _profileUserId: '',
            user: { userId: 'demo-user', nickName: 'demo-user', isGuest: false }
        };
        const screenEl = createHarnessScreenEl();
        const updateRequests = [];
        const apiRequests = [];
        const appliedFooters = [];
        let loadMenuTreeCalls = 0;

        globalThis.window = {
            location: {
                pathname: '/profile',
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
            },
            scrollTo() {}
        };
        globalThis.document = {
            getElementById() {
                return null;
            },
            querySelector() {
                return null;
            },
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
            ansiToHTML: ansiToHTMLHarnessStub,
            applyCommandFooter: async (assetPath, fallbackText) => {
                appliedFooters.push(String(fallbackText || ''));
            },
            setLoading: () => {},
            buildProfileAnsi: createProfileAnsiBuilderForHarness(),
            getCommandFooterText: () => 'PROFILE FOOTER',
            getSupportedFooterText: () => 'PROFILE FOOTER',
            screenEl,
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

        if (loadMenuTreeCalls < 1) {
            errors.push(`Profile direct route did not run the up-front menu-tree hydration for /profile (got ${loadMenuTreeCalls} calls)`);
        }
        if (state.screen !== 'profile') {
            errors.push('Profile direct route did not restore state.screen="profile" for /profile');
        }
        if (state._profileUserId !== 'demo-user') {
            errors.push(`Profile direct route did not restore the logged-in user's own profile for /profile (got ${state._profileUserId || 'empty'})`);
        }
        if (apiRequests.length !== 1 || apiRequests[0] !== '/api/members/demo-user?allowMissing=1') {
            errors.push(`Profile direct route did not fetch the expected member payload for /profile (got ${apiRequests.join(', ') || 'no calls'})`);
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'PROFILE FOOTER') {
            errors.push(`Profile direct route did not restore the profile footer hint (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateRequests.length !== 0) {
            errors.push('Profile direct route should not push or replace history while restoring /profile');
        }
        if (buildURLForState() !== '/profile') {
            errors.push(`Profile URL builder did not stay in sync for /profile (got ${buildURLForState()})`);
        }
        if (`${globalThis.window.location.pathname}${globalThis.window.location.search}` !== '/profile') {
            errors.push(`Profile direct route changed the browser URL unexpectedly for /profile (got ${globalThis.window.location.pathname}${globalThis.window.location.search})`);
        }

        const renderedProfile = String(screenEl.innerHTML || '').trim();
        if (!renderedProfile.includes('사용자 정보 (PROFILE)')) {
            errors.push('Profile direct route did not render the profile title for /profile');
        }
        if (!/아이디\s*:\s*demo-user/.test(renderedProfile)) {
            errors.push('Profile direct route did not render the member id for /profile');
        }
        if (!renderedProfile.endsWith('</div>')) {
            errors.push('Profile screen markup did not close the wrapper container for /profile');
        }

        globalThis.window.location.pathname = '/profile';
        globalThis.window.location.search = '';
        state.user = { userId: 'smoke-route-user', nickName: 'smoke-route-user', isGuest: false };
        screenEl.innerHTML = '';
        appliedFooters.length = 0;

        await restorer.restoreStateFromURL();

        if (loadMenuTreeCalls < 1) {
            errors.push(`Missing profile direct route did not run the up-front menu-tree hydration for /profile (got ${loadMenuTreeCalls} calls)`);
        }
        if (state.screen !== 'profile') {
            errors.push('Missing profile direct route did not keep state.screen="profile" for /profile');
        }
        if (state._profileUserId !== 'smoke-route-user') {
            errors.push(`Missing profile direct route did not preserve the looked-up user id (got ${state._profileUserId || 'empty'})`);
        }
        if (apiRequests.length !== 2 || apiRequests[1] !== '/api/members/smoke-route-user?allowMissing=1') {
            errors.push(`Missing profile direct route did not fetch the allowMissing lookup for /profile (got ${apiRequests.join(', ') || 'no calls'})`);
        }
        if (appliedFooters[appliedFooters.length - 1] !== 'PROFILE FOOTER') {
            errors.push(`Missing profile direct route did not restore the profile footer hint (got ${appliedFooters[appliedFooters.length - 1] || 'empty'})`);
        }
        if (updateRequests.length !== 0) {
            errors.push('Missing profile direct route should not push or replace history while restoring /profile');
        }
        if (buildURLForState() !== '/profile') {
            errors.push(`Profile URL builder did not stay in sync for missing /profile (got ${buildURLForState()})`);
        }
        if (`${globalThis.window.location.pathname}${globalThis.window.location.search}` !== '/profile') {
            errors.push(`Missing profile direct route changed the browser URL unexpectedly for /profile (got ${globalThis.window.location.pathname}${globalThis.window.location.search})`);
        }

        const missingProfileMarkup = String(screenEl.innerHTML || '').trim();
        if (!missingProfileMarkup.includes('회원 정보를 찾을 수 없습니다.')) {
            errors.push('Missing profile direct route did not render the missing-member message for /profile');
        }
        if (!missingProfileMarkup.includes('대상 ID : smoke-route-user')) {
            errors.push('Missing profile direct route did not render the looked-up member id for /profile');
        }
        if (!missingProfileMarkup.endsWith('</div>')) {
            errors.push('Missing profile screen markup did not close the wrapper container for /profile');
        }

        globalThis.window.location.pathname = '/profile';
        globalThis.window.location.search = '';
        state.user = { userId: '', isGuest: true };
        state.screen = 'main';
        screenEl.innerHTML = '';
        const apiCallsBeforeGuest = apiRequests.length;

        await restorer.restoreStateFromURL();

        if (state.screen !== 'main') {
            errors.push(`Guest /profile direct route did not fall back to the main screen (got screen=${state.screen})`);
        }
        if (apiRequests.length !== apiCallsBeforeGuest) {
            errors.push(`Guest /profile direct route should not look up any member (got ${apiRequests.slice(apiCallsBeforeGuest).join(', ')})`);
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

async function verifyMyInfoRouteCoverage(errors) {
    console.log('🙍 Checking myinfo route coverage via module harness...');

    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const guestBlockedMessage = '회원 정보는 로그인 사용자만 이용할 수 있습니다.';
    const guestBlockedHint = 'ENTER를 누르면 초기화면으로 이동합니다.';

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
        const { createMyInfoScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/myInfoScreens.js'), moduleCache);
        const { createMyInfoCommandHandler } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/commandRouterMyInfo.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);

        const state = {
            screen: 'main',
            user: {
                userId: 'guest',
                nickName: '손님',
                isGuest: true
            }
        };
        const hints = [];
        const prompts = [];
        const showMainCalls = [];
        const updateUrlCalls = [];

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

        const screenEl = createHarnessScreenEl();
        screenEl.classList = { add() {}, remove() {} };

        globalThis.window = {
            innerWidth: 1280,
            location: {
                pathname: '/myinfo',
                search: ''
            },
            matchMedia: () => ({ matches: false })
        };
        globalThis.document = {
            getElementById: () => null
        };

        const myInfoScreens = createMyInfoScreens({
            apiFetch: async () => {
                throw new Error('guest myinfo guard should not call apiFetch');
            },
            doLogin: async () => {},
            doLogout: async () => {},
            guestUser: () => ({
                userId: 'guest',
                nickName: '손님',
                isGuest: true
            }),
            setHint,
            setPrompt,
            showMain,
            state,
            screenEl,
            cmdInput: { value: '', focus() {} },
            esc: escapeHtml,
            applyCommandFooter: async () => {},
            getSupportedFooterText: () => 'MYINFO FOOTER',
            updateURL: (replace) => {
                updateUrlCalls.push(Boolean(replace));
            },
            mountPromptRow: () => {},
            restorePromptRow: () => {}
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
            showMyInfo: myInfoScreens.showMyInfo,
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

        if (showMainCalls.length !== 0) {
            errors.push(`Guest /myinfo direct route should not redirect to main before a command arrives (got ${showMainCalls.length} calls)`);
        }
        if (state.screen !== 'myinfo') {
            errors.push(`Guest /myinfo direct route should render the myinfo screen with a guest notice instead of ${state.screen || 'unknown'}`);
        }
        if (state._myInfoMode !== 'guest-blocked') {
            errors.push(`Guest /myinfo direct route did not enter guest-blocked mode (got ${state._myInfoMode || 'empty'})`);
        }
        if (!String(screenEl.innerHTML || '').includes(guestBlockedMessage)) {
            errors.push('Guest /myinfo direct route did not render the guest-blocked notice message');
        }
        if ((hints[hints.length - 1] || '') !== guestBlockedHint) {
            errors.push(`Guest /myinfo direct route is missing the guest-blocked hint (got ${hints[hints.length - 1] || 'none'})`);
        }
        if ((prompts[prompts.length - 1] || '') !== '>> ') {
            errors.push(`Guest /myinfo direct route did not set the guest-blocked prompt (got ${JSON.stringify(prompts[prompts.length - 1] || '')})`);
        }
        if (updateUrlCalls.length !== 1) {
            errors.push(`Guest /myinfo direct route did not request exactly one URL sync while staying on /myinfo (got ${JSON.stringify(updateUrlCalls)})`);
        }
        if (globalThis.window.location.pathname !== '/myinfo') {
            errors.push(`Guest /myinfo direct route should keep the URL at /myinfo until a command arrives (got ${globalThis.window.location.pathname || 'none'})`);
        }

        const handleMyInfoCommand = createMyInfoCommandHandler({
            ...myInfoScreens,
            showMain,
            state
        });
        const guestBlockedCommands = [
            { cmd: '', label: 'enter' },
            { cmd: 'N', label: 'nickname' },
            { cmd: 'PW', label: 'password' },
            { cmd: 'X', label: 'delete' }
        ];

        for (const entry of guestBlockedCommands) {
            state.screen = 'myinfo';
            state._myInfoMode = 'guest-blocked';
            showMainCalls.length = 0;

            const handled = await handleMyInfoCommand({ cmd: entry.cmd, context: {} });

            if (!handled) {
                errors.push(`Guest myinfo ${entry.label} command was not handled on the guest-blocked screen`);
                continue;
            }
            if (showMainCalls.length !== 1) {
                errors.push(`Guest myinfo ${entry.label} command should redirect to main exactly once (got ${showMainCalls.length})`);
            }
            if (state.screen !== 'main') {
                errors.push(`Guest myinfo ${entry.label} command should move to main instead of ${state.screen || 'unknown'}`);
            }
            if (globalThis.window.location.pathname !== '/') {
                errors.push(`Guest myinfo ${entry.label} command did not redirect the URL to / (got ${globalThis.window.location.pathname || 'none'})`);
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

module.exports = {
    verifyProfileRouteCoverage,
    verifyHttpMyInfoCoverage,
    verifyMyInfoRouteCoverage
};
