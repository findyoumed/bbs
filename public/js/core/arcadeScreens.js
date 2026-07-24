import {
  OMOK_SIZE, createOmokState, omokCheckWin, omokBestMove,
  OTH_SIZE, createOthelloState, othelloFlipsFor, othelloLegalMoves, othelloApply, othelloBestMove, othelloCount,
  BASEBALL_MAX_TRIES, createBaseballState, baseballJudge,
  createHangmanState, hangmanApply,
  createPuzzle15State, puzzle15Apply,
  createScrambleState, scrambleApply,
  createWpState, wpApply,
  createTypingState, typingApply,
  createQuizState, quizApply,
  createBattleState, battleApply
} from './arcadeGameLogic.js';
import { createServiceUiUtils } from './serviceUiUtils.js';

// [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" 재현 — 오락실 게임 5종 화면.
// 기존 오락실(바이오리듬 등)과 동일한 턴제 텍스트 입력 구조: state.screen 세팅 후
// commandRouterService 의 분기가 입력을 이 모듈의 move 함수로 넘긴다. 게임 진행 상태는
// state.serviceData 에만 있고 URL 로 복원하지 않는다(새로고침 = 새 게임, blood/compat 과 동일).
export function createArcadeScreens(deps) {
  const {
    buildOmokAnsi, buildOthelloAnsi, buildBaseballAnsi, buildHangmanAnsi, buildPuzzle15Ansi,
    buildScrambleAnsi, buildWpAnsi, buildTypingAnsi, buildQuizAnsi, buildBattleAnsi,
    render, setHint, state, updateURL, cmdInput, displayWidth,
    mountPromptRow, restorePromptRow, screenEl
  } = deps;

  const sd = (kind) => (state.serviceData?.kind === kind ? state.serviceData : null);
  // [LOG_ID: 20260723_1102] 아케이드 게임 공통 — footer를 항상 'none'으로 강제하고 렌더 후 인라인 마운트.
  // 기존의 개별 footer 인자('arcadePlay', 'hangmanPlay')를 무시하고, 모든 아케이드 게임이 힌트바 없이
  // 본문 안에 프롬프트를 마운트하도록 한다.
  // [LOG: 20260724_1019] 게임 진행 중(play)에만 footer를 숨기고 인라인 마운트, 게임이 종료되면 하단 힌트바(footer) 복원 및 프롬프트 '선택 >>' 강제 적용
  async function arcadeRender(ansi, _footer, prompt) {
    const isPlaying = state.serviceData?.status === 'play';
    const footerToUse = isPlaying ? 'none' : (_footer || 'amusementView');
    const promptToUse = isPlaying ? prompt : '선택 >> ';
    
    if (!isPlaying && typeof restorePromptRow === 'function') {
      restorePromptRow();
    }
    
    const rendered = await render(ansi, footerToUse, promptToUse);
    if (isPlaying && screenEl && typeof mountPromptRow === 'function') {
      const kind = state.serviceData?.kind || 'arcade';
      const hostId = `${kind}-prompt-host`;
      let host = document.getElementById(hostId);
      if (!host) { host = document.createElement('div'); host.id = hostId; host.className = 'game-prompt-host'; screenEl.appendChild(host); }
      mountPromptRow(host);
    }
    return rendered;
  }

  // [LOG_ID: 20260720_1600] 오목판 마우스 클릭 지원 — retro-art 목록과 동일한 핫스팟 패턴
  // (createHotspotLayer/createHotspotButton, appEvents.js 의 [data-cmd] 전역 클릭 위임을 그대로 탄다).
  const { createHotspotLayer, createHotspotButton, measureLineSegmentBounds } = createServiceUiUtils({ displayWidth });

  // buildOmokAnsi 의 행 텍스트 포맷("  " + 2칸 행번호 + " " + 셀당 2글자)과 결합돼 있다 —
  // 포맷을 바꾸면 이 프리픽스(5)/셀폭(2)도 같이 바꿔야 한다.
  const OMOK_ROW_PREFIX = 5, OMOK_CELL_WIDTH = 2;
  function renderOmokBoardHotspots(screenNode, game) {
    if (!screenNode || game.status !== 'play') return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const rowLines = lineNodes.filter((node) => /^\s*(1[0-5]|[1-9])\s/.test(node.textContent || '')).slice(0, OMOK_SIZE);
    if (rowLines.length !== OMOK_SIZE) return;
    const layer = createHotspotLayer();
    rowLines.forEach((lineNode, y) => {
      for (let x = 0; x < OMOK_SIZE; x++) {
        if (game.board[y * OMOK_SIZE + x] !== 0) continue;
        const start = OMOK_ROW_PREFIX + x * OMOK_CELL_WIDTH;
        const bounds = measureLineSegmentBounds(screenNode, lineNode, start, start + OMOK_CELL_WIDTH);
        if (!bounds) continue;
        const coord = `${String.fromCharCode(65 + x)}${y + 1}`;
        layer.appendChild(createHotspotButton(coord, `${coord}에 착수`, bounds));
      }
    });
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }
  async function renderOmok(game, footer, prompt) {
    const rendered = await arcadeRender(buildOmokAnsi(game), footer, prompt);
    if (rendered && rendered.screenNode) renderOmokBoardHotspots(rendered.screenNode, game);
  }

  // [LOG_ID: 20260720_1600] 오목판 키보드(방향키+Enter) 조작.
  // [LOG_ID: 20260720_1700] cmdInput 자체에 붙였더니 "입력창에 포커스가 있을 때만" 작동했다 —
  // 마우스로 돌을 클릭하면 그 <button>으로 포커스가 옮겨가고(브라우저 기본 동작), 터치/하이브리드
  // 입력 기기는 자동 포커스(hover:hover 미디어쿼리)가 아예 안 걸릴 수도 있어 방향키가 먹통이었다
  // (사용자 실측 지적: "방향키+엔터로 뭐가 된다는거야? 별로 그렇게 작동을 안하는데"). window 캡처
  // 단계에서 가로채면 포커스 위치와 무관하게 항상 작동한다 — terminalSequentialRenderer.js 의
  // skipHandler(window.addEventListener('keydown', ..., {capture:true}))와 동일한 확립된 패턴.
  // [LOG_ID: 20260720_1630] 입력창이 비어 있을 때만 가로챈다 — 그렇지 않으면 "D4"/"L" 같은
  // 좌표·명령을 타이핑하고 누른 Enter까지 커서 착수로 먹혀버려 입력이 아예 전송되지 않는
  // 버그가 있었다(실측: 타이핑 후 Enter가 텍스트를 무시하고 커서 위치에 착수). 빈 입력에서만
  // 방향키/Enter가 보드 커서를 조작하고, 한 글자라도 타이핑을 시작하면 원래의 텍스트 입력·
  // 이력탐색·제출 동작으로 돌아간다.
  // [LOG_ID: 20260720_1800] 사용자의 오목 방향키+Enter 착수 조작 제외 요청에 따라 window keydown 가로채기 리스너 영구 삭제

  // ── 오목 ──
  // [LOG_ID: 20260720_1700] 오목판 키보드/마우스 입력은 표준 명령 파이프라인(commandExecutionState의
  // beginCommandExecution/isCommandExecutionLocked)을 거치지 않고 omokMove를 직접 부른다. 이전 수의
  // 렌더(renderAnsiScreenWithTopbarSequential의 타이핑 애니메이션)가 아직 끝나기 전에 다음 입력이
  // 들어오면(마우스 클릭 직후 곧바로 방향키+Enter 등) omokMove 호출이 겹쳐서 실행돼 한 번의 조작으로
  // 두 수가 놓이는 경쟁 상태가 있었다(Playwright 실측으로 발견 — Enter 한 번에 4수가 진행됨).
  // 자체 락으로 겹침을 막는다: 진행 중인 omokMove가 끝날 때까지 새 호출은 조용히 무시한다.
  let omokMoveLock = false;
  async function showOmok(fromHistory = false) {
    state.screen = 'omok-play';
    state.serviceData = { kind: 'omok', ...createOmokState(), cursor: { x: 7, y: 7 }, hintMsg: '' };
    if (!fromHistory) updateURL();
    const game = state.serviceData;
    const isPlay = game.status === 'play';
    const footerType = isPlay ? 'arcadePlay' : 'amusementView';
    const promptText = isPlay ? '좌표 입력, 클릭 (예: H8) >> ' : '선택 >> ';
    await renderOmok(game, footerType, promptText);
  }
  async function omokMove(colLetter, row) {
    if (omokMoveLock) return true;
    const game = sd('omok');
    if (!game) { await showOmok(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    game.hintMsg = '';
    const x = colLetter.toUpperCase().charCodeAt(0) - 65;
    const y = row - 1;
    if (game.board[y * OMOK_SIZE + x] !== 0) { game.hintMsg = '이미 돌이 있는 자리입니다.'; await renderOmok(game, 'arcadePlay', '좌표 입력, 클릭 (예: H8) >> '); return true; }
    omokMoveLock = true;
    try {
      game.board[y * OMOK_SIZE + x] = 1;
      const isWin = omokCheckWin(game.board, x, y);
      game.cursor = { x, y };
      game.moves++;
      game.last = { x, y };
      if (isWin) game.status = 'win';
      else if (game.board.every((v) => v !== 0)) game.status = 'draw';
      else {
        const cpu = omokBestMove(game.board);
        game.board[cpu.y * OMOK_SIZE + cpu.x] = 2;
        game.moves++;
        game.lastCpu = cpu;
        if (omokCheckWin(game.board, cpu.x, cpu.y)) game.status = 'lose';
        else if (game.board.every((v) => v !== 0)) game.status = 'draw';
      }
      const isPlay = game.status === 'play';
      const footerType = isPlay ? 'arcadePlay' : 'amusementView';
      const promptText = isPlay ? '좌표 입력, 클릭 (예: H8) >> ' : '선택 >> ';
      await renderOmok(game, footerType, promptText);
      return true;
    } finally {
      omokMoveLock = false;
    }
  }
  // [LOG_ID: 20260720_1600] 천리안 원전 그림179 "/Q : 게임포기" 재현.
  async function omokResign() {
    const game = sd('omok');
    if (!game) { await showOmok(); return true; }
    if (game.status === 'play') game.status = 'resigned';
    const isPlay = game.status === 'play';
    const footerType = isPlay ? 'arcadePlay' : 'amusementView';
    const promptText = isPlay ? '좌표 입력, 클릭 (예: H8) >> ' : '선택 >> ';
    await renderOmok(game, footerType, promptText);
    return true;
  }

  // [LOG: 20260723_1715] 오델로 핫스팟 및 마우스 조작 추가
  const OTH_ROW_PREFIX = 5, OTH_CELL_WIDTH = 2;
  function renderOthelloBoardHotspots(screenNode, game) {
    if (!screenNode || game.status !== 'play') return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const rowLines = lineNodes.filter((node) => /^\s*([1-8])\s/.test(node.textContent || '')).slice(0, OTH_SIZE);
    if (rowLines.length !== OTH_SIZE) return;
    
    const layer = createHotspotLayer();
    const legalMoves = othelloLegalMoves(game.board, 1);
    const legalSet = new Set(legalMoves.map((m) => m.idx));
    
    rowLines.forEach((lineNode, y) => {
      for (let x = 0; x < OTH_SIZE; x++) {
        const idx = y * OTH_SIZE + x;
        if (!legalSet.has(idx)) continue;
        
        const start = OTH_ROW_PREFIX + x * OTH_CELL_WIDTH;
        const bounds = measureLineSegmentBounds(screenNode, lineNode, start, start + OTH_CELL_WIDTH);
        if (!bounds) continue;
        const coord = `${String.fromCharCode(65 + x)}${y + 1}`;
        layer.appendChild(createHotspotButton(coord, `${coord}에 착수`, bounds));
      }
    });
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }
  async function renderOthello(game, footer, prompt) {
    const rendered = await arcadeRender(buildOthelloAnsi(game), footer, prompt);
    if (rendered && rendered.screenNode) renderOthelloBoardHotspots(rendered.screenNode, game);
  }

  // ── 오델로 ──
  let othelloMoveLock = false;
  async function showOthello(fromHistory = false) {
    state.screen = 'oth-play';
    state.serviceData = { kind: 'oth', ...createOthelloState(), hintMsg: '' };
    if (!fromHistory) updateURL();
    await renderOthello(state.serviceData, 'arcadePlay', '좌표 입력 (예: C4) >> ');
  }
  function othelloFinish(game) {
    const { black, white } = othelloCount(game.board);
    game.status = black > white ? 'win' : black < white ? 'lose' : 'draw';
  }
  async function othelloMove(colLetter, row) {
    if (othelloMoveLock) return true;
    const game = sd('oth');
    if (!game) { await showOthello(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    game.hintMsg = '';
    const idx = (row - 1) * OTH_SIZE + (colLetter.toUpperCase().charCodeAt(0) - 65);
    const flips = othelloFlipsFor(game.board, idx, 1);
    if (!flips.length) { game.hintMsg = '그 자리에는 둘 수 없습니다. + 표시된 자리에 두세요.'; await renderOthello(game, 'arcadePlay', '좌표 입력 (예: C4) >> '); return true; }
    othelloMoveLock = true;
    try {
      othelloApply(game.board, idx, 1, flips);
      game.passMsg = '';
      // 컴퓨터 응수 — 사용자가 둘 곳이 생길 때까지(패스 처리), 양쪽 모두 없으면 종국.
      while (game.status === 'play') {
        const cpuMove = othelloBestMove(game.board);
        if (cpuMove) { othelloApply(game.board, cpuMove.idx, 2, cpuMove.flips); game.lastCpu = cpuMove.idx; }
        if (othelloLegalMoves(game.board, 1).length) break;
        if (!othelloLegalMoves(game.board, 2).length) { othelloFinish(game); break; }
        game.passMsg = '귀하가 둘 곳이 없어 한 수 쉽니다. 컴퓨터가 계속 둡니다.';
      }
      await renderOthello(game, 'arcadePlay', '좌표 입력 (예: C4) >> ');
      return true;
    } finally {
      othelloMoveLock = false;
    }
  }

  // ── 숫자야구 ──
  async function showBaseball(fromHistory = false) {
    state.screen = 'base-play';
    state.serviceData = { kind: 'base', ...createBaseballState() };
    if (!fromHistory) updateURL();
    await arcadeRender(buildBaseballAnsi(state.serviceData), 'arcadePlay', '숫자 3자리 입력 (예: 123) >> ');
  }
  async function baseballGuess(guess) {
    const game = sd('base');
    if (!game) { await showBaseball(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    const digits = String(guess).trim();
    if (new Set(digits).size !== 3) { setHint('서로 다른 숫자 3자리를 입력하세요.'); return true; }
    const { strike, ball } = baseballJudge(game.answer, digits);
    game.tries.push({ guess: digits, strike, ball });
    if (strike === 3) game.status = 'win';
    else if (game.tries.length >= BASEBALL_MAX_TRIES) game.status = 'lose';
    await arcadeRender(buildBaseballAnsi(game), 'arcadePlay', '숫자 3자리 입력 (예: 123) >> ');
    return true;
  }

  // ── 영어단어 맞추기 ──
  async function showHangman(fromHistory = false) {
    state.screen = 'hangman-play';
    state.serviceData = { kind: 'hangman', ...createHangmanState(), hintMsg: '' };
    if (!fromHistory) updateURL();
    await arcadeRender(buildHangmanAnsi(state.serviceData), 'hangmanPlay', '알파벳 입력 >> ');
  }
  async function hangmanGuess(letter) {
    const game = sd('hangman');
    if (!game) { await showHangman(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 단어가 나옵니다.'); return true; }
    game.hintMsg = '';
    if (hangmanApply(game, letter) === 'already') { game.hintMsg = '** 이미 선택하신 알파벳입니다 **'; const footer = game.status === 'play' ? 'hangmanPlay' : 'arcadePlay'; await arcadeRender(buildHangmanAnsi(game), footer, '알파벳 입력 >> '); return true; }
    const footer = game.status === 'play' ? 'hangmanPlay' : 'arcadePlay';
    await arcadeRender(buildHangmanAnsi(game), footer, '알파벳 입력 >> ');
    return true;
  }
  async function hangmanResign() {
    const game = sd('hangman');
    if (!game) { await showHangman(); return true; }
    if (game.status === 'play') game.status = 'lose';
    await arcadeRender(buildHangmanAnsi(game), 'arcadePlay', '알파벳 입력 >> ');
    return true;
  }

  // [LOG: 20260723_1752] 15퍼즐 마우스 조작 핫스팟 레이어 추가
  const PUZZLE15_ROW_PREFIX = 3, PUZZLE15_CELL_WIDTH = 5;
  function renderPuzzle15BoardHotspots(screenNode, game) {
    if (!screenNode || game.status !== 'play') return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const rowLines = lineNodes.filter((node) => {
      const text = node.textContent || '';
      return text.includes('|') && !text.includes('+');
    }).slice(0, 4);
    if (rowLines.length !== 4) return;
    
    const blankIdx = game.tiles.indexOf(0);
    const blankX = blankIdx % 4;
    const blankY = Math.floor(blankIdx / 4);
    
    const layer = createHotspotLayer();
    rowLines.forEach((lineNode, y) => {
      for (let x = 0; x < 4; x++) {
        const idx = y * 4 + x;
        const v = game.tiles[idx];
        if (v === 0) continue;
        
        const isNeighbor = (Math.abs(x - blankX) + Math.abs(y - blankY)) === 1;
        if (!isNeighbor) continue;
        
        const start = PUZZLE15_ROW_PREFIX + x * PUZZLE15_CELL_WIDTH;
        const bounds = measureLineSegmentBounds(screenNode, lineNode, start, start + 4);
        if (!bounds) continue;
        
        layer.appendChild(createHotspotButton(String(v), `${v}번 타일 이동`, bounds));
      }
    });
    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }
  async function renderPuzzle15(game, footer, prompt) {
    const rendered = await arcadeRender(buildPuzzle15Ansi(game), footer, prompt);
    if (rendered && rendered.screenNode) renderPuzzle15BoardHotspots(rendered.screenNode, game);
  }

  // ── 숫자판 맞추기 ──
  async function showPuzzle15(fromHistory = false) {
    state.screen = 'puzzle15-play';
    state.serviceData = { kind: 'puzzle15', ...createPuzzle15State(), hintMsg: '' };
    if (!fromHistory) updateURL();
    await renderPuzzle15(state.serviceData, 'arcadePlay', '옮길 숫자 입력 (1~15) >> ');
  }
  async function puzzle15Move(num) {
    const game = sd('puzzle15');
    if (!game) { await showPuzzle15(); return true; }
    if (game.status !== 'play') { setHint('완성했습니다. L을 누르면 새 판이 나옵니다.'); return true; }
    game.hintMsg = '';
    if (!puzzle15Apply(game, num)) { game.hintMsg = '빈칸과 붙어 있는 숫자만 옮길 수 있습니다.'; const promptText = game.status === 'play' ? '옮길 숫자 입력 (1~15) >> ' : '선택 >> '; await renderPuzzle15(game, 'arcadePlay', promptText); return true; }
    const promptText = game.status === 'play' ? '옮길 숫자 입력 (1~15) >> ' : '선택 >> ';
    await renderPuzzle15(game, 'arcadePlay', promptText);
    return true;
  }

  // ── 스크램블 ──
  async function showScramble(fromHistory = false) {
    state.screen = 'scramble-play';
    state.serviceData = { kind: 'scramble', ...createScrambleState(), hintMsg: '' };
    if (!fromHistory) updateURL();
    await arcadeRender(buildScrambleAnsi(state.serviceData), 'arcadePlay', '단어 입력 >> ');
  }
  async function scrambleGuess(word) {
    const game = sd('scramble');
    if (!game) { await showScramble(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    
    game.hintMsg = '';
    const res = scrambleApply(game, word);
    if (res === 'end') {
      await arcadeRender(buildScrambleAnsi(game), 'arcadePlay', '단어 입력 >> ');
      return true;
    }
    if (res === 'already') { game.hintMsg = '이미 찾은 단어입니다.'; }
    if (res === 'invalid') { game.hintMsg = '유효하지 않은 단어이거나 글자판에 없는 단어입니다.'; }
    
    await arcadeRender(buildScrambleAnsi(game), 'arcadePlay', '단어 입력 >> ');
    return true;
  }

  // ── 영어단어/숙어 학습게임 (WP) ──
  async function showWp(fromHistory = false) {
    state.screen = 'wp-play';
    state.serviceData = { kind: 'wp', ...createWpState() };
    if (!fromHistory) updateURL();
    await arcadeRender(buildWpAnsi(state.serviceData), 'arcadePlay', '정답 단어 입력 >> ');
  }
  async function wpGuess(guess) {
    const game = sd('wp');
    if (!game) { await showWp(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    
    const res = wpApply(game, guess);
    if (res === 'correct') {
      setHint('정답입니다!');
    } else if (res === 'incorrect') {
      setHint('틀렸습니다! 다시 시도하세요.');
    } else if (res === 'incorrect-next') {
      setHint('기회를 모두 잃었습니다. 다음 문제로 넘어갑니다.');
    }
    
    await arcadeRender(buildWpAnsi(game), 'arcadePlay', '정답 단어 입력 >> ');
    return true;
  }

  // ── 타자 연습/게임 ──
  async function showTyping(fromHistory = false) {
    state.screen = 'typing-play';
    state.serviceData = { kind: 'typing', ...createTypingState() };
    if (!fromHistory) updateURL();
    await arcadeRender(buildTypingAnsi(state.serviceData), 'arcadePlay', '문장 입력 >> ');
  }
  async function typingGuess(input) {
    const game = sd('typing');
    if (!game) { await showTyping(); return true; }
    if (game.status !== 'play') { setHint('연습이 끝났습니다. L을 누르면 새 연습을 시작합니다.'); return true; }
    
    const res = typingApply(game, input);
    if (res) {
      setHint(`결과: ${res.cpm} CPM / 정확도 ${res.accuracy}%`);
    }
    
    await arcadeRender(buildTypingAnsi(game), 'arcadePlay', '문장 입력 >> ');
    return true;
  }

  // ── 퀴즈박사 ──
  async function showQuiz(fromHistory = false) {
    state.screen = 'quiz-play';
    state.serviceData = { kind: 'quiz', ...createQuizState() };
    if (!fromHistory) updateURL();
    await arcadeRender(buildQuizAnsi(state.serviceData), 'arcadePlay', '답 입력 (1~4) >> ');
  }
  async function quizGuess(ans) {
    const game = sd('quiz');
    if (!game) { await showQuiz(); return true; }
    if (game.status !== 'play') { setHint('퀴즈가 완료되었습니다. L을 누르면 새 퀴즈를 시작합니다.'); return true; }
    
    const isCorrect = quizApply(game, ans);
    setHint(isCorrect ? '정답입니다!' : '오답입니다!');
    
    await arcadeRender(buildQuizAnsi(game), 'arcadePlay', '답 입력 (1~4) >> ');
    return true;
  }

  // ── 전투 게임 ──
  async function showBattle(fromHistory = false) {
    state.screen = 'battle-play';
    state.serviceData = { kind: 'battle', ...createBattleState() };
    if (!fromHistory) updateURL();
    await arcadeRender(buildBattleAnsi(state.serviceData), 'arcadePlay', '공격 좌표 입력 (예: G3) >> ');
  }
  async function battleMove(coord) {
    const game = sd('battle');
    if (!game) { await showBattle(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    
    const cleaned = String(coord).trim().toUpperCase();
    if (!/^[A-J](10|[1-9])$/.test(cleaned)) {
      setHint('올바른 격자 좌표를 입력하세요. (A~J + 1~10, 예: G3)');
      return true;
    }
    
    const y = cleaned.charCodeAt(0) - 65;
    const x = parseInt(cleaned.slice(1), 10) - 1;
    
    const res = battleApply(game, x, y);
    if (res === 'already') {
      setHint('이미 공격한 좌표입니다. 다른 곳을 공격하세요.');
      return true;
    }
    
    if (res === 'hit') {
      setHint('적 함선에 명중했습니다!');
    } else if (res === 'miss') {
      setHint('빗나갔습니다.');
    }
    
    await arcadeRender(buildBattleAnsi(game), 'arcadePlay', '공격 좌표 입력 (예: G3) >> ');
    return true;
  }
  async function battleResign() {
    const game = sd('battle');
    if (!game) { await showBattle(); return true; }
    if (game.status === 'play') game.status = 'lose';
    await arcadeRender(buildBattleAnsi(game), 'arcadePlay', '공격 좌표 입력 (예: G3) >> ');
    return true;
  }

  return {
    showOmok, omokMove, omokResign,
    showOthello, othelloMove,
    showBaseball, baseballGuess,
    showHangman, hangmanGuess, hangmanResign,
    showPuzzle15, puzzle15Move,
    showScramble, scrambleGuess,
    showWp, wpGuess,
    showTyping, typingGuess,
    showQuiz, quizGuess,
    showBattle, battleMove, battleResign
  };
}
