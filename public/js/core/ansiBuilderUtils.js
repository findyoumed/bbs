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

    for (const ch of source) {
      const charWidth = isWideChar(ch) ? 2 : 1;
      if (width + charWidth > maxWidth) {
        break;
      }
      result += ch;
      width += charWidth;
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
      '뉴스/인물': 'NEWS',
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

    const isSmall = targetWidth < 50;
    const brand = 'PC통신동호회 01410';
    const { leftLabel, centerLabel, rightLabel } = resolveHeaderLabels(titlePath, pageLabel);

    // [LOG: 20260427_1150] Shorten timestamp on mobile to fit the line
    const timestampText = buildHeaderTimestamp();
    const timestamp = (isSmall && timestampText.includes(' ')) ? timestampText.split(' ')[1].slice(0, 5) : timestampText;
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

      for (const ch of rawLine) {
        const charWidth = isWideChar(ch) ? 2 : 1;
        if (currentWidth + charWidth > width) {
          lines.push(current);
          current = '';
          currentWidth = 0;
        }
        current += ch;
        currentWidth += charWidth;
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
