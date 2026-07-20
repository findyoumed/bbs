import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import {
  OMOK_SIZE, OTH_SIZE,
  othelloLegalMoves, othelloCount,
  BASEBALL_MAX_TRIES, hangmanMasked
} from './arcadeGameLogic.js';

// [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" — 오락실 게임 5종 ANSI 빌더.
// 이 폰트에서 ●/○/·/박스문자(U+2500대)는 전부 반각(1칸)이다(ansiRenderUtils.isWideChar 참고).
// 반상 셀은 "돌+공백"으로 표시폭 2를 고정해 우측 정보 패널과의 정렬을 보장한다.
export function createArcadeAnsiBuilders(deps) {
  const { ANSI_BOLD, ANSI_RESET, ansiColor, buildTopHeader, fitCell } = createAnsiBuilderUtils(deps);
  const c = (tone, text) => `${ansiColor(tone)}${text}${ANSI_RESET}`;
  // [LOG_ID: 20260720_1600] 천리안 원전 그림179/181("TIME&SPACE님이 (I 8) 에 놓았습니다.")
  // 표기를 그대로 재현 — 괄호와 공백 포함.
  const coordText = (x, y) => `(${String.fromCharCode(65 + x)} ${y + 1})`;

  // ── 오목 ──
  function buildOmokAnsi(st) {
    const colLabels = '     ' + Array.from({ length: OMOK_SIZE }, (_, i) => String.fromCharCode(65 + i)).join(' ');
    const lastCpuIdx = st.lastCpu ? st.lastCpu.y * OMOK_SIZE + st.lastCpu.x : -1;
    const cursorIdx = st.cursor && st.status === 'play' ? st.cursor.y * OMOK_SIZE + st.cursor.x : -1;
    const panel = {
      1: c(15, '귀하: ● (흑)  컴퓨터: ○ (백)'),
      3: c(8, `진행: ${st.moves}수`),
      5: st.lastCpu ? c(11, `컴퓨터 착수: ${coordText(st.lastCpu.x, st.lastCpu.y)}`) : '',
      7: c(8, '입력 예) H8'),
      8: c(8, '방향키 이동, Enter 착수, 클릭 가능'),
      9: c(8, 'L: 새 게임'),
      // [LOG_ID: 20260720_1600] 천리안 원전 그림179 우측 패널("/Q : 게임포기") 재현.
      10: c(8, 'Q: 게임포기')
      // [LOG_ID: 20260720_1800] 33/44 금수 규칙 제거(자유오목) — 사용자 판단: 컴퓨터에는
      // 적용 안 되면서 흑에게만 33이 걸리는 게 오히려 불공평했고, 44는 아예 안 막혀서
      // 컴퓨터가 이중 열린4로 이기는 사례가 나왔다. 반쪽 규칙 대신 순수 5목으로 되돌린다.
    };
    // [LOG_ID: 20260720_1500] 점만 흩어진 모습이 아니라 실제 바둑판처럼 보이도록, 같은 행의
    // 교점끼리 가로 괘선(-)으로 잇는다(빈 교점=+, 돌은 그 위에 놓인 모양). ASCII 문자만 써서
    // 16퍼즐에서 겪은 박스문자 폭 어긋남(실측 확인)을 처음부터 피한다. 세로 괘선은 24행 예산상
    // 생략(칸마다 폭 2 고정은 그대로라 마우스 핫스팟 좌표 계산에 영향 없음).
    const rows = [];
    for (let y = 0; y < OMOK_SIZE; y++) {
      let line = `  ${c(8, fitCell(String(y + 1), 2, 'right'))} `;
      for (let x = 0; x < OMOK_SIZE; x++) {
        const idx = y * OMOK_SIZE + x;
        const v = st.board[idx];
        // [LOG_ID: 20260720_1530] 돌을 항상 굵게 — 가늘게 보여 잘 안 보인다는 실측 지적 반영.
        let stoneCh;
        if (v === 1) stoneCh = c(14, `${ANSI_BOLD}●${ANSI_RESET}`);
        else if (v === 2) stoneCh = idx === lastCpuIdx ? c(11, `${ANSI_BOLD}○${ANSI_RESET}`) : c(15, `${ANSI_BOLD}○${ANSI_RESET}`);
        else if (idx === cursorIdx) stoneCh = c(10, `${ANSI_BOLD}+${ANSI_RESET}`);
        else stoneCh = c(8, '+');
        line += stoneCh + (x < OMOK_SIZE - 1 ? c(8, '-') : ' ');
      }
      if (panel[y]) line += `  ${panel[y]}`;
      rows.push(line);
    }
    const statusLine = st.status === 'win' ? c(11, `${ANSI_BOLD}  귀하의 승리입니다! 축하합니다.${ANSI_RESET}`)
      : st.status === 'lose' ? c(9, `  컴퓨터의 승리입니다. L을 눌러 다시 도전하세요.`)
      : st.status === 'resigned' ? c(9, '  게임을 포기했습니다. L을 눌러 다시 도전하세요.')
      : st.status === 'draw' ? c(14, '  바둑판이 가득 차 무승부입니다.')
      : st.lastCpu ? c(15, `  컴퓨터가 ${coordText(st.lastCpu.x, st.lastCpu.y)} 에 놓았습니다. 다음 수를 입력하세요. (${st.moves}수)`)
      : c(15, '  귀하가 흑(●) 선공입니다. 놓을 좌표를 입력하세요.');
    return [buildTopHeader(['오락실', '오목']), c(8, colLabels), ...rows, statusLine].join('\n');
  }

  // ── 오델로 ──
  function buildOthelloAnsi(st) {
    const colLabels = '     ' + Array.from({ length: OTH_SIZE }, (_, i) => String.fromCharCode(65 + i)).join(' ');
    const legal = st.status === 'play' ? new Set(othelloLegalMoves(st.board, 1).map((m) => m.idx)) : new Set();
    const rows = [];
    for (let y = 0; y < OTH_SIZE; y++) {
      let line = `  ${c(8, fitCell(String(y + 1), 2, 'right'))} `;
      for (let x = 0; x < OTH_SIZE; x++) {
        const idx = y * OTH_SIZE + x;
        const v = st.board[idx];
        // [LOG_ID: 20260720_1530] 돌을 항상 굵게 — 가늘게 보여 잘 안 보인다는 실측 지적 반영.
        if (v === 1) line += c(14, `${ANSI_BOLD}● ${ANSI_RESET}`);
        else if (v === 2) line += (idx === st.lastCpu ? c(11, `${ANSI_BOLD}○ ${ANSI_RESET}`) : c(15, `${ANSI_BOLD}○ ${ANSI_RESET}`));
        else line += legal.has(idx) ? c(8, '+ ') : c(8, '· ');
      }
      rows.push(line);
    }
    const { black, white } = othelloCount(st.board);
    const countLine = `  ${c(14, `● 귀하 ${String(black).padStart(2)}`)}  ${c(15, `○ 컴퓨터 ${String(white).padStart(2)}`)}   ${c(8, '+ 표시가 지금 둘 수 있는 자리입니다.')}`;
    const statusLine = st.status === 'win' ? c(11, `${ANSI_BOLD}  귀하의 승리입니다! (${black} : ${white})${ANSI_RESET}`)
      : st.status === 'lose' ? c(9, `  컴퓨터의 승리입니다. (${black} : ${white})  L을 눌러 다시 도전하세요.`)
      : st.status === 'draw' ? c(14, `  무승부입니다. (${black} : ${white})`)
      : st.passMsg ? c(9, `  ${st.passMsg}`)
      : st.lastCpu !== null ? c(15, `  컴퓨터가 ${coordText(st.lastCpu % OTH_SIZE, Math.floor(st.lastCpu / OTH_SIZE))} 에 놓았습니다. 좌표를 입력하세요.`)
      : c(15, '  귀하가 흑(●) 선공입니다. 놓을 좌표를 입력하세요. 입력 예) C4');
    return [buildTopHeader(['오락실', '오델로']), c(8, colLabels), ...rows, countLine, statusLine].join('\n');
  }

  // ── 숫자야구 ──
  function buildBaseballAnsi(st) {
    const parts = [
      buildTopHeader(['오락실', '숫자야구']),
      c(15, '  컴퓨터가 생각한 서로 다른 숫자 3자리를 맞추는 게임입니다.'),
      c(8, '  자리와 숫자가 모두 맞으면 S(스트라이크), 숫자만 맞으면 B(볼)입니다.'),
      ''
    ];
    st.tries.forEach((t, i) => {
      const judge = t.strike === 0 && t.ball === 0 ? c(8, 'OUT') : `${c(11, `${t.strike}S`)} ${c(14, `${t.ball}B`)}`;
      parts.push(`  ${c(14, `${i + 1}회:`)} ${c(15, t.guess.split('').join(' '))}  →  ${judge}`);
    });
    if (st.status === 'win') {
      parts.push('', c(11, `${ANSI_BOLD}  홈런! ${st.tries.length}회 만에 맞추셨습니다. 정답: ${st.answer}${ANSI_RESET}`));
    } else if (st.status === 'lose') {
      parts.push('', c(9, `  아깝습니다. ${BASEBALL_MAX_TRIES}회를 모두 사용했습니다. 정답: ${st.answer}  L을 눌러 다시 도전하세요.`));
    } else {
      parts.push('', c(15, `  남은 기회: ${BASEBALL_MAX_TRIES - st.tries.length}회  ${ansiColor(8)}입력 예) 123${ANSI_RESET}`));
    }
    return parts.join('\n');
  }

  // ── 영어단어 맞추기 (책 원전 그림 178 화면 문구 재현) ──
  function buildHangmanAnsi(st) {
    const masked = hangmanMasked(st).split('').join(' ');
    const parts = [
      buildTopHeader(['오락실', '영어단어 맞추기']),
      c(15, '  숨겨진 영어단어의 알파벳을 하나씩 추측하여 맞추는 게임입니다.'),
      c(8, `  ${st.maxWrong}번 틀리면 실패합니다.`),
      '',
      `  ${c(14, '찾는단어 :')} ${c(11, `${ANSI_BOLD}${masked}${ANSI_RESET}`)}   ${c(15, `[${st.wrong}/${st.maxWrong}]`)} ${c(8, `(${st.word.length}글자)`)}`,
      '',
      `  ${c(14, '선택한 알파벳 :')} ${c(15, `[${st.guessed.map((g) => g.toLowerCase()).join(' ')}]`)}`
    ];
    if (st.status === 'win') {
      parts.push('', c(11, `${ANSI_BOLD}  맞추셨습니다! --> (${st.word.toLowerCase()}) : ${st.meaning}${ANSI_RESET}`), c(8, '  L을 누르면 새 단어가 나옵니다.'));
    } else if (st.status === 'lose') {
      parts.push('', c(9, `  못 맞추셨습니다 --> (${st.word.toLowerCase()}) : ${st.meaning}`), c(8, '  L을 누르면 새 단어가 나옵니다.'));
    } else {
      parts.push('', c(15, '  알파벳 한 글자를 입력하세요.'), c(8, '  0을 입력하면 포기하고 정답을 봅니다.'));
    }
    return parts.join('\n');
  }

  // ── 숫자판 맞추기 (4x4 15퍼즐) ──
  function buildPuzzle15Ansi(st) {
    // 박스 문자(─│┌…)는 이 폰트에서 글리프 폭이 숫자/공백과 미세하게 달라 격자가 어긋난다
    // (Playwright 실측) — 확실히 정렬되는 ASCII 괘선을 쓴다(PC통신 원전 감성과도 일치).
    const divider = c(8, '  +----+----+----+----+');
    const rows = [divider];
    for (let y = 0; y < 4; y++) {
      let line = `  ${c(8, '|')}`;
      for (let x = 0; x < 4; x++) {
        const v = st.tiles[y * 4 + x];
        const cell = v === 0 ? '    ' : ` ${String(v).padStart(2)} `;
        const solvedPos = v !== 0 && v === y * 4 + x + 1;
        line += (solvedPos ? c(11, cell) : c(15, cell)) + c(8, '|');
      }
      rows.push(line);
      rows.push(divider);
    }
    const statusLine = st.status === 'win'
      ? c(11, `${ANSI_BOLD}  축하합니다! ${st.moves}번 만에 완성했습니다. L을 누르면 새 판이 나옵니다.${ANSI_RESET}`)
      : c(15, `  이동횟수: ${st.moves}회   ${ansiColor(8)}빈칸 옆의 숫자를 입력하면 그 자리로 이동합니다. 1~15${ANSI_RESET}`);
    return [
      buildTopHeader(['오락실', '숫자판 맞추기']),
      c(15, '  숫자를 움직여 1부터 15까지 차례대로 재배열하는 게임입니다.'),
      c(8, '  제자리를 찾은 숫자는 밝게 표시됩니다.'),
      ...rows,
      '',
      statusLine
    ].join('\n');
  }

  return { buildOmokAnsi, buildOthelloAnsi, buildBaseballAnsi, buildHangmanAnsi, buildPuzzle15Ansi };
}
