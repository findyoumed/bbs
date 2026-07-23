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
    // [LOG_ID: 20260720_2010] 반상(15줄, 폭 35칸)에 우측 정보 패널을 항상 나란히 붙였는데,
    // 모바일(44칸)에서는 반상만으로도 이미 35칸이라 패널까지 붙이면 60여 칸으로 화면 폭을
    // 넘어 글자가 잘려 보였다(사용자 스크린샷: "귀하: ●(흑"에서 끊김). 전투 게임(Battleship)이
    // 이미 쓰는 패턴대로, 모바일에서는 패널을 반상 옆이 아니라 아래 별도 줄로 뺀다.
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const colLabels = '     ' + Array.from({ length: OMOK_SIZE }, (_, i) => String.fromCharCode(65 + i)).join(' ');
    const lastCpuIdx = st.lastCpu ? st.lastCpu.y * OMOK_SIZE + st.lastCpu.x : -1;
    const cursorIdx = st.cursor && st.status === 'play' ? st.cursor.y * OMOK_SIZE + st.cursor.x : -1;
    const panelLines = [
      c(15, '귀하: ● (흑)  컴퓨터: ○ (백)'),
      c(8, `진행: ${st.moves}수`),
      st.lastCpu ? c(11, `컴퓨터 착수: ${coordText(st.lastCpu.x, st.lastCpu.y)}`) : '',
      c(8, '입력 예) H8'),
      c(8, '마우스 클릭 착수 가능'),
      c(8, 'L: 새 게임'),
      // [LOG_ID: 20260720_1600] 천리안 원전 그림179 우측 패널("/Q : 게임포기") 재현.
      c(8, 'Q: 게임포기')
      // [LOG_ID: 20260720_1800] 33/44 금수 규칙 제거(자유오목) — 사용자 판단: 컴퓨터에는
      // 적용 안 되면서 흑에게만 33이 걸리는 게 오히려 불공평했고, 44는 아예 안 막혀서
      // 컴퓨터가 이중 열린4로 이기는 사례가 나왔다. 반쪽 규칙 대신 순수 5목으로 되돌린다.
    ];
    const panel = isMobile ? {} : { 1: panelLines[0], 3: panelLines[1], 5: panelLines[2], 7: panelLines[3], 8: panelLines[4], 9: panelLines[5], 10: panelLines[6] };
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
    const parts = [buildTopHeader(['오락실', '오목']), c(8, colLabels), ...rows, statusLine];
    if (st.hintMsg) parts.push('', c(9, `  ${st.hintMsg}`));
    if (isMobile) {
      parts.push('', ...panelLines.filter(Boolean).map((line) => `  ${line}`));
    }
    return parts.join('\n');
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
    const hintLine = st.hintMsg ? `\n  ${c(9, st.hintMsg)}` : '';
    return [buildTopHeader(['오락실', '오델로']), c(8, colLabels), ...rows, countLine, statusLine].join('\n') + hintLine;
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
    if (st.hintMsg) parts.push('', c(9, `  ${st.hintMsg}`));
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
      : c(15, `  이동횟수: ${st.moves}회   ${ansiColor(8)}숫자 이동: 1~15   그만두기(상위메뉴): P${ANSI_RESET}`);
    const hintLine = st.hintMsg ? `\n  ${c(9, st.hintMsg)}` : '';
    return [
      buildTopHeader(['오락실', '숫자판 맞추기']),
      c(15, '  숫자를 움직여 1부터 15까지 차례대로 재배열하는 게임입니다.'),
      c(8, '  제자리를 찾은 숫자는 밝게 표시됩니다.'),
      ...rows,
      '',
      statusLine
    ].join('\n') + hintLine;
  }

  // ── 6. 스크램블 (Scramble) ──
  function buildScrambleAnsi(st) {
    const divider = c(8, '  +---+---+---+---+');
    const rows = [divider];
    for (let y = 0; y < 4; y++) {
      let line = `  ${c(8, '|')}`;
      for (let x = 0; x < 4; x++) {
        const char = st.grid[y * 4 + x];
        line += ` ${c(15, char)} ${c(8, '|')}`;
      }
      rows.push(line);
      rows.push(divider);
    }
    
    const timeLimit = 60;
    const currentElapsed = Math.min(timeLimit, Math.floor((Date.now() - st.startTime) / 1000));
    const remains = Math.max(0, timeLimit - (st.status === 'end' ? st.elapsed : currentElapsed));
    
    const statusLine = st.status === 'end'
      ? c(9, `  제한시간이 다 되었습니다! 최종 점수: ${st.score}점   L을 누르면 새 게임`)
      : `  ${c(14, '남은시간:')} ${c(11, `${remains}초`)}   ${c(14, '점수:')} ${c(11, `${st.score}점`)}`;
      
    const hintLine = st.hintMsg ? `\n  ${c(9, st.hintMsg)}` : '';
      
    return [
      buildTopHeader(['오락실', '스크램블']),
      c(15, '  정사각형 글자판 속 알파벳들을 조합하여 유효한 영어 단어를 만드세요.'),
      c(8, '  (2글자 이상, 단어 입력 후 엔터. 예: PONY)'),
      ...rows,
      `  ${c(14, '찾은 단어들 :')} ${c(15, `[${st.found.join(', ')}]`)}`,
      '',
      statusLine
    ].join('\n') + hintLine;
  }

  // ── 7. 영어단어/숙어 학습게임 (WP) ──
  function buildWpAnsi(st) {
    if (st.status === 'end') {
      return [
        buildTopHeader(['오락실', '영어 학습게임']),
        '',
        c(11, `${ANSI_BOLD}  게임이 완료되었습니다!${ANSI_RESET}`),
        c(15, `  귀하의 최종 점수: ${st.score}점 / 100점`),
        '',
        c(8, '  L을 누르면 새 게임이 시작됩니다.')
      ].join('\n');
    }
    
    const current = st.questions[st.currentIdx];
    const word = current[0];
    const meaning = current[1];
    
    // 오답 횟수에 따른 힌트 마스킹 문자열 생성
    let masked = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch === ' ') {
        masked += '  ';
      } else if (st.tries === 0) {
        masked += '_ ';
      } else if (st.tries === 1) {
        // 첫 번째 철자만 공개
        masked += (i === 0 ? `${ch} ` : '_ ');
      } else {
        // 첫 번째 철자와 마지막 철자 공개
        masked += (i === 0 || i === word.length - 1 ? `${ch} ` : '_ ');
      }
    }
    
    return [
      buildTopHeader(['오락실', '영어 학습게임']),
      c(15, '  제시된 뜻을 가진 알맞은 영어 단어/숙어를 입력하세요.'),
      '',
      `  ${c(14, `[문제 ${st.currentIdx + 1} / 5]`)}`,
      `  ${c(14, '뜻   :')} ${c(15, meaning)}`,
      `  ${c(14, '단어 :')} ${c(11, `${ANSI_BOLD}${masked}${ANSI_RESET}`)} ${c(8, `(${word.length}글자)`)}`,
      '',
      `  ${c(14, '틀린 횟수 :')} ${c(9, `${st.tries} / ${st.maxTries}`)}   ${c(14, '현재 점수 :')} ${c(11, `${st.score}점`)}`,
      c(8, '  정답을 맞춰보세요. (대소문자 무관)')
    ].join('\n');
  }

  // ── 8. 타자 연습/게임 (Typing) ──
  function buildTypingAnsi(st) {
    if (st.status === 'end') {
      const parts = [
        buildTopHeader(['오락실', '타자 연습/게임']),
        '',
        c(11, `${ANSI_BOLD}  연습이 완료되었습니다! 결과 요약:${ANSI_RESET}`),
        ''
      ];
      
      let sumCpm = 0, sumAcc = 0;
      st.results.forEach((res, i) => {
        parts.push(`  ${i + 1}번 문장: ${c(15, `${res.cpm} CPM`)}  정확도: ${c(11, `${res.accuracy}%`)}`);
        sumCpm += res.cpm;
        sumAcc += res.accuracy;
      });
      
      const avgCpm = Math.floor(sumCpm / st.results.length);
      const avgAcc = Math.floor(sumAcc / st.results.length);
      
      parts.push(
        '',
        `  ${c(14, '평균 타수 :')} ${c(11, `${avgCpm} CPM`)}   ${c(14, '평균 정확도 :')} ${c(11, `${avgAcc}%`)}`,
        '',
        c(8, '  L을 누르면 새 게임이 시작됩니다.')
      );
      return parts.join('\n');
    }
    
    const target = st.sentences[st.currentIdx];
    const parts = [
      buildTopHeader(['오락실', '타자 연습/게임']),
      c(15, '  제시된 문장과 완전히 동일하게 입력창에 타이핑하세요.'),
      '',
      `  ${c(14, `[문장 ${st.currentIdx + 1} / 3]`)}`,
      `  ${c(14, '제시 :')} ${c(11, `${ANSI_BOLD}${target}${ANSI_RESET}`)}`,
      ''
    ];
    
    if (st.results.length > 0) {
      const prev = st.results[st.results.length - 1];
      parts.push(`  ${c(8, `이전 결과: ${prev.cpm} CPM  정확도: ${prev.accuracy}%`)}`, '');
    }
    
    parts.push(c(8, '  아래 입력창에 문장을 똑같이 써주세요.'));
    return parts.join('\n');
  }

  // ── 9. 퀴즈박사 (Quiz) ──
  function buildQuizAnsi(st) {
    if (st.status === 'end') {
      let grade = '초보';
      if (st.score >= 100) grade = '퀴즈박사';
      else if (st.score >= 80) grade = '우수자';
      else if (st.score >= 60) grade = '중수';
      
      return [
        buildTopHeader(['오락실', '퀴즈박사']),
        '',
        c(11, `${ANSI_BOLD}  퀴즈 완료!${ANSI_RESET}`),
        c(15, `  최종 점수 : ${st.score}점`),
        c(14, `  획득 등급 : ${grade}`),
        '',
        c(8, '  L을 누르면 새 게임이 시작됩니다.')
      ].join('\n');
    }
    
    const current = st.questions[st.currentIdx];
    const parts = [
      buildTopHeader(['오락실', '퀴즈박사']),
      c(15, '  상식 퀴즈를 풀어보세요. 정답 번호(1~4)를 입력하세요.'),
      '',
      `  ${c(14, `[문제 ${st.currentIdx + 1} / 5]`)}`,
      `  ${c(15, `${ANSI_BOLD}Q. ${current.q}${ANSI_RESET}`)}`,
      ''
    ];
    
    current.options.forEach((opt) => {
      parts.push(`  ${c(14, opt)}`);
    });
    
    parts.push('', `  ${c(14, '현재 점수 :')} ${c(11, `${st.score}점`)}`);
    
    if (st.answers.length > 0) {
      const prevQIdx = st.currentIdx - 1;
      const prevQ = st.questions[prevQIdx];
      const prevAns = st.answers[st.answers.length - 1];
      const isCorrect = prevAns === prevQ.a;
      parts.push(
        `  ${isCorrect ? c(11, '이전 문제: 정답입니다!') : c(9, `이전 문제: 오답입니다! (정답: ${prevQ.a})`)}`
      );
    }
    
    return parts.join('\n');
  }

  // ── 10. 전투 게임 (Battle - Battleship) ──
  function buildBattleAnsi(st) {
    const colLabels = '  1 2 3 4 5 6 7 8 9 10';
    const rowLabels = 'ABCDEFGHIJ';
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    const parts = [
      buildTopHeader(['오락실', '전투 게임 (Battleship)']),
      c(15, '  격자판 좌표(예: G3)를 입력해 적의 숨겨진 군장비(12칸)를 폭격하세요!'),
      ''
    ];
    
    if (isMobile) {
      // 모바일 좁은 화면: 상대 해역만 크게 렌더링하고 아군 정보는 정보 패널로 대체
      parts.push(c(14, '  [적의 해역 포격 현황]'), c(8, `   ${colLabels}`));
      for (let y = 0; y < 10; y++) {
        let line = `  ${c(8, rowLabels[y])} `;
        for (let x = 0; x < 10; x++) {
          const shot = st.userShots[y * 10 + x];
          if (shot === 2) line += c(11, '★ ');
          else if (shot === 1) line += c(8, 'X ');
          else line += c(8, '· ');
        }
        parts.push(line);
      }
      parts.push(
        '',
        `  ${c(14, '귀하 명중:')} ${c(11, `${st.userHits}/12`)}   ${c(14, '컴퓨터 명중:')} ${c(9, `${st.cpuHits}/12`)}`
      );
    } else {
      // 데스크톱 넓은 화면: 좌우 나란히 렌더링
      parts.push(
        `     ${c(14, '<< 상대 해역 포격 현황 >>')}           ${c(11, '<< 아군 해역 배치 및 현황 >>')}`,
        `   ${c(8, colLabels)}         ${c(8, colLabels)}`
      );
      
      for (let y = 0; y < 10; y++) {
        // 좌측: 상대 해역 포격
        let leftLine = `  ${c(8, rowLabels[y])} `;
        for (let x = 0; x < 10; x++) {
          const shot = st.userShots[y * 10 + x];
          if (shot === 2) leftLine += c(11, '★ ');
          else if (shot === 1) leftLine += c(8, 'X ');
          else leftLine += c(8, '· ');
        }
        
        // 우측: 아군 배치 및 컴퓨터 포격 현황
        let rightLine = `  ${c(8, rowLabels[y])} `;
        for (let x = 0; x < 10; x++) {
          const idx = y * 10 + x;
          const ship = st.userBoard[idx];
          const shot = st.cpuShots[idx];
          
          if (shot === 2) rightLine += c(9, '★ '); // 아군 피격 명중
          else if (shot === 1) rightLine += c(8, 'X '); // 빗나감
          else if (ship !== 0) rightLine += c(14, `${ship[0]} `); // 함선 존재
          else rightLine += c(8, '· ');
        }
        
        parts.push(`${leftLine}     ${rightLine}`);
      }
    }
    
    // 최근 포격 피드백 정보
    // [LOG_ID: 20260721_0900] 좌표 표기 순서 버그 — 격자는 행(y)=문자, 열(x)=숫자(예: G3 → y=6,x=2)로
    // 입력·렌더링되는데, 이 피드백 줄만 x를 문자로 y를 숫자로 뒤집어 써서 "G3를 공격"해도
    // "(C 7)"처럼 완전히 다른 좌표로 표시됐다. rowLabels[y]/x+1로 바로잡는다.
    parts.push('');
    if (st.lastUserShot) {
      const res = st.lastUserShot.hit ? c(11, `명중! (${st.lastUserShot.target})`) : c(8, '빗나감');
      parts.push(`  귀하 공격 : (${rowLabels[st.lastUserShot.y]}${st.lastUserShot.x + 1}) - ${res}`);
    }
    if (st.lastCpuShot) {
      const res = st.lastCpuShot.hit ? c(9, `피격 명중! (${st.lastCpuShot.target})`) : c(8, '빗나감');
      parts.push(`  적군 보복 : (${rowLabels[st.lastCpuShot.y]}${st.lastCpuShot.x + 1}) - ${res}`);
    }
    
    // 승패/진행 상태
    parts.push('');
    if (st.status === 'win') {
      parts.push(c(11, `${ANSI_BOLD}  작전 성공! 귀하의 완벽한 승리입니다! L을 누르면 다시 시작합니다.${ANSI_RESET}`));
    } else if (st.status === 'lose') {
      parts.push(c(9, `  함대가 전멸했습니다... 작전 실패. L을 눌러 다시 도전하세요.`));
    } else {
      parts.push(c(15, '  공격할 좌표를 입력하세요. 입력 예) G3'), c(8, '  Q: 게임포기'));
    }
    
    return parts.join('\n');
  }

  return {
    buildOmokAnsi,
    buildOthelloAnsi,
    buildBaseballAnsi,
    buildHangmanAnsi,
    buildPuzzle15Ansi,
    buildScrambleAnsi,
    buildWpAnsi,
    buildTypingAnsi,
    buildQuizAnsi,
    buildBattleAnsi
  };
}
