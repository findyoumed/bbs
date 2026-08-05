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
}

async function verifyQuickMemoFlow() {
  const state = {
    screen: 'post-list',
    user: { userId: 'sender', isGuest: false }
  };
  let request = null;
  let hint = '';
  let prompt = '';
  const handler = createGlobalNavigationCommandHandler({
    state,
    apiFetch: async (url, options) => {
      request = { url, options };
      return { recipientAbsent: false };
    },
    executeGoCommand: async () => false,
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

async function main() {
  verifyNormalizerParity();
  await verifyQuickMemoFlow();
  await verifyDirectPostReadFlow();
  await verifyCompactDateFlow();
  console.log(JSON.stringify({
    ok: true,
    message: 'Command parity tests passed (PC communication integrated flow)'
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
