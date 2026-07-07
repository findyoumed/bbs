'use strict';

// [LOG: 20260707_1224] raw-text 입력 컨텍스트 디스패치 회귀 테스트
// - 대화실(chat-room)에서 타이핑한 "hi"/"help"/"q" 등은 전역 명령이 아니라 채팅 메시지로 처리되어야 한다.
// - 대화방 개설 단계(chat-lobby + _chatRoomCreateStage)와 내정보 편집 단계(myinfo, mode !== view)도 동일하다.
// - 클릭으로 들어온 명령(context.source === 'click')은 기존 전역 우선 순서를 유지하며,
//   대화실에서 클릭 'T'(상단바 로고)는 메시지 전송이 아니라 초기화면 이동이어야 한다.

const path = require('path');
const { pathToFileURL } = require('url');

const coreDir = path.resolve(__dirname, '../../../../public/js/core');
const fileUrl = (name) => pathToFileURL(path.join(coreDir, name)).href;

function assert(cond, message) {
  if (!cond) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
}

// shouldAutoFocusCommandInput()이 Node 환경에서도 동작하도록 최소 브라우저 전역 스텁
if (typeof global.window === 'undefined') {
  global.window = {};
}
// [LOG: 20260707_1424] ansiTopbarScreen.js의 모듈 레벨 시계 setInterval이 document를 참조하므로 스텁 필요
if (typeof global.document === 'undefined') {
  global.document = { querySelectorAll: () => [] };
}

function createDispatcherHarness(createCommandDispatcherExecution, { state, overrides = {} }) {
  const calls = [];
  const spyHandler = (name, result = false) => async () => {
    calls.push(name);
    return result;
  };

  const handlers = {
    handleGlobalCommand: spyHandler('global', true),
    handleEntryCommand: spyHandler('entry'),
    handleBrowseCommand: spyHandler('browse'),
    handleServiceCommand: spyHandler('service'),
    handleChatCommand: spyHandler('chat'),
    handleMemoCommand: spyHandler('memo'),
    handleMyInfoCommand: spyHandler('myinfo'),
    handlePostViewCommand: spyHandler('postView'),
    handleVfsCommand: spyHandler('vfs'),
    handleLogCommand: spyHandler('log'),
    handleVoteCommand: spyHandler('vote'),
    handleRankingCommand: spyHandler('ranking'),
    ...overrides
  };

  const { executeSingleCommand } = createCommandDispatcherExecution({
    state,
    terminalUiCore: { showError: () => {} },
    statusManager: null,
    soundService: { playBeep: () => {} },
    recordCommandExecution: () => {},
    logger: null,
    aliasService: null,
    handlers,
    screens: {
      showMain: async () => { calls.push('showMain'); },
      handleHistoryBack: async () => {},
      postScreens: { showPostList: async () => {} }
    },
    setPrompt: () => {},
    handleCmd: async () => false
  });

  return { executeSingleCommand, calls };
}

