/**
 * [LOG_ID: 20260804_2037] PC통신 3사 통합 명령·UX 순서 회귀 검사.
 */
'use strict';

const path = require('path');
const { assert } = require('./lib/scriptUtils');
const { loadBrowserHarnessModule } = require('./smoke/common-utils');

const coreDir = path.join(__dirname, '..', 'public/js/core');
const moduleCache = new Map();
const { normalizeCommand } = loadBrowserHarnessModule(path.join(coreDir, 'commandNormalizer.js'), moduleCache);
const { CMD_META } = loadBrowserHarnessModule(path.join(coreDir, 'commandService.js'), moduleCache);
const { createCommandFooterTextUtils } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandFooterText.js'),
  moduleCache
);
const { createGlobalNavigationCommandHandler } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandRouterGlobalNavigation.js'),
  moduleCache
);
const { createPostViewCommandHandler } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandRouterPostView.js'),
  moduleCache
);
const { createBrowseCommandHandler } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandRouterBrowse.js'),
  moduleCache
);
const { createMemoCommandHandler } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandRouterMemo.js'),
  moduleCache
);
const { createChatCommandHandler } = loadBrowserHarnessModule(
  path.join(coreDir, 'commandRouterChat.js'),
  moduleCache
);

function verifyNormalizerParity() {
  assert(normalizeCommand('DIR', 'post-list') === 'L', 'DIR should map to L');
  assert(normalizeCommand('LS', 'board-select') === 'LS', 'LS should remain a board-list jump command');
  assert(normalizeCommand('N', 'post-list') === 'N', 'N should stay N on post-list');
  assert(normalizeCommand(']', 'post-view') === 'A', '] should map to A');
  assert(normalizeCommand('[', 'post-view') === 'N', '[ should map to N');
  assert(normalizeCommand('SW title', 'post-list') === 'LT title', 'SW should map to LT');
  assert(normalizeCommand('SI writer', 'post-list') === 'LI writer', 'SI should map to LI');
  assert(normalizeCommand('SN writer', 'post-list') === 'LI writer', 'SN should map to LI');

  assert(normalizeCommand('U', 'post-list') === 'W', 'Chollian U should map to list-screen write');
  assert(normalizeCommand('U', 'post-view') === 'U', 'Post-view U must remain attachment list');
  assert(normalizeCommand('DEL 12', 'post-list') === 'D 12', 'DEL should map to delete');
  assert(normalizeCommand('FROM Writer', 'post-list') === 'LI Writer', 'FROM should map to author search');
  assert(normalizeCommand('KEY game', 'post-list') === 'K game', 'KEY should map to keyword search');
  assert(normalizeCommand('KEY', 'post-list') === 'KEY', 'Bare KEY should retain its prompt flow');
  assert(normalizeCommand('MR 1-3', 'post-list') === 'PR 1-3', 'MR should map to continuous read');
  assert(normalizeCommand('DOWN 2', 'post-list') === 'DN 2', 'DOWN should map to PDS download');
  assert(normalizeCommand('USE', 'main') === 'TIME', 'USE should map to session time');
  assert(normalizeCommand('FI Member', 'main') === 'FI Member', 'FI must not prefix-match to FIND');
  assert(normalizeCommand('DATE 260804', 'post-list') === 'DATE 260804', 'DATE should retain compact date');
  assert(normalizeCommand('TO target 안녕하세요', 'post-list') === 'TO target 안녕하세요', 'TO should retain message text');

  ['TO', 'FW', 'ST', 'FI', 'PT', 'USER', 'ANSI'].forEach((key) => {
    assert(CMD_META[key], key + ' should be discoverable in command help');
  });
  assert(String(CMD_META.A.tip || '').includes('A 번호'), 'A help should explain its list reply form');
  assert(String(CMD_META.WHO.tip || '').includes('U'), 'WHO help should expose the U alias');
  assert(String(CMD_META.FW.tip || '').includes('[번호] [아이디]'), 'FW help should explain list forwarding');

  const footerUtils = createCommandFooterTextUtils({ state: { user: { isGuest: false } } });
  assert(footerUtils.getCommandFooterText('postList').includes('NEW:새글'), 'post-list footer should expose NEW');
  assert(footerUtils.getCommandFooterText('pdsList').includes('NEW:새글'), 'PDS footer should expose NEW');
}

