/**
 * [LOG_ID: 20260801_1243] Auth E2E smoke tests.
 */
'use strict';

const path = require('path');
const {
    config,
    hasNonEmptyText,
    loadBrowserHarnessModule
} = require('./common-utils');

async function verifyAuthRecoveryCoverage(errors) {
    console.log('🔐 Checking auth recovery route coverage via module harness...');

    const originalWindow = globalThis.window;

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
        await expectAppShell('/log/login');
        await expectAppShell('/log/password');

        const moduleCache = new Map();
        const { createMenuService } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/menuService.js'), moduleCache);
        const { createAuthServiceBootstrap } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/authServiceBootstrap.js'), moduleCache);

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
                                onAuthStateChange(callback) {
                                    // [LOG_ID: 20260804_1114] Supabase emits this immediately after
                                    // subscription; it must not duplicate initAuth's explicit refresh.
                                    callback('INITIAL_SESSION', {
                                        access_token: 'auth-recovery-smoke-token'
                                    });
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
                refreshUser: async () => {
                    state._refreshUserCalls = Number(state._refreshUserCalls || 0) + 1;
                }
            });

            await initAuth();
            return state;
        }

        const loginState = await runBootstrapCase('/log/login');
        if (loginState._refreshUserCalls !== 1) {
            errors.push(`Auth bootstrap refreshed the server session ${loginState._refreshUserCalls || 0} times on /log/login (expected 1)`);
        }
        if (loginState._passwordRecoveryActive || loginState._passwordResetMode !== 'request') {
            errors.push(`Auth bootstrap incorrectly armed recovery mode on /log/login (got active=${Boolean(loginState._passwordRecoveryActive)}, mode=${loginState._passwordResetMode || 'empty'})`);
        }

        const passwordState = await runBootstrapCase('/log/password');
        if (passwordState._refreshUserCalls !== 1) {
            errors.push(`Auth bootstrap refreshed the server session ${passwordState._refreshUserCalls || 0} times on /log/password (expected 1)`);
        }
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
            this.dataset = {};
            this.inputMode = '';
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

        removeEventListener(type) {
            this.listeners.delete(type);
        }

        dispatchEvent() {
            return true;
        }

        setAttribute() {}

        querySelector() {
            return null;
        }

        querySelectorAll() {
            return [];
        }
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
        await expectAppShell('/log/signup');
        await expectAppShell('/log/signup/email');
        await expectAppShell('/log/signup/agree');
        await expectAppShell('/log/signup/profile');

        const moduleCache = new Map();
        const { createSignupModule } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/signupModule.js'), moduleCache);
        const { createSignupScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/signupScreens.js'), moduleCache);
        const { createRoutingStateRestorer } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingStateRestorer.js'), moduleCache);
        const { createRoutingUrlBuilder } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/routingUrlBuilder.js'), moduleCache);

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
                querySelector() {
                    return null;
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

        function assertSignupEmailFooterRoute(caseData, routeLabel) {
            if (!String(caseData.screenEl?.innerHTML || '').includes('data-signup-email-prompt-host')) {
                errors.push(`${routeLabel} did not render the shared prompt-row host for the email step`);
            }
            if (!caseData.footerVisibilityCalls.some((visible) => visible === true)) {
                errors.push(`${routeLabel} did not request shared footer visibility for the email step`);
            }
        }

        const loginCase = await runAuthRouteCase({ pathname: '/log/login' });
        if (loginCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth login direct route did not run the up-front menu-tree hydration for /log/login (got ${loginCase.loadMenuTreeCalls} calls)`);
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
        if (passwordCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth password direct route did not run the up-front menu-tree hydration for /log/password (got ${passwordCase.loadMenuTreeCalls} calls)`);
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
        if (signupEmailCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup email direct route did not run the up-front menu-tree hydration for /log/signup/email (got ${signupEmailCase.loadMenuTreeCalls} calls)`);
        }
        if (signupEmailCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup email direct route incorrectly fell back to showBoardSelect() for /log/signup/email');
        }
        if (signupEmailCase.state.screen !== 'signup' || signupEmailCase.state._signupFlow !== 'email') {
            errors.push(`Auth signup email direct route did not restore the email flow for /log/signup/email (got screen=${signupEmailCase.state.screen}, flow=${signupEmailCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupEmailCase.screenEl.innerHTML || '').includes('data-signup-email-prompt-host')) {
            errors.push('Auth signup email direct route did not render the inline email signup form for /log/signup/email');
        }
        if (signupEmailCase.path !== '/log/signup/email' || signupEmailCase.builtUrl !== '/log/signup/email') {
            errors.push(`Auth signup email direct route left URL state out of sync for /log/signup/email (path=${signupEmailCase.path}, built=${signupEmailCase.builtUrl})`);
        }
        if (!signupEmailCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/email')) {
            errors.push('Auth signup email direct route did not request replaceState URL sync for /log/signup/email');
        }
        assertSignupEmailFooterRoute(signupEmailCase, 'Auth signup email direct route');

        const signupAgreeFallbackCase = await runAuthRouteCase({ pathname: '/log/signup/agree' });
        if (signupAgreeFallbackCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup agree fallback direct route did not run the up-front menu-tree hydration for /log/signup/agree (got ${signupAgreeFallbackCase.loadMenuTreeCalls} calls)`);
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
        if (signupAgreeEmailFallbackCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup agree email fallback did not run the up-front menu-tree hydration for /log/signup/agree (got ${signupAgreeEmailFallbackCase.loadMenuTreeCalls} calls)`);
        }
        if (signupAgreeEmailFallbackCase.boardSelectCalls.length !== 0) {
            errors.push('Auth signup agree email fallback incorrectly fell back to showBoardSelect() instead of showSignup()');
        }
        if (signupAgreeEmailFallbackCase.state.screen !== 'signup' || signupAgreeEmailFallbackCase.state._signupFlow !== 'email') {
            errors.push(`Auth signup agree email fallback did not normalize to the email form for /log/signup/agree (got screen=${signupAgreeEmailFallbackCase.state.screen}, flow=${signupAgreeEmailFallbackCase.state._signupFlow || 'empty'})`);
        }
        if (!String(signupAgreeEmailFallbackCase.screenEl.innerHTML || '').includes('data-signup-email-prompt-host')) {
            errors.push('Auth signup agree email fallback did not render the inline email signup form when the draft is missing');
        }
        if (signupAgreeEmailFallbackCase.path !== '/log/signup/email' || signupAgreeEmailFallbackCase.builtUrl !== '/log/signup/email') {
            errors.push(`Auth signup agree email fallback did not normalize the URL to /log/signup/email (path=${signupAgreeEmailFallbackCase.path}, built=${signupAgreeEmailFallbackCase.builtUrl})`);
        }
        if (!signupAgreeEmailFallbackCase.updateRequests.some((entry) => entry.replace === true && entry.url === '/log/signup/email')) {
            errors.push('Auth signup agree email fallback did not request replaceState URL sync to /log/signup/email');
        }
        assertSignupEmailFooterRoute(signupAgreeEmailFallbackCase, 'Auth signup agree email fallback');

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
        if (signupAgreeCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup agree direct route did not run the up-front menu-tree hydration for /log/signup/agree (got ${signupAgreeCase.loadMenuTreeCalls} calls)`);
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
        if (oauthProfileCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup profile direct route did not run the up-front menu-tree hydration for /log/signup/profile (got ${oauthProfileCase.loadMenuTreeCalls} calls)`);
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
        if (signupFallbackCase.loadMenuTreeCalls < 1) {
            errors.push(`Auth signup fallback direct route did not run the up-front menu-tree hydration for /log/signup/profile (got ${signupFallbackCase.loadMenuTreeCalls} calls)`);
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

module.exports = {
    verifyAuthRecoveryCoverage,
    verifyAuthEntryRouteCoverage
};