async function run() {
  const { createCommandDispatcherExecution } = await import(fileUrl('commandDispatcherExecution.js'));
  const { createChatCommandHandler } = await import(fileUrl('commandRouterChat.js'));

  // 1. chat-room에서 타이핑한 "hi"는 chat 핸들러가 전역보다 먼저 소비한다.
  {
    const state = { screen: 'chat-room' };
    const { executeSingleCommand, calls } = createDispatcherHarness(createCommandDispatcherExecution, {
      state,
      overrides: { handleChatCommand: async () => { calls.push('chat'); return true; } }
    });
    const handled = await executeSingleCommand('hi');
    assert(handled === true, 'chat-room typed "hi" should be handled');
    assert(calls[0] === 'chat', `chat handler must run first in chat-room (got: ${calls.join(',')})`);
    assert(!calls.includes('global'), 'global handler must not intercept typed chat message');
  }

  // 2. chat-room에서 클릭 출처 명령은 기존 순서(전역 우선)를 따른다.
  {
    const state = { screen: 'chat-room' };
    const { executeSingleCommand, calls } = createDispatcherHarness(createCommandDispatcherExecution, { state });
    await executeSingleCommand('T', { source: 'click' });
    assert(calls.indexOf('chat') === -1 || calls.indexOf('global') < calls.indexOf('chat'),
      `click-sourced command must keep global-first order (got: ${calls.join(',')})`);
  }

  // 3. 대화방 개설 단계의 타이핑 입력("help")은 chat 핸들러가 먼저 소비한다.
  {
    const state = { screen: 'chat-lobby', _chatRoomCreateStage: 'title' };
    const { executeSingleCommand, calls } = createDispatcherHarness(createCommandDispatcherExecution, {
      state,
      overrides: { handleChatCommand: async () => { calls.push('chat'); return true; } }
    });
    await executeSingleCommand('help');
    assert(calls[0] === 'chat', `create-stage input must reach chat handler first (got: ${calls.join(',')})`);
  }

  // 4. 내정보 편집 단계(password)의 타이핑 입력("hist")은 myinfo 핸들러가 먼저 소비한다.
  {
    const state = { screen: 'myinfo', _myInfoMode: 'password', _myInfoStage: 'password-new' };
    const { executeSingleCommand, calls } = createDispatcherHarness(createCommandDispatcherExecution, {
      state,
      overrides: { handleMyInfoCommand: async () => { calls.push('myinfo'); return true; } }
    });
    await executeSingleCommand('hist');
    assert(calls[0] === 'myinfo', `myinfo edit input must reach myinfo handler first (got: ${calls.join(',')})`);
    assert(!calls.includes('global'), 'global handler must not intercept myinfo edit input');
  }

  // 5. myinfo view 모드는 raw-text 컨텍스트가 아니므로 기존 순서를 유지한다.
  {
    const state = { screen: 'myinfo', _myInfoMode: 'view' };
    const { executeSingleCommand, calls } = createDispatcherHarness(createCommandDispatcherExecution, { state });
    await executeSingleCommand('hist');
    assert(calls.includes('global'), `view-mode myinfo must keep global-first order (got: ${calls.join(',')})`);
  }

  // 6. 실제 chat 핸들러: 클릭 'T'는 메시지 전송 없이 초기화면으로 이동한다.
  {
    const apiCalls = [];
    let mainShown = false;
    const state = { screen: 'chat-room', _chatRoomId: '1', _chatSessionKey: 'sk', user: { nickName: '손님' } };
    const handleChatCommand = createChatCommandHandler({
      state,
      ansiToHTML: () => ({ html: '' }),
      apiFetch: async (url, opts) => { apiCalls.push(url); return {}; },
      buildChatRoomAnsi: () => ({ text: '' }),
      cmdInput: { focus: () => {} },
      openChatRoomCreate: async () => {},
      restoreStateFromURL: async () => {},
      screenEl: { innerHTML: '', querySelector: () => null },
      setHint: () => {},
      setPrompt: () => {},
      showChatLobby: async () => {},
      showChatRoom: async () => {},
      showMain: async () => { mainShown = true; }
    });

    const handled = await handleChatCommand({ input: 'T', rawCmd: 'T', cmd: 'T', context: { source: 'click' } });
    assert(handled === true, 'click T in chat-room must be handled by chat handler');
    assert(mainShown === true, 'click T in chat-room must navigate to main');
    assert(apiCalls.length === 0, `click T must not post a chat message (posted: ${apiCalls.join(',')})`);

    // 타이핑한 'T'는 그대로 메시지로 전송된다 (기존 동작 유지).
    const handledTyped = await handleChatCommand({ input: 'T', rawCmd: 'T', cmd: 'T', context: {} });
    assert(handledTyped === true, 'typed T in chat-room must be handled as a message');
    assert(apiCalls.some((url) => url.includes('/messages')), 'typed T must be sent as a chat message');
  }

  console.log('chatRawTextDispatch tests passed!');
  // [LOG: 20260707_1424] ansiTopbarScreen.js의 시계 setInterval이 이벤트 루프를 붙잡으므로 명시적으로 종료한다.
  process.exit(0);
}

run().catch((error) => {
  console.error('FAILED:', error);
  process.exit(1);
});