async function verifyQuickMemoFlow() {
  const state = {
    screen: 'post-list',
    user: { userId: 'sender', isGuest: false }
  };
  let request = null;
  let hint = '';
  let prompt = '';
  let activeUsersShown = 0;
  const handler = createGlobalNavigationCommandHandler({
    state,
    apiFetch: async (url, options) => {
      request = { url, options };
      return { recipientAbsent: false };
    },
    executeGoCommand: async () => false,
    showActiveUsers: async () => { activeUsersShown += 1; },
    setHint: (value) => { hint = String(value); },
    setPrompt: (value) => { prompt = String(value); }
  });

  const handled = await handler({
    cmd: 'TO TARGET 안녕하세요',
    rawCmd: 'TO target 안녕하세요',
    input: 'TO target 안녕하세요'
  });
  assert(handled === true, 'TO should be handled on command screens');
  assert(request?.url === '/api/memos', 'TO should post to the memo API');
  assert(request?.options?.method === 'POST', 'TO should use POST');
  const body = JSON.parse(request.options.body);
  assert(body.recipientUserId === 'target', 'TO should preserve the recipient');
  assert(body.title === '[한줄쪽지]', 'TO should label the quick memo');
  assert(body.content === '안녕하세요', 'TO should preserve the one-line content');
  assert(hint.includes('보냈습니다'), 'TO should confirm completion after the API resolves');
  assert(prompt === '>>', 'TO should restore the default prompt after completion');

  state.screen = 'chat-room';
  request = null;
  const chatHandled = await handler({
    cmd: 'TO TARGET 비밀말',
    rawCmd: 'TO target 비밀말',
    input: 'TO target 비밀말'
  });
  assert(chatHandled === false, 'Chat-room TO must remain available to the whisper handler');
  assert(request === null, 'Chat-room TO must not send a memo');

  state.screen = 'main';
  assert(await handler({ cmd: 'U', rawCmd: 'U', input: 'U' }) === true, 'U should be handled as the historical WHO shortcut outside post-local screens');
  assert(activeUsersShown === 1, 'U should open the active-user list exactly once');
}

async function verifySosFlow() {
  const state = {
    screen: 'main',
    user: { userId: 'sender', isGuest: false }
  };
  const drafts = [];
  let hint = '';
  let prompt = '';
  const handler = createGlobalNavigationCommandHandler({
    state,
    showContactSysop: async (fromHistory, draft) => drafts.push({ fromHistory, draft }),
    executeGoCommand: async () => false,
    setHint: (value) => { hint = String(value); },
    setPrompt: (value) => { prompt = String(value); }
  });

  const handled = await handler({
    cmd: 'SOS',
    rawCmd: 'SOS 서버 접속이 끊깁니다',
    input: 'SOS 서버 접속이 끊깁니다'
  });
  assert(handled === true, 'SOS with a message should open the contact editor');
  assert(drafts.length === 1 && drafts[0].fromHistory === false, 'SOS should open a fresh contact draft');
  assert(drafts[0].draft.subject === '[긴급 SOS] 시삽에게 보내는 메시지', 'SOS should use an explicit emergency subject');
  assert(drafts[0].draft.bodyLines.join('\n') === '서버 접속이 끊깁니다', 'SOS should prefill the emergency message');

  drafts.length = 0;
  assert(await handler({ cmd: 'SOS', rawCmd: 'SOS', input: 'SOS' }) === true, 'Bare SOS should open a blank contact editor');
  assert(drafts[0].draft.subject === '' && drafts[0].draft.bodyLines.length === 0, 'Bare SOS should let the user compose the message');

  state.user = { userId: 'guest', isGuest: true };
  drafts.length = 0;
  assert(await handler({ cmd: 'SOS', rawCmd: 'SOS 긴급', input: 'SOS 긴급' }) === true, 'Guest SOS should be handled with a login hint');
  assert(drafts.length === 0 && hint.includes('로그인 후'), 'Guest SOS must not open or send a contact draft');
  assert(prompt === '>>', 'Guest SOS should restore the default prompt');
}

async function verifyDirectPostReadFlow() {
  const state = {
    screen: 'post-view',
    board: { id: 'pds' },
    post: { boardId: 'pds-game', localId: 7 },
    postPageNo: 1,
    postPageCount: 1
  };
  let opened = null;
  const handler = createPostViewCommandHandler({
    state,
    showPostView: async (boardId, postId) => {
      opened = { boardId, postId };
    }
  });

  const handled = await handler({ cmd: 'P 42', context: {} });
  assert(handled === true, 'P number should be handled while reading a post');
  assert(opened?.boardId === 'pds-game', 'P number should retain the physical board in unified PDS');
  assert(opened?.postId === 42, 'P number should open the requested post directly');
}

