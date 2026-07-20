import {
  OMOK_SIZE, createOmokState, omokCheckWin, omokBestMove,
  OTH_SIZE, createOthelloState, othelloFlipsFor, othelloLegalMoves, othelloApply, othelloBestMove, othelloCount,
  BASEBALL_MAX_TRIES, createBaseballState, baseballJudge,
  createHangmanState, hangmanApply,
  createPuzzle15State, puzzle15Apply
} from './arcadeGameLogic.js';
import { createServiceUiUtils } from './serviceUiUtils.js';

// [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" 재현 — 오락실 게임 5종 화면.
// 기존 오락실(바이오리듬 등)과 동일한 턴제 텍스트 입력 구조: state.screen 세팅 후
// commandRouterService 의 분기가 입력을 이 모듈의 move 함수로 넘긴다. 게임 진행 상태는
// state.serviceData 에만 있고 URL 로 복원하지 않는다(새로고침 = 새 게임, blood/compat 과 동일).
export function createArcadeScreens(deps) {
  const {
    buildOmokAnsi, buildOthelloAnsi, buildBaseballAnsi, buildHangmanAnsi, buildPuzzle15Ansi,
    render, setHint, state, updateURL, cmdInput, displayWidth
  } = deps;

  const sd = (kind) => (state.serviceData?.kind === kind ? state.serviceData : null);

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
    const rendered = await render(buildOmokAnsi(game), footer, prompt);
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
  if (cmdInput) {
    window.addEventListener('keydown', (event) => {
      if (state.screen !== 'omok-play' || cmdInput.value.length > 0) return;
      const game = sd('omok');
      if (!game || game.status !== 'play') return;
      const key = event.key;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!game.cursor) game.cursor = { x: game.last ? game.last.x : 7, y: game.last ? game.last.y : 7 };
      if (key === 'ArrowUp') game.cursor.y = Math.max(0, game.cursor.y - 1);
      else if (key === 'ArrowDown') game.cursor.y = Math.min(OMOK_SIZE - 1, game.cursor.y + 1);
      else if (key === 'ArrowLeft') game.cursor.x = Math.max(0, game.cursor.x - 1);
      else if (key === 'ArrowRight') game.cursor.x = Math.min(OMOK_SIZE - 1, game.cursor.x + 1);
      else {
        const colLetter = String.fromCharCode(65 + game.cursor.x);
        omokMove(colLetter, game.cursor.y + 1);
        return;
      }
      renderOmok(game, 'arcadePlay', '좌표 입력, 방향키+Enter, 클릭 (예: H8) >> ');
    }, true);
  }

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
    state.serviceData = { kind: 'omok', ...createOmokState(), cursor: { x: 7, y: 7 } };
    if (!fromHistory) updateURL();
    await renderOmok(state.serviceData, 'arcadePlay', '좌표 입력, 방향키+Enter, 클릭 (예: H8) >> ');
  }
  async function omokMove(colLetter, row) {
    if (omokMoveLock) return true;
    const game = sd('omok');
    if (!game) { await showOmok(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    const x = colLetter.toUpperCase().charCodeAt(0) - 65;
    const y = row - 1;
    if (game.board[y * OMOK_SIZE + x] !== 0) { setHint('이미 돌이 있는 자리입니다.'); return true; }
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
      await renderOmok(game, 'arcadePlay', '좌표 입력, 방향키+Enter, 클릭 (예: H8) >> ');
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
    await renderOmok(game, 'arcadePlay', '좌표 입력, 방향키+Enter, 클릭 (예: H8) >> ');
    return true;
  }

  // ── 오델로 ──
  async function showOthello(fromHistory = false) {
    state.screen = 'oth-play';
    state.serviceData = { kind: 'oth', ...createOthelloState() };
    if (!fromHistory) updateURL();
    await render(buildOthelloAnsi(state.serviceData), 'arcadePlay', '좌표 입력 (예: C4) >> ');
  }
  function othelloFinish(game) {
    const { black, white } = othelloCount(game.board);
    game.status = black > white ? 'win' : black < white ? 'lose' : 'draw';
  }
  async function othelloMove(colLetter, row) {
    const game = sd('oth');
    if (!game) { await showOthello(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 게임을 시작합니다.'); return true; }
    const idx = (row - 1) * OTH_SIZE + (colLetter.toUpperCase().charCodeAt(0) - 65);
    const flips = othelloFlipsFor(game.board, idx, 1);
    if (!flips.length) { setHint('그 자리에는 둘 수 없습니다. + 표시된 자리에 두세요.'); return true; }
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
    await render(buildOthelloAnsi(game), 'arcadePlay', '좌표 입력 (예: C4) >> ');
    return true;
  }

  // ── 숫자야구 ──
  async function showBaseball(fromHistory = false) {
    state.screen = 'base-play';
    state.serviceData = { kind: 'base', ...createBaseballState() };
    if (!fromHistory) updateURL();
    await render(buildBaseballAnsi(state.serviceData), 'arcadePlay', '숫자 3자리 입력 (예: 123) >> ');
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
    await render(buildBaseballAnsi(game), 'arcadePlay', '숫자 3자리 입력 (예: 123) >> ');
    return true;
  }

  // ── 영어단어 맞추기 ──
  async function showHangman(fromHistory = false) {
    state.screen = 'hangman-play';
    state.serviceData = { kind: 'hangman', ...createHangmanState() };
    if (!fromHistory) updateURL();
    await render(buildHangmanAnsi(state.serviceData), 'hangmanPlay', '알파벳 입력 >> ');
  }
  async function hangmanGuess(letter) {
    const game = sd('hangman');
    if (!game) { await showHangman(); return true; }
    if (game.status !== 'play') { setHint('게임이 끝났습니다. L을 누르면 새 단어가 나옵니다.'); return true; }
    if (hangmanApply(game, letter) === 'already') { setHint('** 이미 선택하신 알파벳입니다 **'); return true; }
    const footer = game.status === 'play' ? 'hangmanPlay' : 'arcadePlay';
    await render(buildHangmanAnsi(game), footer, '알파벳 입력 >> ');
    return true;
  }
  async function hangmanResign() {
    const game = sd('hangman');
    if (!game) { await showHangman(); return true; }
    if (game.status === 'play') game.status = 'lose';
    await render(buildHangmanAnsi(game), 'arcadePlay', '알파벳 입력 >> ');
    return true;
  }

  // ── 숫자판 맞추기 ──
  async function showPuzzle15(fromHistory = false) {
    state.screen = 'puzzle15-play';
    state.serviceData = { kind: 'puzzle15', ...createPuzzle15State() };
    if (!fromHistory) updateURL();
    await render(buildPuzzle15Ansi(state.serviceData), 'arcadePlay', '옮길 숫자 입력 (1~15) >> ');
  }
  async function puzzle15Move(num) {
    const game = sd('puzzle15');
    if (!game) { await showPuzzle15(); return true; }
    if (game.status !== 'play') { setHint('완성했습니다. L을 누르면 새 판이 나옵니다.'); return true; }
    if (!puzzle15Apply(game, num)) { setHint('빈칸과 붙어 있는 숫자만 옮길 수 있습니다.'); return true; }
    await render(buildPuzzle15Ansi(game), 'arcadePlay', '옮길 숫자 입력 (1~15) >> ');
    return true;
  }

  return {
    showOmok, omokMove, omokResign,
    showOthello, othelloMove,
    showBaseball, baseballGuess,
    showHangman, hangmanGuess, hangmanResign,
    showPuzzle15, puzzle15Move
  };
}
