/**
 * [LOG_ID: 20260801_1243] Chat E2E smoke tests.
 */
'use strict';

const path = require('path');
const {
    config,
    fetchJsonResponse,
    fetchJsonData,
    hasNonEmptyText,
    loadBrowserHarnessModule,
    ansiToHTMLHarnessStub,
    ensureTerminalReady,
    submitCommand
} = require('./common-utils');

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

        const directRouteResponse = await fetch(`${config.BASE_URL}/chat/${encodeURIComponent(firstRoomNo)}`);
        const directRouteContent = await directRouteResponse.text();
        if (!directRouteResponse.ok) {
            errors.push(`HTTP ${directRouteResponse.status} at /chat/${firstRoomNo}`);
            return;
        }

        if (!hasNonEmptyText(directRouteContent)) {
            errors.push(`Empty page content at /chat/${firstRoomNo}`);
            return;
        }

        if (!directRouteContent.includes(config.APP_SHELL_MARKER)) {
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
        const { createChatScreens } = loadBrowserHarnessModule(path.join(__dirname, '../..', 'public/js/core/chatScreens.js'), moduleCache);

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

// [LOG: 20260801_2220] ESC 취소 후 join 유령 참여자 정리 — Case A(join 중 throw)와
// Case B(join 완료 후 state.screen 복원) 양쪽 모두 leave가 호출되는지 검증한다.
async function verifyChatRoomEscCleanupCoverage(errors) {
    console.log('💬 Checking chat room ESC ghost-participant cleanup via module harness...');

    const originalWindow = globalThis.window;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;

    try {
        const moduleCache = new Map();
        const { createChatScreens } = loadBrowserHarnessModule(
            path.join(__dirname, '../..', 'public/js/core/chatScreens.js'),
            moduleCache
        );

        globalThis.window = { matchMedia() { return { matches: false }; } };

        const pollTimersCaptured = [];
        globalThis.setInterval = (_handler, delay) => {
            pollTimersCaptured.push(delay);
            return pollTimersCaptured.length;
        };
        globalThis.clearInterval = () => {};

        const makeScreenEl = () => ({
            innerHTML: '',
            parentElement: { classList: { add() {}, remove() {} } },
            querySelector() { return null; }
        });

        // Case A: join 중 ESC — apiFetch가 cancelled 오류를 throw하고
        //         state.screen이 이전 화면으로 복원된 상황.
        {
            const leaveCallsA = [];
            const stateA = {
                screen: 'chat-lobby',
                history: [],
                _chatRooms: [{ no: 1, id: '1', title: '테스트방' }],
                user: { userId: 'test', nickName: '테스터' }
            };

            const chatScreensA = createChatScreens({
                ansiToHTML: ansiToHTMLHarnessStub,
                apiFetch: async (url) => {
                    if (String(url).includes('/join')) {
                        stateA.screen = 'chat-lobby'; // ESC 시뮬레이션: 화면 복원 후 throw
                        const err = new Error('요청이 취소되었습니다.');
                        err.type = 'cancelled';
                        throw err;
                    }
                    if (String(url).includes('/leave')) {
                        leaveCallsA.push(url);
                        return {};
                    }
                    throw new Error(`Case A: unexpected apiFetch path: ${url}`);
                },
                applyCommandFooter: async () => {},
                buildChatLobbyAnsi: () => ({ text: 'LOBBY' }),
                buildChatRoomAnsi: () => ({ text: 'ROOM' }),
                cmdInput: { focus() {} },
                getCommandFooterText: () => '',
                getMenuNodeByKey: () => null,
                renderScreenSequential: async () => {},
                screenEl: makeScreenEl(),
                setHint: () => {},
                setPrompt: () => {},
                state: stateA,
                updateURL: () => {}
            });

            const pollCountBefore = pollTimersCaptured.length;
            try {
                await chatScreensA.showChatRoom('1');
            } catch (e) {
                errors.push(`Case A (ESC during join): showChatRoom threw unexpectedly: ${e.message}`);
                return;
            }
            if (leaveCallsA.length !== 1) {
                errors.push(`Case A (ESC during join): expected 1 leave call, got ${leaveCallsA.length}`);
            }
            if (stateA._chatRoomId !== null) {
                errors.push(`Case A (ESC during join): expected _chatRoomId to be null, got ${stateA._chatRoomId}`);
            }
            if (pollTimersCaptured.length !== pollCountBefore) {
                errors.push(`Case A (ESC during join): expected no poll timer, got ${pollTimersCaptured.length - pollCountBefore}`);
            }
        }

        // Case B: join 완료 후 ESC — apiFetch가 정상 반환했지만
        //         state.screen이 이미 이전 화면으로 복원된 상황.
        {
            const leaveCallsB = [];
            const stateB = {
                screen: 'chat-lobby',
                history: [],
                _chatRooms: [{ no: 1, id: '1', title: '테스트방' }],
                user: { userId: 'test', nickName: '테스터' }
            };

            const chatScreensB = createChatScreens({
                ansiToHTML: ansiToHTMLHarnessStub,
                apiFetch: async (url) => {
                    if (String(url).includes('/join')) {
                        stateB.screen = 'chat-lobby'; // ESC 시뮬레이션: 응답 반환 직전에 화면 복원
                        return { no: 1, title: '테스트방', userCount: 1 };
                    }
                    if (String(url).includes('/leave')) {
                        leaveCallsB.push(url);
                        return {};
                    }
                    throw new Error(`Case B: unexpected apiFetch path: ${url}`);
                },
                applyCommandFooter: async () => {},
                buildChatLobbyAnsi: () => ({ text: 'LOBBY' }),
                buildChatRoomAnsi: () => ({ text: 'ROOM' }),
                cmdInput: { focus() {} },
                getCommandFooterText: () => '',
                getMenuNodeByKey: () => null,
                renderScreenSequential: async () => {},
                screenEl: makeScreenEl(),
                setHint: () => {},
                setPrompt: () => {},
                state: stateB,
                updateURL: () => {}
            });

            const pollCountBefore = pollTimersCaptured.length;
            try {
                await chatScreensB.showChatRoom('1');
            } catch (e) {
                errors.push(`Case B (ESC after join): showChatRoom threw unexpectedly: ${e.message}`);
                return;
            }
            if (leaveCallsB.length !== 1) {
                errors.push(`Case B (ESC after join): expected 1 leave call, got ${leaveCallsB.length}`);
            }
            if (stateB._chatRoomId !== null) {
                errors.push(`Case B (ESC after join): expected _chatRoomId to be null, got ${stateB._chatRoomId}`);
            }
            if (pollTimersCaptured.length !== pollCountBefore) {
                errors.push(`Case B (ESC after join): expected no poll timer, got ${pollTimersCaptured.length - pollCountBefore}`);
            }
        }
    } catch (error) {
        errors.push(`Chat room ESC cleanup module harness failed: ${error.message}`);
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
    }
}

// [LOG_ID: 20260829_0900] domainTextFirst가 채팅 입력을 먼저 소비하므로,
// 대화실 안에서도 원전처럼 `GO 코드`가 메시지로 전송되지 않고 전역 이동으로
// 처리되는지 모듈 수준에서 고정한다.
async function verifyChatGoCommandCoverage(errors) {
    console.log('🧭 Checking GO command handling inside an active chat room...');

    try {
        const moduleCache = new Map();
        const { createChatCommandHandler } = loadBrowserHarnessModule(
            path.join(__dirname, '../..', 'public/js/core/commandRouterChat.js'),
            moduleCache
        );
        const goCalls = [];
        const leaveCalls = [];
        const hints = [];
        const prompts = [];
        const state = {
            screen: 'chat-room',
            _chatRoomId: 'room-1',
            _chatSessionKey: 'session-1',
            _chatMessages: [],
            user: { userId: 'smoke-user', nickName: '스모크' }
        };
        const handler = createChatCommandHandler({
            apiFetch: async (url) => {
                if (String(url).includes('/leave')) leaveCalls.push(url);
                if (String(url).includes('/messages')) throw new Error('GO must not send a chat message');
                return {};
            },
            executeGoCommand: async (rawCommand) => {
                goCalls.push(rawCommand);
                return rawCommand === 'GO HUMOR';
            },
            setHint: (value) => hints.push(String(value || '')),
            setPrompt: (value) => prompts.push(String(value || '')),
            state
        });

        const handled = await handler({ input: 'GO HUMOR', rawCmd: 'GO HUMOR', cmd: 'GO HUMOR', context: {} });
        if (!handled || goCalls[0] !== 'GO HUMOR' || leaveCalls.length !== 1 || state._chatMessages.length !== 0) {
            errors.push('Plain GO HUMOR inside a chat room did not use the global GO handler and room cleanup path');
        }

        state._chatRoomId = 'room-2';
        const slashHandled = await handler({ input: '/GO HUMOR', rawCmd: '/GO HUMOR', cmd: '/GO HUMOR', context: {} });
        if (!slashHandled || goCalls[1] !== 'GO HUMOR' || leaveCalls.length !== 2) {
            errors.push('Slash GO HUMOR inside a chat room did not use the global GO handler and room cleanup path');
        }

        state._chatRoomId = 'room-3';
        const unsupportedHandled = await handler({ input: 'GO PGF', rawCmd: 'GO PGF', cmd: 'GO PGF', context: {} });
        if (!unsupportedHandled || leaveCalls.length !== 2 || !hints.includes('이동할 메뉴를 찾지 못했습니다.') || !prompts.includes('선택 >>')) {
            errors.push('Unsupported GO inside a chat room should stay in the room and show a local hint');
        }
    } catch (error) {
        errors.push(`Chat-room GO module harness failed: ${error.message}`);
    }
}

// [LOG: 20260428_2339] When Playwright is available, /chat must prove room entry,
// message send, and reload hydration instead of stopping at lobby shell coverage.
async function verifyPlaywrightChatFlow(page, errors) {
    console.log('💬 Testing Chat Room Flow...');
    const smokeMessage = `smoke-chat-${Date.now()}`;

    try {
        await page.goto(`${config.BASE_URL}/chat`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (!(await ensureTerminalReady(page, '/chat lobby', errors))) {
            return;
        }

        const lobbyText = await page.evaluate(() => document.getElementById('terminal-screen')?.textContent || '');
        if (!hasNonEmptyText(lobbyText) || !lobbyText.includes('공개')) {
            errors.push('Chat lobby did not expose a selectable first room.');
            return;
        }

        await submitCommand(page, '1');
        await page.waitForURL((url) => /^\/chat\/[^/]+$/.test(url.pathname), { timeout: config.TIMEOUT });
        await page.waitForFunction(() => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes('참여자:') && screenText.includes('/Q');
        }, null, { timeout: config.TIMEOUT });

        await submitCommand(page, smokeMessage);
        await page.waitForFunction((expectedMessage) => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes(expectedMessage);
        }, smokeMessage, { timeout: config.TIMEOUT });

        const roomUrl = page.url();
        await page.goto(roomUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (!(await ensureTerminalReady(page, roomUrl, errors))) {
            return;
        }

        await page.waitForFunction((expectedMessage) => {
            const screenText = document.getElementById('terminal-screen')?.textContent || '';
            return screenText.includes(expectedMessage);
        }, smokeMessage, { timeout: config.TIMEOUT });
    } catch (error) {
        errors.push(`Chat room flow failed: ${error.message}`);
    }
}

module.exports = {
    verifyHttpChatCoverage,
    verifyChatHistorySnapshotCoverage,
    verifyChatRoomEscCleanupCoverage,
    verifyChatGoCommandCoverage,
    verifyPlaywrightChatFlow
};
