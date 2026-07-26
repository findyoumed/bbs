export const ANSI_COLS = 80;
export const ANSI_ROWS = 1000; // [LOG: 20260426_1755] Increase buffer for scrollable content

export function isWideChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  // [LOG: 20260713_1300] ◎, ●, ☎는 이 폰트에서 1칸(반각)이므로 광폭 문자 판정에서 제외한다.
  // [LOG_ID: 20260720_1530] ○(U+25CB, 오목/오델로 백돌)도 실측 결과 이 폰트에서 1칸이다 — 짝인
  // ●만 제외 목록에 있고 ○는 빠져 있어서, CSS(.wc { width:2ch })가 억지로 2칸 상자에 가운데
  // 정렬시키는 바람에 돌이 작고 흐릿하게 보이고 그 칸부터 가로줄 정렬이 밀려 삐뚤어져 보였다
  // (사용자 실측 지적: "동그라미가 잘 안보이고 선이 삐뚤게 되어 있어").
  if (cp === 0x25CE || cp === 0x25CF || cp === 0x25CB || cp === 0x260E) return false;
  // [LOG: 20260427_1150] CJK Unified Ideographs (Hanja) + Hangul + Full-width Symbols
  // [LOG: 20260428_2225] Include CJK Extension A / Compatibility Ideographs so titles like "李" occupy 2 cells
  // [LOG: 20260610_1423] Include CJK Enclosed Letters and Months (U+3200-U+32FF) like ㈜ to display as wide chars
  // [LOG: 20260616_0945] Include U+203B Reference Mark (※) and U+2500 to U+27BF ranges (Geometric shapes, Box drawings, Symbols) as wide chars
  return (cp >= 0x3400 && cp <= 0x4DBF) // CJK Unified Ideographs Extension A
    || (cp >= 0x4E00 && cp <= 0x9FFF) // CJK Unified Ideographs (Hanja)
    || (cp >= 0xF900 && cp <= 0xFAFF) // CJK Compatibility Ideographs
    || (cp >= 0xAC00 && cp <= 0xD7A3) // Hangul Syllables
    || (cp >= 0x1100 && cp <= 0x11FF) // Hangul Jamo
    || (cp >= 0x3130 && cp <= 0x318F) // Hangul Compatibility Jamo
    || (cp >= 0x3000 && cp <= 0x303F) // CJK Symbols and Punctuation
    || (cp >= 0x3200 && cp <= 0x32FF) // CJK Enclosed Letters and Months (e.g. ㈜)
    || (cp >= 0x3300 && cp <= 0x33FF) // CJK Compatibility (e.g. ㎞, ㎡)
    || (cp >= 0xFE30 && cp <= 0xFE4F) // CJK Compatibility Forms
    || (cp >= 0xFF01 && cp <= 0xFF60) // Full-width Forms
    || (cp >= 0x3040 && cp <= 0x309F) // Hiragana
    || (cp >= 0x30A0 && cp <= 0x30FF) // Katakana
    || (cp === 0x203B) // Reference Mark (※)
    || (cp >= 0x25A0 && cp <= 0x27BF) // Geometric shapes, Dingbats (실측 확인된 광폭 대역만)
    || (cp >= 0x1F000 && cp <= 0x1FAFF); // [LOG_ID: 20260726_1615] 이모지(마작/카드/지역표시자·
  // 이모티콘·교통/기호·체스 등 U+1F000-1FAFF 전 대역, 예: 😀🎉👍🔥). 닉네임(maxLength:20은
  // UTF-16 코드유닛 기준이라 서로게이트 쌍인 이모지 10개까지 허용됨)·채팅 메시지(최대 2000자)
  // 등 자유 텍스트에 이모지가 섞이면, 이 함수가 이들을 전혀 광폭으로 인식하지 못해 좁은 문자
  // (1칸)로 잘못 계산했다 — 실측 결과 이 폰트 환경에서 이모지 하나는 아스키의 약 2.5배 폭으로
  // 렌더링되는데(18.72px vs 7.5px, 한글 15px보다도 넓음) displayWidth()가 1칸으로 셈해
  // wrapAnsiText가 실제보다 훨씬 많은 이모지를 한 줄에 채워, 줄바꿈을 거친 뒤에도 실제 화면
  // 폭을 넘겨 조용히 잘렸다(실측 재현: 동일 이모지 32개로 구성된 "32칸" 줄이 실제로는 390px
  // 뷰포트에서 614px, 224px/57% 오버플로). 2칸(광폭)으로 판정하면 완벽히 정확하진 않아도(실제
  // 2.5배) wrapAnsiText가 훨씬 보수적으로 더 일찍 줄바꿈해 이 폰트 어디서도 실사용 시나리오에서
  // 오버플로가 재현되지 않는 수준으로 충분히 해소된다.
  // [LOG_ID: 20260713_1600] U+2500-259F(박스 문자, 예: ─│┌┐└┘┏┓┗┛┬┴├┤▒)는 실측 결과
  // 이 폰트에서 1칸(narrow)이다. 2칸으로 판정되면 ansiToHTML의 80칸 고정 버퍼가 절반
  // 지점에서 커서 오버플로로 나머지 문자를 조용히 버려서, ansiHLine()이 만드는 구분선
  // (뉴스/게시판/자료실 목록 헤더 밑줄 등 사이트 전역)이 절반 길이로 잘리는 버그가
  // 발생했다 — 광폭 판정에서 제외한다.
}

