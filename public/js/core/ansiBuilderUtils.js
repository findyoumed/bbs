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
    // [LOG_ID: 20260721_1645] '─'(U+2500) 문자는 CSS 폰트 스택에서 'BbsLineFont'(로컬 시스템
    // 폰트로 대체되는 박스 그리기 전용 폰트, style.css 76행)의 unicode-range(U+2500-257F)에
    // 걸려 있는데, 실기기(특히 GulimChe/DotumChe가 없는 안드로이드)에서 이 대체 폰트의 문자 폭이
    // 본문에 쓰이는 커스텀 픽셀 폰트(DungGeunMo)보다 넓어, 같은 글자수(44칸)로 만든 구분선이
    // 실제 화면 폭보다 좁게 렌더링되어 오른쪽에 빈 여백을 남기는 문제가 있었다(사용자 지적:
    // "가로선과 본문글은 좌측으로 쏠려있어" — 헤드리스 브라우저로는 재현되지 않아 실기기 폰트
    // 대체 차이로 추정). 정확한 폭 비율을 기기마다 예측하기보다, 모바일에서는 여유 있게
    // 더 그려서 넘치는 부분을 잘라내는 쪽이 어떤 폰트 조합에서도 항상 폭을 다 채우는 안전한
    // 방법이다 — 모바일 화면은 이미 #terminal-screen에 overflow:hidden(또는 post-view의
    // overflow-x:hidden)이 기본 적용돼 있어 초과분은 잘릴 뿐 스크롤을 유발하지 않는다.
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const renderWidth = isMobile ? Math.ceil(width * 1.3) : width;
    return ansiColor(fg) + '─'.repeat(renderWidth) + ANSI_RESET;
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
    const leftText = truncateDisplayText(leftLabel, rightLabel ? Math.max(0, rightStart - 2) : targetWidth);
    const leftWidth = displayWidth(leftText);
    const minCenterStart = leftText ? leftWidth + 1 : 0;
    const maxCenterWidth = Math.max(0, (rightLabel ? rightStart - 1 : targetWidth) - minCenterStart);
    const centerText = truncateDisplayText(centerLabel, maxCenterWidth);
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

  return {
    ANSI_BOLD,
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    ansiHLine,
    displayWidth,
    estimatePostPageCount,
    fitCell,
    formatLongDate,
    formatShortDate,
    highlightText,
    normalizeHeaderSegment,
    truncateDisplayText,
    wrapAnsiText
  };
}