async function verifyCompactDateFlow() {
  const state = {
    screen: 'post-list',
    board: { id: 'notice' },
    boardMenuPath: 'top',
    boardMenuTitle: '공지사항',
    posts: [],
    page: 1,
    totalPages: 1,
    user: { isGuest: false }
  };
  const posts = Array.from({ length: 15 }, (_, index) => ({
    localId: 100 - index,
    createdAt: '2026-08-05T12:00:00.000Z'
  }));
  posts.push({ localId: 85, createdAt: '2026-08-04T12:00:00.000Z' });

  let openedPage = null;
  let hint = '';
  let prompt = '';
  const handler = createBrowseCommandHandler({
    state,
    apiFetch: async () => ({ posts, pagination: { pageCount: 1 } }),
    setHint: (value) => { hint = String(value); },
    setPrompt: (value) => { prompt = String(value); },
    showPostList: async (_boardId, page) => { openedPage = page; }
  });

  const handled = await handler({
    s: 'post-list',
    input: 'DATE 260804',
    cmd: 'DATE 260804',
    rawCmd: 'DATE 260804',
    context: {}
  });
  assert(handled === true, 'DATE YYMMDD should be handled on post lists');
  assert(openedPage === 2, 'DATE should calculate the destination page after the awaited scan');
  assert(hint.includes('2페이지'), 'DATE should announce the destination before rendering it');

  openedPage = null;
  await handler({
    s: 'post-list',
    input: 'DATE 260230',
    cmd: 'DATE 260230',
    rawCmd: 'DATE 260230',
    context: {}
  });
  assert(openedPage === null, 'DATE should reject impossible calendar dates');
  assert(hint.includes('존재하지 않는 날짜'), 'DATE should explain invalid dates');

  state._pendingSearch = null;
  await handler({
    s: 'post-list',
    input: 'KEY',
    cmd: 'KEY',
    rawCmd: 'KEY',
    context: {}
  });
  assert(state._pendingSearch?.type === 'k', 'Bare KEY should enter a keyword prompt flow');
  assert(prompt === '주제어 >>', 'KEY should show the keyword prompt');

  state._pendingSearch = null;
  await handler({
    s: 'post-list',
    input: 'DEL',
    cmd: 'D',
    rawCmd: 'D',
    context: {}
  });
  assert(state._pendingDeletePostNumber === true, 'Bare DEL should ask for the post number');
  assert(prompt.includes('삭제할 글 번호'), 'DEL should display its number prompt');

  await handler({
    s: 'post-list',
    input: 'P',
    cmd: 'P',
    rawCmd: 'P',
    context: {}
  });
  assert(state._pendingDeletePostNumber === false, 'P should cancel the staged DEL flow');
  assert(hint.includes('취소'), 'DEL cancellation should be acknowledged');
}

async function verifyHistoricalLongForms() {
  const browseState = {
    screen: 'post-list',
    board: { id: 'plaza' },
    posts: [{ localId: 42, boardId: 'plaza', title: '테스트 글' }],
    user: { userId: 'sender', isGuest: false }
  };
  let viewed = null;
  let replied = null;
  const browseHandler = createBrowseCommandHandler({
    state: browseState,
    showPostView: async (boardId, postId) => { viewed = { boardId, postId }; },
    showPostWrite: (mode, post) => { replied = { mode, post }; },
    setHint: () => {},
    setPrompt: () => {}
  });

  assert(normalizeCommand('PREV', 'post-list') === 'P', 'PREV should normalize to P');
  assert(normalizeCommand('MAIN', 'post-list') === 'M', 'MAIN should normalize to M');
  assert(normalizeCommand('QUIT', 'post-list') === 'Q', 'QUIT should normalize to Q');
  assert(normalizeCommand('WRITE', 'post-list') === 'W', 'WRITE should normalize to W');
  assert(normalizeCommand('READ 42', 'post-list') === 'R 42', 'READ should normalize to R on post lists');
  assert(normalizeCommand('ANSWER 42', 'post-list') === 'RE 42', 'ANSWER should normalize to RE');
  assert(normalizeCommand('FINGER friend', 'main') === 'PF friend', 'FINGER should normalize to PF');
  assert(normalizeCommand('INFO', 'main') === 'HI', 'INFO should normalize to HI');
  assert(normalizeCommand('CHATIN', 'main') === 'CHAT', 'CHATIN should normalize to CHAT');
  assert(normalizeCommand('F 42', 'post-list') === 'LS 42', 'F number should use the existing list-position handler');
  assert(normalizeCommand('F', 'post-list') === 'F', 'bare F should remain list pagination');
  assert(normalizeCommand('FL', 'post-list') === 'L', 'FL should normalize to the list command');
  assert(String(CMD_META.CHAT.tip || '').includes('CHATIN'), 'CHAT help should expose the CHATIN alias');

  assert(await browseHandler({ s: 'post-list', cmd: 'R 42', rawCmd: 'R 42', input: 'R 42' }) === true, 'R number should open a post');
  assert(viewed?.boardId === 'plaza' && viewed?.postId === 42, 'R number should preserve the target post');
  assert(await browseHandler({ s: 'post-list', cmd: 'RE 42', rawCmd: 'RE 42', input: 'RE 42' }) === true, 'RE number should open reply compose');
  assert(replied?.mode === 'reply' && replied?.post?.localId === 42, 'RE number should target the selected post');
  replied = null;
  assert(await browseHandler({ s: 'post-list', cmd: 'A 42', rawCmd: 'A 42', input: 'A 42' }) === true, 'A number should open reply compose from a post list');
  assert(replied?.mode === 'reply' && replied?.post?.localId === 42, 'A number should target the selected post');

  const memoState = {
    screen: 'memo-list',
    _memos: [{ id: 'memo-1', senderUserId: 'sender', content: '전달할 본문', createdAt: '2026-08-28T00:00:00.000Z' }],
    user: { userId: 'sender', isGuest: false }
  };
  let memoViewed = null;
  let memoWriteTarget = null;
  const memoHandler = createMemoCommandHandler({
    state: memoState,
    showMemoView: async (id) => { memoViewed = id; },
    showMemoWrite: async (target) => { memoWriteTarget = target; },
    showMemoList: async () => {},
    showMemoMenu: async () => {},
    showMemoHelp: async () => {},
    setHint: () => {},
    setPrompt: () => {},
    apiFetch: async () => ({})
  });
  assert(normalizeCommand('LIST', 'memo-list') === 'L', 'LIST should normalize to L on memo lists');
  assert(normalizeCommand('READ 1', 'memo-list') === 'R 1', 'READ should normalize to R on memo lists');
  await memoHandler({ cmd: 'R 1', rawCmd: 'R 1', input: 'R 1' });
  assert(memoViewed === 'memo-1', 'R number should open a memo');
  await memoHandler({ cmd: 'S FRIEND', rawCmd: 'S friend', input: 'S friend' });
  assert(memoWriteTarget === 'friend', 'S user should open memo compose for that user');
  memoWriteTarget = null;
  await memoHandler({ cmd: 'FW 1 friend2', rawCmd: 'FW 1 friend2', input: 'FW 1 friend2' });
  assert(memoWriteTarget === 'friend2', 'FW number user should open compose for the forwarding recipient');
  assert(String(memoState._forwardMemoContent || '').includes('전달된 쪽지') && String(memoState._forwardMemoContent || '').includes('전달할 본문'), 'FW should prefill the selected memo content');
}