export function displayWidth(text) {
  let width = 0;
  for (const ch of String(text || '')) {
    width += isWideChar(ch) ? 2 : 1;
  }
  return width;
}

function isMainStatsLine(text) {
  const source = String(text || '');
  return source.includes('[nummembers]') || source.includes('[numarticles]');
}

// [LOG_ID: 20260720_1545] 오목/오델로 돌(●U+25CF/○U+25CB)이 폰트 원본 글리프 자체가 작아
// 굵게(bold)만으로는 여전히 잘 안 보인다는 실측 지적(2차) — 폭은 그대로 1칸으로 두되
// 글자 크기만 CSS로 키운다(.stone, style.css). isWideChar처럼 "2칸으로 세는" 방식이 아니라
// 시각적으로만 커 보이게 하는 것이라 displayWidth/커서·핫스팟 좌표 계산에는 영향이 없다.
// 이 두 글자는 escCell을 타는 다른 화면에서 쓰이지 않는다(확인됨 — 전부 주석이거나 DOM
// textContent 직접 대입이라 이 함수를 거치지 않음), 그래서 전역 공유 함수를 안전하게 바꿀 수 있다.
function isStoneChar(ch) {
  const cp = ch?.codePointAt(0);
  return cp === 0x25CF || cp === 0x25CB;
}

function escCell(text) {
  let result = '';
  for (const ch of String(text || '')) {
    const escaped = ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
    if (isStoneChar(ch)) {
      result += `<span class="stone">${escaped}</span>`;
    } else if (isWideChar(ch)) {
      result += `<span class="wc">${escaped}</span>`;
    } else {
      result += escaped;
    }
  }
  return result;
}

