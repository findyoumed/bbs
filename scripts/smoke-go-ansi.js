/**
 * [LOG_ID: 20260828_1500] Regression checks for historical GO aliases,
 * keyboard-accessible hint tokens, and the common ANSI/CSI subset.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { assert } = require('./lib/scriptUtils');
const { loadBrowserHarnessModule } = require('./smoke/common-utils');

const coreDir = path.join(__dirname, '..', 'public/js/core');
const moduleCache = new Map();

function resolveReferencePath(relativePath) {
  const projectRoot = path.join(__dirname, '..');
  const candidates = [
    path.join(projectRoot, relativePath),
    path.join(projectRoot, 'docs', 'bbs', relativePath)
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`missing reference file: ${relativePath}`);
  }
  return match;
}
const { ansiToHTML } = loadBrowserHarnessModule(path.join(coreDir, 'ansiRenderUtils.js'), moduleCache);
const { createTerminalHintMarkup } = loadBrowserHarnessModule(path.join(coreDir, 'terminalHintMarkup.js'), moduleCache);
const { createMenuNavigationActions } = loadBrowserHarnessModule(path.join(coreDir, 'menuNavigationActions.js'), moduleCache);

function verifyAnsiCsiSubset() {
  assert(ansiToHTML('A\x1b[sB\x1b[uC').rows[0] === 'AC', 'CSI save/restore must overwrite at the saved cell');
  assert(ansiToHTML('AB\x1b[1D\x1b[1PC').rows[0] === 'AC', 'CSI cursor-left/delete-char must preserve cell order');
  assert(ansiToHTML('AB\x1b[1K').rows[0] === '', 'CSI erase-line must clear from the cursor');
  const positioned = ansiToHTML('\x1b[2;3HXY');
  assert(positioned.rows[1].slice(2, 4) === 'XY', 'CSI cursor-position must use one-based row/column coordinates');
  const inserted = ansiToHTML('AB\x1b[1D\x1b[1@C').rows[0];
  assert(inserted === 'ACB', 'CSI insert-char must shift existing cells to the right');
  assert(ansiToHTML('A\x1bZB').rows[0] === 'AB', 'unsupported ESC sequences must not leak control characters');
}

function verifyNurieNreSamples() {
  // Nurie .NRE files use an ASCII `@[` sentinel in place of ESC[. Convert only
  // that transport marker here; legacy Korean byte decoding and Nurie-specific
  // graphics extensions remain intentionally outside the web renderer scope.
  const supported = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'P', 'S', 'T', '@', 'd', 'f', 'm', 'r', 's', 'u']);
  for (const name of ['ANSI1.NRE', 'ANSI2.NRE', 'ANSI3.NRE', 'ANSI4.NRE']) {
    const raw = fs.readFileSync(resolveReferencePath(path.join('nurie', name)), 'latin1');
    const sentinelCount = (raw.match(/@\[/g) || []).length;
    assert(sentinelCount > 0, `${name} should contain Nurie @ [ transport sentinels`);
    const stream = raw.replace(/@\[/g, '\x1b[');
    const result = ansiToHTML(stream);
    assert(result.rowCount > 0 && result.rows.length === result.rowCount, `${name} should render rows after sentinel conversion`);
    const csiPattern = /\x1b\[([0-?]*)(?:[ -\/]*)([@-~])/g;
    let parsedCount = 0;
    let supportedCount = 0;
    let match;
    while ((match = csiPattern.exec(stream)) !== null) {
      parsedCount += 1;
      if (!/^[=>?]/.test(match[1]) && supported.has(match[2])) {
        supportedCount += 1;
      }
    }
    assert(parsedCount === sentinelCount, `${name} should parse every converted @ [ sentinel`);
    assert(supportedCount > 0, `${name} should exercise at least one supported CSI command`);
    assert(!result.html.includes('\x1b'), `${name} converted CSI should not leak ESC into HTML`);
  }
}

function verifyHistoricalMenuAliasSources() {
  const menuPath = resolveReferencePath(path.join('nurie', 'HITEL.MNU'));
  const menu = fs.readFileSync(menuPath, 'utf8');
  const menu15 = fs.readFileSync(resolveReferencePath(path.join('nurie15', 'HITEL.MNU')), 'utf8');
  const extractCodes = (source) => [...source.matchAll(/:([A-Za-z0-9_]+)\s*$/gm)]
    .map((match) => match[1].toLowerCase());
  const codes = extractCodes(menu);
  const codes15 = extractCodes(menu15);
  assert(codes.length === 660 && new Set(codes).size === 601,
    'nurie/HITEL.MNU should contain 660 valid GO entries and 601 unique codes');
  assert(codes15.length === codes.length && new Set(codes15).size === new Set(codes).size,
    'nurie15/HITEL.MNU should preserve the same valid GO code counts');
  for (const candidate of ['chatting', 'bluehs', 'rmail', 'wmail', 'cmail']) {
    assert(new RegExp(`:${candidate}\\s*$`, 'im').test(menu), `HITEL.MNU should retain the ${candidate} GO candidate`);
  }
  // The Nurie ANSI sample exposes the shared historical command footer
  // (including GO/HI/Z/X); it is a renderer fixture rather than a second
  // menu database, so only assert the transport text is present here.
  const ansi1 = fs.readFileSync(resolveReferencePath(path.join('nurie', 'ANSI1.NRE')), 'latin1');
  assert(/GO,HI,Z,X/i.test(ansi1), 'ANSI1.NRE should contain the historical GO footer hint');
}

async function verifyHistoricalGoAliases() {
  const calls = [];
  const state = { screen: 'main', menuTree: null, boards: [] };
  const refs = {
    showTojeong: async () => calls.push('tojeong'),
    showBiorhythm: async () => calls.push('bio'),
    showCompat: async () => calls.push('compat'),
    showFortune: async () => calls.push('fortune'),
    showPuzzle15: async () => calls.push('puzzle'),
    showMemoMenu: async () => calls.push('memo-menu'),
    showMemoList: async () => calls.push(`memo-list:${state._memoBox || 'unset'}`),
    showMemoWrite: async () => calls.push('memo-write'),
    showContactSysop: async () => calls.push('contact-sysop'),
    showChatLobby: async () => calls.push('chat-lobby'),
    showVoteList: async () => calls.push('vote-list'),
    showHelp: async () => calls.push('help'),
    showScramble: async () => calls.push('scramble'),
    showPostList: async (boardId) => calls.push(`post-list:${boardId}`)
  };
  state.menuTree = {
    type: 'menu', go: 'top', children: [
      { type: 'menu', go: 'guide', door: '1', name: 'GUIDE', children: [
        { type: 'help', go: 'help', door: '3', name: 'HELP' }
      ] },
      { type: 'menu', go: 'game', door: '9', name: 'GAME', children: [
        { type: 'scramble', go: 'scramble', door: '13', name: 'SCRAMBLE' }
      ] }
    ]
  };
  const nav = createMenuNavigationActions({
    cmdInput: null,
    getBoardKey: () => '',
    getBoardMenuPath: () => 'top',
    getMenuChildren: (node) => node?.children || [],
    getMenuNodeByKey: () => null,
    getMenuNodeKey: (node) => node?.go || node?.id || '',
    getMenuNodeTitle: (node) => node?.name || '',
    getMenuParentNode: () => null,
    getBoardSelectTitle: () => 'TOP',
    normalizeSearchKey: (value) => String(value || '').replace(/\s+/g, '').trim().toUpperCase(),
    refs,
    resolveAnyMenuNodeTarget: (target) => {
      const key = String(target).trim().toUpperCase();
      if (key === 'AGORA') return { type: 'menu', go: 'agora', id: 'agora', name: '여론광장 (AGORA)' };
      if (key === 'VOTE') return { type: 'vote', go: 'vote', id: 'vote', name: '투표/설문' };
      if (key === 'PLAZA') return { type: 'board', go: 'plaza', id: 'bbs_freetalk', name: '열린광장' };
      if (key === 'HUMOR') return { type: 'board', go: 'humor', id: 'bbs_humor', name: '우스개' };
      if (key === 'CHAT') return { type: 'chatt', go: 'chat', id: 'chat', name: '대화실' };
      if (key === 'TOSYSOP') return { type: 'contact-sysop', go: 'tosysop', id: 'tosysop', name: '건의하기' };
      return null;
    },
    resolveLocalMenuNodeTarget: () => null,
    resolveBoardTarget: () => null,
    resolveMenuNodeTarget: () => null,
    setHint: () => {},
    setPrompt: () => {},
    showBoardSelect: async (menuKey) => calls.push(`menu:${menuKey}`),
    showMain: async () => calls.push('main'),
    startOAuthLogin: async () => {},
    state
  });

  assert(await nav.executeGoCommand('go tojung') === true, 'GO TOJUNG must be handled');
  assert(await nav.executeGoCommand('Go   biorym') === true, 'GO BIORYM must accept case and repeated spaces');
  assert(await nav.executeGoCommand('GO GUNGHAP') === true, 'GO GUNGHAP must be handled');
  assert(await nav.executeGoCommand('GO TOJEONG') === true, 'canonical GO TOJEONG must remain handled');
  assert(await nav.executeGoCommand('go unse') === true, 'GO UNSE must resolve the verified historical fortune alias');
  assert(await nav.executeGoCommand('GO PUZZLE') === true, 'GO PUZZLE must resolve the verified historical 15-puzzle alias');
  assert(calls.join(',') === 'tojeong,bio,compat,tojeong,fortune,puzzle', 'historical aliases must resolve to their canonical screens');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO ME') === true, 'GO ME must open the received memo inbox');
  assert(calls.join(',') === 'memo-list:inbox' && state._memoBox === 'inbox', 'GO ME must match RMAIL inbox semantics');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO MEMO') === true, 'GO MEMO must open the received memo inbox');
  assert(calls.join(',') === 'memo-list:inbox', 'GO MEMO must match ME inbox semantics');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO MAIL') === true, 'GO MAIL must open the top-level mail menu');
  assert(calls.join(',') === 'memo-menu', 'GO MAIL must remain the top-level mail menu shortcut');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO CMAIL') === true, 'GO CMAIL must open the sent memo box');
  assert(calls.join(',') === 'memo-list:sent' && state._memoBox === 'sent', 'GO CMAIL must target sent memos');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO AGORA') === true, 'GO AGORA must open the top-level agora menu');
  assert(calls.join(',') === 'menu:agora', 'GO AGORA must target the AGORA menu container');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO VOTE') === true, 'GO VOTE must open the vote list');
  assert(calls.join(',') === 'vote-list', 'GO VOTE must target the nested vote feature');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO WORD') === true, 'Chollian GO WORD must resolve the existing PLAZA equivalent');
  assert(calls.join(',') === 'post-list:plaza', 'GO WORD must navigate to the current PLAZA board');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO 유머란') === true, 'Nownuri Korean GO humor alias must resolve');
  assert(calls.join(',') === 'post-list:humor', 'GO 유머란 must navigate to the current HUMOR board');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO HUMOR') === true, 'GO HUMOR must resolve the common humor target');
  assert(calls.join(',') === 'post-list:humor', 'GO HUMOR must navigate to the current HUMOR board');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO CHAT') === true, 'GO CHAT must resolve the common chat target');
  assert(calls.join(',') === 'chat-lobby', 'GO CHAT must navigate to the chat lobby');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO CHATIN') === true, 'Nownuri GO CHATIN must resolve the existing chat target');
  assert(calls.join(',') === 'chat-lobby', 'GO CHATIN must navigate to the chat lobby');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO CHATTING') === true, 'HITEL GO CHATTING must resolve the existing chat target');
  assert(calls.join(',') === 'chat-lobby', 'GO CHATTING must navigate to the chat lobby');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO BLUEHOUSE') === true, 'GO BLUEHOUSE must map to the existing sysop-contact screen');
  assert(calls.join(',') === 'contact-sysop', 'GO BLUEHOUSE must preserve the suggestion/inquiry intent');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO BLUEHS') === true, 'HITEL GO BLUEHS must map to the existing sysop-contact screen');
  assert(calls.join(',') === 'contact-sysop', 'GO BLUEHS must preserve the suggestion/inquiry intent');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO 1 3') === true, 'hierarchical GO with spaces must resolve menu doors');
  assert(calls.join(',') === 'help', 'GO 1 3 must target GUIDE/HELP instead of flat GO 13');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO 1.3') === true, 'hierarchical GO with a dot must resolve menu doors');
  assert(calls.join(',') === 'help', 'GO 1.3 must target GUIDE/HELP');
  calls.length = 0;
  assert(await nav.executeGoCommand('GO 9 13') === true, 'nested GAME GO path must resolve menu doors');
  assert(calls.join(',') === 'scramble', 'GO 9 13 must target GAME/SCRAMBLE');
  for (const unsupported of ['PGF', 'ANC', 'JUBU', 'BARUN', 'SUMMER', 'ELF', 'GMF', 'VG', 'SF', 'CHOLCD']) {
    assert(await nav.executeGoCommand(`GO ${unsupported}`) === false, `GO ${unsupported} must remain unresolved until an equivalent service exists`);
  }
  assert(await nav.executeGoCommand('GO NOT_A_REAL_TARGET') === false, 'unknown GO target must not navigate');
}

function verifyKeyboardHintTokens() {
  const markup = createTerminalHintMarkup({
    state: { screen: 'main', user: { isGuest: true } },
    esc: (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  });
  const token = markup.renderHintMarkup('{{GO|GO}}');
  assert(token.includes('role="button"'), 'hint command tokens must expose button semantics');
  assert(token.includes('tabindex="0"'), 'hint command tokens must be reachable with Tab');
  const roomTokens = markup.renderHintMarkup('번호/명령(/L:목록 /W:참여자 /Z:다시보기)');
  assert(roomTokens.includes('data-cmd="/L"'), 'slash-prefixed footer commands must retain /L');
  assert(roomTokens.includes('data-cmd="/W"'), 'slash-prefixed footer commands must retain /W');
  assert(roomTokens.includes('data-cmd="/Z"'), 'slash-prefixed footer commands must retain /Z');
}

function verifyInteractionContracts() {
  const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const hotspotSource = read('public/js/core/menuHotspotUtils.js');
  const eventsSource = read('public/js/core/appEvents.js');
  const feedbackSource = read('public/js/core/terminalFeedback.js');
  const contactSource = read('public/js/core/contactSysopScreen.js');
  const memoSource = read('public/js/core/memoScreens.js');
  const postWriteSource = read('public/js/core/postWriteView.js');
  const postListSource = read('public/js/core/postListView.js');
  const interactionSource = read('public/js/core/interactionHandlers.js');
  const shellSource = read('public/index.html');
  const navigationSource = read('public/js/core/menuNavigation.js');
  const routeRestorerSource = read('public/js/core/routingStateRestorer.js');
  const routeBuilderSource = read('public/js/core/routingUrlBuilder.js');

  assert(/createElement\(\s*['"]button['"]\)/.test(hotspotSource), 'menu hotspots must use native buttons');
  assert(/aria-label/.test(hotspotSource), 'menu hotspots must expose an accessible label');
  assert(/event\.key !== ['"]Enter['"][\s\S]*event\.key !== ['"] ['"]/.test(eventsSource), 'interactive tokens must handle Enter and Space');
  assert(/token\.click\(\)/.test(eventsSource), 'keyboard activation must invoke the same click action');
  assert(/terminal-error/.test(feedbackSource) && /tabIndex\s*=\s*0/.test(feedbackSource), 'interactive errors/toasts must use the dedicated error row');
  assert(/function onCmdKey\(e\)[\s\S]*e\.key === ['"]Escape['"][\s\S]*cancelContactSysop/.test(contactSource), 'contact editor command input must cancel on Escape after Tab focus');
  assert(/function onCmdKey\(e\)[\s\S]*e\.key === ['"]Escape['"][\s\S]*onCancel/.test(memoSource), 'memo editor command input must cancel on Escape after Tab focus');
  assert(/function onCmdKey\(e\)[\s\S]*e\.key === ['"]Escape['"][\s\S]*onCancel/.test(postWriteSource), 'post editor command input must cancel on Escape after Tab focus');
  assert(/dataset\.postBoardId/.test(postListSource), 'post hotspots must preserve the physical source board for merged lists');
  assert(/function executePostHotspot[\s\S]*showPostView\(sourceBoardId, value\)/.test(interactionSource), 'merged PDS hotspot clicks must open the physical source post');
  assert(/id="terminal-error"[\s\S]*id="cmd-hint"/.test(shellSource), 'error row must precede the hint row');
  assert(/\/api\/boards\/notice\?page=1&pageSize=1/.test(navigationSource), 'main menu must load the latest notice for the small-notice row');
  assert(/buildMainMenuAnsi\(state\.boardMenuTitle, menuEntries, stats, noticeText\)/.test(navigationSource), 'latest notice must be passed to the ANSI main-menu builder');
  assert(/if \(!sub\)[\s\S]*showBoardSelect\('agora'/.test(routeRestorerSource), 'direct /agora must restore the parent menu container');
  assert(/sub === ['"]vote['"][\s\S]*showVoteList/.test(routeRestorerSource), 'direct /agora/vote must restore the vote list');
  assert(/case ['"]vote-list['"][\s\S]*return ['"]\/agora\/vote['"]/.test(routeBuilderSource), 'vote-list URL must remain nested under /agora/vote');
}

(async () => {
  verifyAnsiCsiSubset();
  verifyNurieNreSamples();
  verifyHistoricalMenuAliasSources();
  await verifyHistoricalGoAliases();
  verifyKeyboardHintTokens();
  verifyInteractionContracts();
  console.log('GO alias, ANSI/CSI, keyboard token, and interaction contract smoke checks passed.');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