async function verifyChatinFlow() {
  const state = {
    screen: 'main',
    user: { userId: 'sender', isGuest: false }
  };
  let lobbyShown = 0;
  const handler = createGlobalNavigationCommandHandler({
    state,
    showChatLobby: async () => { lobbyShown += 1; },
    setHint: () => {},
    setPrompt: () => {},
    executeGoCommand: async () => false
  });

  assert(await handler({ cmd: 'CHAT', rawCmd: 'CHAT', input: 'CHAT' }) === true, 'CHAT should open the chat lobby');
  assert(await handler({ cmd: 'CHAT', rawCmd: 'CHATIN', input: 'CHATIN' }) === true, 'CHATIN should open the chat lobby');
  assert(lobbyShown === 2, 'CHAT and CHATIN should reuse the lobby renderer');
}

async function verifyHistoricalChatListShortcut() {
  const state = {
    screen: 'chat-room',
    _chatRoomId: '7',
    _chatSessionKey: 'session-7',
    _chatRoom: { no: '7', title: 'chat room' },
    user: { userId: 'sender', nickName: 'sender' }
  };
  let leaveRequest = null;
  let lobbyShown = 0;
  const handler = createChatCommandHandler({
    state,
    apiFetch: async (url, options) => {
      leaveRequest = { url, options };
      return {};
    },
    buildChatRoomAnsi: () => ({ text: '' }),
    ansiToHTML: (value) => value,
    cmdInput: { focus() {} },
    executeGoCommand: async () => false,
    openChatRoomCreate: async () => {},
    restoreStateFromURL: async () => {},
    screenEl: { innerHTML: '' },
    setHint: () => {},
    setPrompt: () => {},
    showChatLobby: async () => { lobbyShown += 1; },
    showChatRoom: async () => {},
    showMain: async () => {}
  });

  assert(await handler({ input: '/list', rawCmd: '/LIST', cmd: '/LIST', context: {} }) === true, '/list should leave the room and open the chat lobby');
  assert(leaveRequest?.url === '/api/chat/rooms/7/leave', '/list should call the existing room leave endpoint');
  assert(lobbyShown === 1, '/list should render the chat lobby exactly once');
}

async function main() {
  verifyNormalizerParity();
  await verifyChatinFlow();
  await verifyQuickMemoFlow();
  await verifySosFlow();
  await verifyDirectPostReadFlow();
  await verifyCompactDateFlow();
  await verifyHistoricalLongForms();
  await verifyHistoricalChatListShortcut();
  console.log(JSON.stringify({
    ok: true,
    message: 'Command parity tests passed (PC communication integrated flow)'
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