export function ansiToHTML(text) {
  const buf = Array.from({ length: ANSI_ROWS }, () =>
    Array.from({ length: ANSI_COLS }, () => ({ ch: ' ', fg: 7, bg: 0, bold: false, rev: false }))
  );

  let row = 0;
  let col = 0;
  let fg = 7;
  let bg = 0;
  let bold = false;
  let rev = false;
  let maxRowReached = 0; // [LOG: 20260428_1110] Initialize to 0 to allow adaptive height (Remove 25-line min)

  function putChar(ch) {
    if (row >= ANSI_ROWS) return;
    if (col >= ANSI_COLS) {
      col += 1;
      return;
    }
    buf[row][col] = { ch, fg, bg, bold, rev };
    if (row > maxRowReached) maxRowReached = row;
    col += 1;
    if (isWideChar(ch) && col < ANSI_COLS) {
      buf[row][col] = { ch: '\x00', fg, bg, bold, rev };
      col += 1;
    }
  }

  function clearScreen() {
    for (let r = 0; r < ANSI_ROWS; r += 1) {
      for (let c = 0; c < ANSI_COLS; c += 1) {
        buf[r][c] = { ch: ' ', fg: 7, bg: 0, bold: false, rev: false };
      }
    }
    maxRowReached = 0;
  }

  let index = 0;
  // [LOG: 20260709_1040] 클라이언트단 렌더링 초입에서 NFD 자모를 NFC 결합 형태 음절로 정규화하여 자모 분리 렌더링을 방지
  const input = String(text || '').normalize('NFC');
  while (index < input.length) {
    if (input[index] === '\x1b' && input[index + 1] === '[') {
      index += 2;
      let params = '';
      while (index < input.length && input.charCodeAt(index) >= 0x20 && input.charCodeAt(index) <= 0x3F) {
        params += input[index];
        index += 1;
      }
      const cmd = index < input.length ? input[index] : '';
      index += 1;

      if (cmd === 'H' || cmd === 'f') {
        const parts = params.split(';');
        row = Math.max(0, Math.min(ANSI_ROWS - 1, (parseInt(parts[0], 10) || 1) - 1));
        col = Math.max(0, Math.min(ANSI_COLS - 1, (parseInt(parts[1], 10) || 1) - 1));
        if (row > maxRowReached) maxRowReached = row;
      } else if (cmd === 'J') {
        clearScreen();
        row = 0;
        col = 0;
      } else if (cmd === 'F' && params.startsWith('=')) {
        fg = Math.max(0, Math.min(15, parseInt(params.slice(1), 10) || 0));
      } else if (cmd === 'G' && params.startsWith('=')) {
        bg = Math.max(0, Math.min(15, parseInt(params.slice(1), 10) || 0));
      } else if (cmd === 'm') {
        const codes = (params || '0').split(';').map(Number);
        for (const n of codes) {
          if (n === 0) {
            fg = 7;
            bg = 0;
            bold = false;
            rev = false;
          } else if (n === 1) {
            bold = true;
          } else if (n === 7) {
            rev = true;
          } else if (n >= 30 && n <= 37) {
            fg = n - 30;
          } else if (n >= 40 && n <= 47) {
            bg = n - 40;
          } else if (n >= 90 && n <= 97) {
            fg = n - 82;
          } else if (n >= 100 && n <= 107) {
            bg = n - 92;
          }
        }
      }
    } else if (input[index] === '\r') {
      col = 0;
      index += 1;
    } else if (input[index] === '\n') {
      col = 0;
      row += 1;
      if (row > maxRowReached && row < ANSI_ROWS) maxRowReached = row;
      index += 1;
    } else {
      const cp = input.codePointAt(index);
      putChar(input[index]);
      index += cp > 0xFFFF ? 2 : 1;
    }
  }

  const lines = [];
  const plainRows = [];
  const finalRowCount = Math.min(ANSI_ROWS, maxRowReached + 1);

  for (let r = 0; r < finalRowCount; r += 1) {
    let html = '';
    let plain = '';
    let cFg = -1;
    let cBg = -1;
    let cBold = false;
    let cRev = false;
    let chunk = '';
    let lastContentCol = -1;

    for (let c = 0; c < ANSI_COLS; c += 1) {
      const ch = buf[r][c]?.ch;
      if (ch && ch !== '\x00' && ch !== ' ') {
        lastContentCol = c;
      }
    }

    function flush() {
      if (!chunk) return;
      let actualFg = cFg < 0 ? 7 : cFg;
      let actualBg = cBg < 0 ? 0 : cBg;

      // [LOG: 20260611_1215] Handle ANSI Reverse attribute
      if (cRev) {
        const tmp = actualFg;
        actualFg = (actualBg === 0) ? 0 : actualBg;
        actualBg = (tmp === 7 && cFg < 0) ? 7 : tmp;
      }

      const classes = [];
      classes.push(`ansi-fg-${actualFg}`);
      if (actualBg !== 0) classes.push(`ansi-bg-${actualBg}`);
      if (cBold) classes.push('ansi-bold');

      const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
      html += `<span${classAttr}>${escCell(chunk)}</span>`;
      chunk = '';
    }

    for (let c = 0; c <= lastContentCol; c += 1) {
      const cell = buf[r][c];
      if (cell.ch === '\x00') continue;
      plain += cell.ch;
      if (cell.fg !== cFg || cell.bg !== cBg || cell.bold !== cBold || cell.rev !== cRev) {
        flush();
        cFg = cell.fg;
        cBg = cell.bg;
        cBold = cell.bold;
        cRev = cell.rev;
      }
      chunk += cell.ch;
    }
    flush();

    if (isMainStatsLine(plain)) {
      plainRows.push(' '.repeat(ANSI_COLS));
      lines.push(`<div class="ansi-line"><span class="ansi-fg-15">${' '.repeat(ANSI_COLS)}</span></div>`);
      continue;
    }

    if (lastContentCol < 0) {
      plainRows.push('');
      lines.push('<div class="ansi-line">\u00a0</div>');
      continue;
    }

    plainRows.push(plain);
    lines.push(`<div class="ansi-line">${html || '\u00a0'}</div>`);
  }

  return {
    html: lines.join(''),
    rows: plainRows,
    cols: ANSI_COLS,
    rowCount: finalRowCount
  };
}
