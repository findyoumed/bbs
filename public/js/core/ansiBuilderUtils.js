export function createAnsiBuilderUtils(deps) {
  const {
    displayWidth,
    isWideChar
  } = deps;

  const ANSI_RESET = '\x1b[0m';
  const ANSI_BOLD = '\x1b[1m';

  function ansiColor(fg, bg) {
    let value = '';
    if (fg !== undefined) {
      value += `\x1b[=${fg}F`;
    }
    if (bg !== undefined) {
      value += `\x1b[=${bg}G`;
    }
    return value;
  }

  function fitCell(text, maxWidth, align = 'left') {
    const source = String(text || '');
    let result = '';
    let width = 0;

    let i = 0;
    const len = source.length;
    while (i < len) {
      const ch = source[i];
      if (ch === '\x1b') {
        result += ch;
        i++;
        while (i < len) {
          const nextCh = source[i];
          result += nextCh;
          i++;
          if (/[A-Za-z]/.test(nextCh)) {
            break;
          }
        }
      } else {
        const charWidth = isWideChar(ch) ? 2 : 1;
        if (width + charWidth > maxWidth) {
          break;
        }
        result += ch;
        width += charWidth;
        i++;
      }
    }

    const padding = maxWidth - width;
    if (align === 'right') {
      return ' '.repeat(padding) + result;
    }
    return result + ' '.repeat(padding);
  }

  function normalizeHeaderSegment(value) {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) {
      return '';
    }
    return source.replace(/\s*\(([A-Z0-9_/-]+)\)\s*$/, '').trim();
  }

  function ansiHLine(width, fg = 4) {
    return ansiColor(fg) + '─'.repeat(width) + ANSI_RESET;
  }

  function buildPageLabel(current, total) {
    const currentText = String(Math.max(1, Number.parseInt(current, 10) || 1)).padStart(2, '0');
    const totalText = String(Math.max(1, Number.parseInt(total, 10) || 1)).padStart(2, '0');
    return `(${currentText}/${totalText})`;
  }

  // [LOG: 20260424_1947] 통신동호회 또는 PC 명칭이 들어오면 초기화면으로 표시
  function truncateDisplayText(text, maxWidth) {
    const width = Math.max(0, Number(maxWidth) || 0);
    if (width <= 0) {
      return '';
    }
    return fitCell(text, width).replace(/\s+$/g, '');
  }

  // [LOG_ID: 20260726_0900] systemAnsiBuilders.js(접속자 목록 W)에서만 쓰던 헬퍼를 공용으로
  // 승격 — 목록 한 줄 요약처럼 wrap이 아니라 절삭이 맞는 자리에서, 잘렸을 때 말줄임표 없이
  // 값이 다른 것처럼 보이는 문제(예: "/api/boards/notice"가 "/api/boards/not"로 잘림)를
  // 막는다. helpScreens.js의 명령 이력(/history)에도 같은 결함이 있어 공용화한다.
  function fitCellEllipsis(text, maxWidth) {
    const source = String(text || '');
    if (displayWidth(source) <= maxWidth) {
      return fitCell(source, maxWidth);
    }
    return fitCell(`${truncateDisplayText(source, Math.max(1, maxWidth - 1))}…`, maxWidth);
  }

  // [LOG_ID: 20260726_1030] fitCellEllipsis는 항상 maxWidth까지 트레일링 공백으로 패딩한다
  // (표 컬럼 정렬용으로 설계됐기 때문) — buildTopHeader의 leftText/centerText처럼 반환값의
  // displayWidth를 그대로 후속 위치 계산(minCenterStart 등)에 쓰는 자리에 패딩된 값을 넣으면
  // 폭 계산 자체가 깨진다. 패딩 없이 잘렸을 때만 말줄임표를 붙이는 버전을 별도로 둔다.
  function truncateDisplayTextEllipsis(text, maxWidth) {
    const source = String(text || '');
    if (displayWidth(source) <= maxWidth) {
      return truncateDisplayText(source, maxWidth);
    }
    return truncateDisplayText(`${truncateDisplayText(source, Math.max(1, maxWidth - 1))}…`, maxWidth);
  }

  function writeDisplayText(cells, startCol, text) {
    const source = String(text || '');
    let cursor = Math.max(0, Number(startCol) || 0);

    for (const ch of source) {
      const charWidth = isWideChar(ch) ? 2 : 1;
      if (cursor + charWidth > cells.length) {
        break;
      }
      cells[cursor] = ch;
      if (charWidth === 2 && cursor + 1 < cells.length) {
        cells[cursor + 1] = '';
      }
      cursor += charWidth;
    }
  }

  function resolveHeaderLabels(titlePath, pageLabel) {
    const leftLabelMap = {
      '초기화면': 'TOP',
      '메인 메뉴': 'TOP',
      '통신동호회': 'TOP',
      'PC': 'TOP',
      'PC통신동호회': 'TOP',
      'PC통신동호회 01410': 'TOP',
      '서비스안내': 'GUIDE',
      '게시판': 'BOARD',
      '글읽기': 'READ',
      '글쓰기': 'WRITE',
      '뉴스': 'NEWS',
      '기사 읽기': 'READ',
      '날씨': 'WEATHER',
      '공개자료실': 'PDS',
      '자료실': 'PDS',
      '대화실': 'CHAT',
      '오락실': 'GAME',
      '바이오리듬': 'BIO',
      '오늘의 운세': 'FORTUNE',
      'MBTI': 'MBTI',
      '회원가입': 'SIGNUP',
      '회원가입 / 로그인': 'LOG',
      '로그인': 'LOGIN',
      '비밀번호 찾기': 'PASSWORD',
      '마이정보': 'MYINFO'
    };
    const config = titlePath && typeof titlePath === 'object' && !Array.isArray(titlePath)
      ? titlePath
      : null;
    const segments = config
      ? []
      : (Array.isArray(titlePath) ? titlePath : [titlePath])
        .map(normalizeHeaderSegment)
        .filter(Boolean);
    const firstSegment = segments[0] || '';
    const lastSegment = segments[segments.length - 1] || '';
    const leftLabel = String(
      config?.leftLabel ||
      leftLabelMap[lastSegment] ||
      leftLabelMap[firstSegment] ||
      ''
    ).trim();

    let centerLabel = String(
      config?.centerLabel ||
      lastSegment ||
      firstSegment ||
      ''
    ).trim();

    // [LOG: 20260424_1947] 통신동호회 또는 PC 명칭이 들어오면 초기화면으로 표시
    if (!centerLabel || centerLabel === '01410' || centerLabel === 'PC' || centerLabel === '통신동호회' || centerLabel === 'PC통신동호회' || centerLabel.includes('PC통신동호회')) {
      centerLabel = '초기화면';
    }

    const rightLabel = String(config?.rightLabel || pageLabel || '').trim();

    return { leftLabel, centerLabel, rightLabel };
  }

  function buildHeaderTimestamp(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const parts = [
      date.getFullYear(), // [LOG: 20260609_1132] 1993 고정을 현재 연도로 변경
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ];
    const time = [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0')
    ];
    return `${parts.join('-')} ${time.join(':')}`;
  }

  function buildTopHeader(titlePath = [], pageLabel = '', width = null) {
    // [LOG: 20260427_1155] Automatically detect target columns if width is not provided
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetWidth = width || (isMobile ? 44 : 80);

    const brand = 'PC통신동호회 01410';
    const { leftLabel, centerLabel, rightLabel } = resolveHeaderLabels(titlePath, pageLabel);

    // [LOG_ID: 20260721_1520] 모바일도 PC와 동일하게 날짜까지 보이도록 통일(사용자 요청) —
    // 더는 44칸 모바일에서 "HH:MM"으로 줄이지 않고 항상 풀포맷을 쓴다. brandMaxWidth 계산이
    // 이미 나머지 요소들과 함께 폭 예산을 나누므로, 좁아진 여유 폭은 브랜드 텍스트 쪽이
    // truncateDisplayText로 자연스럽게 흡수한다.
    const timestamp = buildHeaderTimestamp();
    const topRightWidth = displayWidth(timestamp);

    const brandMaxWidth = Math.max(0, targetWidth - topRightWidth - 3);
    const brandCoreText = truncateDisplayText(brand, brandMaxWidth);
    const brandCoreWidth = displayWidth(brandCoreText);
    const brandPaddingBudget = Math.max(0, brandMaxWidth - brandCoreWidth);
    const brandText = brandPaddingBudget >= 2
      ? ` ${brandCoreText} `
      : brandPaddingBudget === 1
        ? ` ${brandCoreText}`
        : brandCoreText;

    const clockText = ` ${timestamp}`;
    const topGapWidth = Math.max(0, targetWidth - displayWidth(brandText) - displayWidth(clockText));
    const topGap = topGapWidth >= 1 ? '─'.repeat(topGapWidth) : '';

    const cells = Array.from({ length: targetWidth }, () => ' ');
    const rightWidth = displayWidth(rightLabel);
    const rightStart = rightLabel ? Math.max(0, targetWidth - rightWidth) : targetWidth;
    // [LOG_ID: 20260726_1030] centerLabel은 대화방/회의실 제목처럼 서버 상한(최대 100자)까지
    // 가능한 자유 텍스트를 그대로 받는데, truncateDisplayText는 말줄임표가 없어 여기서 이미
    // 말줄임표 없이 조용히 잘렸다 — CSS 쪽에 나중에 붙인 .retro-topbar-center의
    // text-overflow:ellipsis(20260726_0310)는 이 ANSI 텍스트 레벨 절삭이 이미 폭에 딱 맞게
    // 자른 뒤라 사실상 발동하지 않는 안전망이었다. buildTopHeader는 모든 화면이 공유하므로
    // truncateDisplayTextEllipsis로 교체해 실제 절삭 지점에서 "…"를 남긴다 — fitCellEllipsis가
    // 아니라 이 변형을 쓰는 이유는, 반환값의 displayWidth를 아래 minCenterStart 계산에 그대로
    // 쓰는데 fitCellEllipsis는 항상 maxWidth까지 패딩해 그 계산 자체를 깨뜨리기 때문(1차
    // 구현에서 실제로 이 문제를 겪고 발견해 truncateDisplayTextEllipsis를 새로 추가했다).
    const leftText = truncateDisplayTextEllipsis(leftLabel, rightLabel ? Math.max(0, rightStart - 2) : targetWidth);
    const leftWidth = displayWidth(leftText);
    const minCenterStart = leftText ? leftWidth + 1 : 0;
    const maxCenterWidth = Math.max(0, (rightLabel ? rightStart - 1 : targetWidth) - minCenterStart);
    const centerText = truncateDisplayTextEllipsis(centerLabel, maxCenterWidth);
    const centerWidth = displayWidth(centerText);
    let centerStart = Math.max(minCenterStart, Math.floor((targetWidth - centerWidth) / 2));

    if (rightLabel && centerStart + centerWidth > rightStart - 1) {
      centerStart = Math.max(minCenterStart, rightStart - 1 - centerWidth);
    }

    writeDisplayText(cells, 0, leftText);
    writeDisplayText(cells, centerStart, centerText);
    if (rightLabel) {
      writeDisplayText(cells, rightStart, rightLabel);
    }

    const topLine = `${ansiColor(0, 15)}${brandText}${ANSI_RESET}${topGap}${clockText}`;
    const headerLine = cells.filter((cell) => cell !== '').join('');

    return [
      topLine,
      headerLine,
      '─'.repeat(targetWidth),
      ''
    ].join('\n');
  }

  function formatShortDate(value) {
    const source = String(value || '').trim();
    if (!source) return '  /  ';

    const ymdLike = source.match(/^((?:19|20)?\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?/);
    if (ymdLike) {
      const yy = ymdLike[1].length === 4 ? ymdLike[1].slice(2) : ymdLike[1];
      return `${yy.padStart(2, '0')}/${ymdLike[2].padStart(2, '0')}/${ymdLike[3].padStart(2, '0')}`;
    }

    // Try parsing as ISO-like YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(source)) {
      const parts = source.split('T')[0].split('-');
      return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
    }

    // Try parsing with Date object
    const d = new Date(source);
    if (!isNaN(d.getTime())) {
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}/${mm}/${dd}`;
    }

    // Fallback: return as-is or slice if too long
    return source.length > 8 ? source.slice(0, 8) : source;
  }

  function formatLongDate(value) {
    const source = String(value || '').trim();
    if (!source) {
      return '';
    }
    const d = new Date(source);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    }
    // Fallback: simple slice/replace if Date fails
    return source.replace('T', ' ').slice(0, 16).replace(/-/g, '/');
  }

  function wrapAnsiText(text, width) {
    const lines = [];

    for (const rawLine of String(text || '').split('\n')) {
      if (!rawLine) {
        lines.push('');
        continue;
      }

      let current = '';
      let currentWidth = 0;
      let i = 0;
      const len = rawLine.length;

      while (i < len) {
        const ch = rawLine[i];
        if (ch === '\x1b') {
          current += ch;
          i++;
          while (i < len) {
            const nextCh = rawLine[i];
            current += nextCh;
            i++;
            if (/[A-Za-z]/.test(nextCh)) {
              break;
            }
          }
        } else {
          const charWidth = isWideChar(ch) ? 2 : 1;
          if (currentWidth + charWidth > width) {
            lines.push(current);
            current = '';
            currentWidth = 0;
            // [LOG_ID: 20260726_2130] 줄바꿈 경계가 하필 공백 바로 다음이면 그 공백이 새 줄의
            // 맨 앞 글자로 그대로 넘어가, 이어지는 줄만 한 칸 밀려 보였다(실측: help 화면 "N"/"A"
            // 행 — "목록에서 다음(더 낮은 번호) 글을" 다음 줄이 " 읽습니다."로 앞에 공백 하나가
            // 붙어 표시됨. 원문은 "...글을 읽습니다."로, 줄바꿈 지점이 정확히 그 공백 위치라 생김).
            // 표준 워드랩처럼 줄바꿈에 걸린 공백 한 칸은 다음 줄로 넘기지 않고 여기서 소비한다.
            if (ch === ' ') {
              i++;
              continue;
            }
          }
          current += ch;
          currentWidth += charWidth;
          i++;
        }
      }

      lines.push(current);
    }

    return lines.length ? lines : [''];
  }

  /**
   * Highlights search terms in text with ANSI colors.
   * [LOG: 20260426_1430] Added for better search visibility (Readability Evolution).
   */
  function highlightText(text, term, color = 14, baseColor = 15) {
    const source = String(text || '');
    const search = String(term || '').trim();
    if (!search || !source) return source;

    try {
      // Escape special regex characters
      const escapedTerm = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = source.split(new RegExp(`(${escapedTerm})`, 'gi'));

      return parts.map(part => {
        if (part.toLowerCase() === search.toLowerCase()) {
          return ansiColor(color) + part + (baseColor !== undefined ? ansiColor(baseColor) : ANSI_RESET);
        }
        return part;
      }).join('');
    } catch (e) {
      return source;
    }
  }

  function estimatePostPageCount(post, width = 60, linesPerPage = 16) {
    const sample = String(post?.content || post?.body || post?.title || '').trim();
    const lineCount = wrapAnsiText(sample, width).length;
    return Math.max(1, Math.ceil(lineCount / linesPerPage));
  }

  // [LOG_ID: 20260721_2340] step(답글 깊이)과 무관하게 항상 '└ ' 한 종류만 붙어 3단・4단 답글이
  // 1단 답글과 구분 안 되던 문제 — 깊이당 2칸씩 들여쓰기를 더한다(과도한 폭 낭비를 막기 위해
  // 4단부터는 더 늘리지 않고 고정). fitCell이 어차피 열 폭에 맞춰 잘라내므로 열 오버플로는 없다.
  function buildThreadPrefix(step) {
    const depth = Math.max(0, Number(step) || 0);
    if (depth <= 0) return '';
    const indentLevels = Math.min(depth - 1, 3);
    return '  '.repeat(indentLevels) + '└ ';
  }

  return {
    ANSI_BOLD,
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildThreadPrefix,
    buildTopHeader,
    ansiHLine,
    displayWidth,
    estimatePostPageCount,
    fitCell,
    fitCellEllipsis,
    formatLongDate,
    formatShortDate,
    highlightText,
    normalizeHeaderSegment,
    truncateDisplayText,
    truncateDisplayTextEllipsis,
    wrapAnsiText
  };
}
