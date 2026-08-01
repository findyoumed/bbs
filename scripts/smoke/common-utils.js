/**
 * [LOG_ID: 20260801_1243] Common utilities and configuration for E2E smoke tests.
 */
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const { createAppRuntime } = require('../../src/server/createAppRuntime');

const HOST = '127.0.0.1';
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
    '/profile'
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
        expectedText: 'return await showPostView(resolvedBoardId, postId, true);'
    },
    {
        label: 'board direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${String(boardId || '').toLowerCase()}/${postNum}`;"
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
        expectedText: "return `/pds/${postNum}${pdsPageQuery}`;"
    },
    {
        label: 'board write direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardWrite(resolvedBoardId, page);'
    },
    {
        label: 'board edit direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardEdit(resolvedBoardId, postId);'
    },
    {
        label: 'board reply direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: 'return await restoreBoardReply(resolvedBoardId, postId);'
    },
    {
        label: 'board create direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${lowercaseBoardId}/write`;"
    },
    {
        label: 'board edit direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${lowercaseBoardId}/${editPostId}/edit`;"
    },
    {
        label: 'board reply direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/${lowercaseBoardId}/${editPostId}/reply`;"
    },
    {
        label: 'board post-write screen module',
        path: '/js/core/postWriteView.js',
        expectedText: "state.screen = 'post-write';"
    },
    {
        label: 'board attachment direct-route restorer',
        path: '/js/core/routingStateRestorer.js',
        expectedText: "return await showAttachmentList(resolvedBoardId, postId, true);"
    },
    {
        label: 'board attachment list screen module',
        path: '/js/core/postScreens.js',
        expectedText: "state.screen = 'attachment-list';"
    },
    {
        label: 'board attachment command module',
        path: '/js/core/commandRouterPostView.js',
        expectedText: "await downloadAttachment(currentFile.boardId, currentFile.postId, currentFile.fileId, currentFile.fileName);"
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
        expectedText: "state.screen !== 'myinfo'"
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
        expectedText: "return '/profile';"
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
        expectedText: "cmd === 'USER' || cmd === 'USER ALL' || cmd === 'UID' || cmd === 'WHO' || cmd === 'WH' || (cmd === 'W' && !isWriteConflictScreen)"
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
        expectedText: "head === 'PERF'"
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
        expectedText: "return await showNewsArticle(param, articleNo, {"
    },
    {
        label: 'news list direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/service/news/${serviceData?.topicDoor || ''}${pageQuery}`;"
    },
    {
        label: 'news article direct-route url builder',
        path: '/js/core/routingUrlBuilder.js',
        expectedText: "return `/service/news/${topicDoor}?${query.toString()}`;"
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

const config = {
    HOST,
    PORT,
    BASE_URL,
    TIMEOUT,
    TEST_ROUTES,
    APP_SHELL_MARKER,
    FALLBACK_MODULE_CHECKS
};

async function isServerRunning(url) {
    try {
        const res = await fetch(url);
        return res.ok || res.status === 404 || res.status === 302;
    } catch (e) {
        return false;
    }
}

async function startServer() {
    if (config.PORT > 0 && await isServerRunning(config.BASE_URL)) {
        console.log(`ℹ️  Server is already running on ${config.BASE_URL}.`);
        return {
            startedHere: false,
            close: async () => {}
        };
    }

    const rootDir = path.resolve(__dirname, '../..');
    const env = {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(config.PORT)
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
        server.listen(config.PORT, config.HOST, handleListening);
    });
    
    config.PORT = server.address().port;
    config.BASE_URL = `http://${config.HOST}:${config.PORT}`;

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
    const response = await fetch(`${config.BASE_URL}${pathname}`, options);
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

function createHarnessScreenEl() {
    const bodyEl = { innerHTML: '' };
    const EMPTY_BODY = '<div class="ansi-screen-body"></div>';
    return {
        scrollTop: 0,
        scrollHeight: 0,
        set innerHTML(value) {
            this._shell = String(value || '');
            bodyEl.innerHTML = '';
        },
        get innerHTML() {
            const shell = this._shell || '';
            if (shell.includes(EMPTY_BODY) && bodyEl.innerHTML) {
                return shell.replace(EMPTY_BODY, `<div class="ansi-screen-body">${bodyEl.innerHTML}</div>`);
            }
            return shell;
        },
        querySelector(selector) {
            return selector === '.ansi-screen-body' ? bodyEl : null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function createHarnessBrowserGlobals({ innerWidth = 1280, pathname = '/', search = '' } = {}) {
    const elements = new Map();
    const fakeWindow = {
        innerWidth,
        location: { pathname, search },
        matchMedia() {
            return { matches: innerWidth >= 768 };
        },
        scrollTo() {},
        assign() {},
        history: { pushState() {}, replaceState() {} }
    };
    const fakeDocument = {
        _elements: elements,
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        },
        body: { dataset: {} },
        documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } },
        createElement() {
            return {
                style: { setProperty() {}, removeProperty() {} },
                dataset: {},
                classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
                setAttribute() {},
                appendChild() {},
                addEventListener() {},
                removeEventListener() {},
                focus() {},
                remove() {}
            };
        }
    };
    return { window: fakeWindow, document: fakeDocument, elements };
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
    const { createRequire } = require('module');
    const localRequire = createRequire(resolvedPath);
    const fakeModule = { exports: {} };
    const returnExpr = uniqueExportNames.length > 0
        ? `\nreturn { ${uniqueExportNames.join(', ')} };`
        : '\nreturn module.exports;';
    const wrapper = new Function('__loadModule', 'require', 'module', 'exports', `${source}${returnExpr}`);
    const moduleExports = wrapper((nextModulePath) => loadBrowserHarnessModule(nextModulePath, cache), localRequire, fakeModule, fakeModule.exports);
    const result = (uniqueExportNames.length > 0) ? moduleExports : (fakeModule.exports && Object.keys(fakeModule.exports).length > 0 ? fakeModule.exports : moduleExports);
    cache.set(resolvedPath, result);
    return result;
}

async function ensureTerminalReady(page, label, errors) {
    try {
        await page.waitForSelector('#terminal-wrapper', { timeout: config.TIMEOUT });
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
        }, ['#cmd-input', '#signup-confirm-input', '#signup-agree-input', '#signup-oauth-confirm-input'], { timeout: config.TIMEOUT });
        await page.waitForFunction(() => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.trim().length > 0;
        }, null, { timeout: config.TIMEOUT });
        return true;
    } catch (error) {
        errors.push(`Terminal screen did not render at ${label}: ${error.message}`);
        return false;
    }
}

async function openHomeAndWait(page, errors, label) {
    await page.goto(config.BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    return ensureTerminalReady(page, label, errors);
}

async function submitCommand(page, cmd) {
    await page.fill('#cmd-input', cmd);
    await page.keyboard.press('Enter');
}

module.exports = {
    config,
    isServerRunning,
    startServer,
    stopServer,
    isBrowserLaunchBlocked,
    hasNonEmptyText,
    extractApiData,
    extractApiMessage,
    extractBoardItems,
    extractBoardId,
    fetchJsonResponse,
    fetchJsonData,
    resolveBoardDirectRouteTarget,
    resolveUnifiedPdsDirectRouteTarget,
    stripHarnessAnsi,
    ansiToHTMLHarnessStub,
    createHarnessScreenEl,
    createHarnessBrowserGlobals,
    loadBrowserHarnessModule,
    ensureTerminalReady,
    openHomeAndWait,
    submitCommand
};
