import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { shouldDisplayNewsArticleImage } from './newsPhotoArticleUtils.js';

export function createNewsAnsiBuilders(deps) {
  const {
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    ansiHLine,
    displayWidth,
    fitCell,
    formatLongDate,
    formatShortDate,
    wrapAnsiText
  } = createAnsiBuilderUtils(deps);

  const NEWS_LIST_PAGE_SIZE = 15;
  const HEADLINE_TRUNCATION_SUFFIX = '..';
  const DATE_COLUMN_GUARD_COLS = 1;
  // [LOG: 20260707_1528] 뉴스 화면은 웹 topbar와 footer까지 한 터미널 프레임 안에 들어가야 한다.
  // 24줄 패딩은 PC 화면에서 #terminal-screen의 세로 overflow를 만들었으므로 본문은 23줄로 고정한다.
  const NEWS_SCREEN_TOTAL_LINES = 23;

  function padPartsToScreenHeight(parts) {
    let lineCount = parts.reduce((sum, part) => sum + String(part).split('\n').length, 0);
    while (lineCount < NEWS_SCREEN_TOTAL_LINES) {
      // 렌더러(renderAnsiScreenWithTopbar*)가 본문 꼬리를 trimEnd()로 잘라내므로,
      // 공백이 아닌 ANSI 리셋 시퀀스로 채워 빈 줄이 살아남게 한다. (화면에는 빈 줄로 렌더)
      parts.push(ANSI_RESET);
      lineCount += 1;
    }
    return parts;
  }

  function writeDisplayText(cells, startCol, text) {
    const source = String(text || '');
    let cursor = Math.max(0, Number(startCol) || 0);

    for (const ch of source) {
      const charWidth = deps.isWideChar(ch) ? 2 : 1;
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

  function readDisplayCells(cells, startCol, endCol) {
    return cells
      .slice(Math.max(0, startCol), Math.max(0, endCol))
      .filter((cell) => cell !== '')
      .join('');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeHeadlineText(text, sourceTitle = '') {
    let headline = String(text || '').replace(/\s+/g, ' ').trim();
    const source = String(sourceTitle || '').replace(/\s+/g, ' ').trim();

    if (!headline || !source) {
      return headline;
    }

    const escapedSource = escapeRegExp(source);
    headline = headline
      .replace(new RegExp(`^\\[\\s*${escapedSource}\\s*\\]\\s*`), '')
      .replace(new RegExp(`^${escapedSource}\\s*[:|\\-]\\s*`), '')
      .trim();

    return headline;
  }

  function normalizeTerminalHeadlineText(text) {
    // [LOG: 20260428_2218] 터미널 폰트 fallback으로 날짜 컬럼이 밀리지 않도록 비표준 문장부호를 ASCII로 정규화
    // [LOG: 20260428_2222] RSS 제목에 섞이는 zero-width/bidi formatting 문자를 제거해 날짜 컬럼 밀림을 방지
    return String(text || '')
      .replace(/[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF\uFFF0-\uFFF8]/g, '')
      .replace(/\u2026/g, '...')
      .replace(/[\u2018\u2019\u201B\u2032]/g, '\'')
      .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
      .replace(/[\u223C\u301C\uFF5E]/g, '~')
      .replace(/[\u3008\u300A]/g, '<')
      .replace(/[\u3009\u300B]/g, '>')
      .replace(/[\u2460-\u2468]/g, (ch) => String(ch.codePointAt(0) - 0x245F))
      .replace(/\u2469/g, '10')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fitHeadlineCell(text, maxWidth) {
    const width = Math.max(0, Number(maxWidth) || 0);
    const source = String(text || '').replace(/\s+/g, ' ').trim();

    if (width <= 0) {
      return '';
    }
    if (displayWidth(source) <= width) {
      return fitCell(source, width);
    }
    if (width <= HEADLINE_TRUNCATION_SUFFIX.length) {
      return fitCell(source, width);
    }

    const clipped = fitCell(source, width - HEADLINE_TRUNCATION_SUFFIX.length).replace(/\s+$/g, '');
    return fitCell(`${clipped}${HEADLINE_TRUNCATION_SUFFIX}`, width);
  }

  function buildNewsListTitle(topic) {
    const topicTitle = String(topic || '').replace(/\s+/g, ' ').trim();
    if (!topicTitle) {
      return '오늘의 주요기사';
    }
    if (topicTitle.startsWith('오늘의 주요기사')) {
      return topicTitle;
    }
    return `오늘의 주요기사-${topicTitle}`;
  }

  function buildNewsListAnsi(topic, articles, pageNo = 1) {
    // [LOG: 20260426_2345] Adaptive layout: Use 44 columns for mobile portrait
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const items = Array.isArray(articles) ? articles : [];
    const pageCount = Math.max(1, Math.ceil(Math.max(1, items.length) / NEWS_LIST_PAGE_SIZE));
    const currentPage = Math.min(Math.max(Number.parseInt(pageNo, 10) || 1, 1), pageCount);
    const pageOffset = (currentPage - 1) * NEWS_LIST_PAGE_SIZE;
    const visibleItems = items.slice(pageOffset, pageOffset + NEWS_LIST_PAGE_SIZE);
    const pageLabel = buildPageLabel(currentPage, pageCount);

    const titleStartCol = isMobile ? 5 : 6;
    const dateWidth = 8;
    const dateStartCol = Math.max(titleStartCol + 10, targetCols - dateWidth);
    const titleMaxWidth = Math.max(8, dateStartCol - titleStartCol - 1 - DATE_COLUMN_GUARD_COLS);
    const headerCells = Array.from({ length: targetCols }, () => ' ');

    // [LOG: 20260506_1123] Match the NowNuri news list header without changing article loading or hotspots.
    writeDisplayText(headerCells, 0, '번호');
    writeDisplayText(headerCells, titleStartCol, '제목');
    writeDisplayText(headerCells, dateStartCol, '제공일');

    const parts = [
      buildTopHeader({ leftLabel: 'NEWS', centerLabel: buildNewsListTitle(topic) }, pageLabel, targetCols),
      ansiColor(15) + headerCells.filter((cell) => cell !== '').join('') + ANSI_RESET,
      ansiHLine(targetCols, 8)
    ];

    visibleItems.forEach((article, index) => {
      const articleNo = article?.no || (pageOffset + index + 1);
      const numPart = `${String(articleNo).padStart(3)} `;
      const dateText = formatShortDate(article.date || article.dateTime || '');
      const headline = normalizeTerminalHeadlineText(
        normalizeHeadlineText(article.title || '', article.sourceTitle)
      );
      const cells = Array.from({ length: targetCols }, () => ' ');
      const title = fitHeadlineCell(headline, titleMaxWidth);

      // [LOG: 20260430_2030] 제목 길이와 무관하게 날짜를 우측 고정 컬럼에 배치한다.
      writeDisplayText(cells, 0, numPart);
      writeDisplayText(cells, titleStartCol, title);
      writeDisplayText(cells, dateStartCol, dateText);

      const prefixSegment = readDisplayCells(cells, 0, titleStartCol);
      const titleSegment = readDisplayCells(cells, titleStartCol, dateStartCol);
      const dateSegment = readDisplayCells(cells, dateStartCol, targetCols);
      const row = `${ansiColor(11)}${prefixSegment}${ANSI_RESET}${ansiColor(15)}${titleSegment}${ANSI_RESET}${ansiColor(8)}${dateSegment}${ANSI_RESET}`;
      parts.push(row);
    });


    return {
      items: visibleItems,
      pageCount,
      pageNo: currentPage,
      pageSize: NEWS_LIST_PAGE_SIZE,
      text: padPartsToScreenHeight(parts).join('\n')
    };
  }

  function buildNewsArticleAnsi(topic, article, pageNo = 1, options = {}) {
    // [LOG_ID: 20260710_1530] fullView: PR(복사) 시 PC통신 갈무리처럼 본문 전체를
    // 페이지 분할 없이 한 번에 출력하는 모드.
    const fullView = options?.fullView === true;
    // [LOG: 20260426_2345] Adaptive layout: Use 44 columns for mobile portrait
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [];
    const articleTitle = normalizeTerminalHeadlineText(
      normalizeHeadlineText(article?.title || '', article?.sourceTitle)
    );

    // Title wrapping: targetCols - 6 (label "제목: ")
    const titleLines = wrapAnsiText(articleTitle, Math.max(10, targetCols - 6));

    // [LOG: 20260615_1748] Render fallback guidance ONLY when there is no media content (image/video) and the body is extremely short.
    // [LOG_ID: 20260709_1320] 기사 최소 본문 제한인 30자 기준을 고려하여, 불러오기 실패 경고 출력 기준을 40자 미만으로 완화함.
    let bodyText = String(article?.body || article?.description || '').trim();
    // [LOG_ID: 20260709_1500] 이메일 주소 제거: 뉴시스 등 일부 언론사가 본문에 삽입하는 이메일 및 [email protected] 템플릿 제거.
    // [LOG_ID: 20260709_1550] 픽사베이 등 사진 출처 문구 제거.
    // [LOG_ID: 20260709_1620] 조회수 및 영문 기사 보기 문구 제거.
    // [LOG_ID: 20260709_1627] 재생목록 및 바로가기 관련 노이즈 문구 제거.
    bodyText = bodyText.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '')
                       .replace(/\[email&#160;protected\]|\[email\s*protected\]/gi, '')
                       .replace(/\[\s*픽사베이\s*\]|\(\s*사진\s*=\s*픽사베이\s*\)/gi, '')
                       .replace(/조회\s*\n?\s*조회수/gi, '')
                       .replace(/영문\s*기사\s*보기\s*\(View\s*English\s*Article\)/gi, '')
                       .replace(/(?:본문\s*바로가기|메뉴\s*바로가기|달력보기|전체재생|상세\s*기사보기|재생목록|연속재생)/gi, '')
                       // [LOG_ID: 20260710_1230] \s{2,}는 줄바꿈까지 삼켜 단락 구분(\n\n)이 공백 한 칸으로
                       // 뭉개지는 부작용이 있었다(본문 전체가 한 덩어리로 붙어 가독성 저하). 가로 공백만
                       // 축약하고 줄바꿈은 보존하되, 3연속 이상만 단락 구분(\n\n)으로 정리한다.
                       .replace(/[ \t]+\n/g, '\n')
                       .replace(/\n{3,}/g, '\n\n')
                       .replace(/[ \t]{2,}/g, ' ')
                       .trim();


    // [LOG_ID: 20260710_1330] 속보 스텁("후속기사가 이어집니다")은 로드 실패가 아니라 본문 전체가
    // 그 한 줄인 정상 기사이므로 "불러오지 못했습니다" 안내를 붙이지 않는다.
    const isBreakingStubBody = /후속\s*기사가?\s*이어집니다/.test(bodyText);
    if (!shouldDisplayNewsArticleImage(article) && bodyText.length < 40 && !isBreakingStubBody) {
      bodyText += '\n\n' + '[상세 본문을 불러오지 못했습니다. 하단의 \'원문\' 링크를 클릭하여 전체 기사를 확인해 주세요.]';
    }
    const bodyLines = wrapAnsiText(bodyText, targetCols);


    const source = String(article?.sourceTitle || '').trim();
    const date = formatLongDate(article?.dateTime || article?.date || '');
    const hasImage = shouldDisplayNewsArticleImage(article);
    const sourceLink = String(article?.link || '').trim();
    const sourceLinkLines = sourceLink
      ? wrapAnsiText(`원문: ${sourceLink}`, targetCols)
      : [];

    const metaParts = [
      source ? `출처: ${source}` : '',
      date ? `일시: ${date}` : ''
    ].filter(Boolean);

    // Meta info: One per line on mobile to prevent ugly splitting
    let headerLineCount = titleLines.length + 1; // +1 for HLine
    if (isMobile) {
      headerLineCount += metaParts.length;
    } else {
      headerLineCount += metaParts.length ? 1 : 0;
    }

    const lastPageFooterLines = sourceLinkLines.length + 1;

    // [LOG: 20260615_1720] 페이지별 가용 라인 수 시뮬레이션 분할 로직 구현
    // [LOG_ID: 20260710_1530] fullView 모드는 분할 없이 본문 전체를 한 페이지로 출력한다.
    const pages = [];
    if (fullView) {
      pages.push(bodyLines);
    } else {
      let currentLineIdx = 0;
      const totalBodyLines = Math.max(1, bodyLines.length);

      while (currentLineIdx < totalBodyLines) {
        const pageIdx = pages.length; // 0-based page index
        const isFirstPage = pageIdx === 0;
        const baseLines = isFirstPage
          ? Math.max(5, Math.max(10, 18 - (hasImage ? (isMobile ? 5 : 7) : 0)) - headerLineCount)
          : Math.max(5, 18 - headerLineCount);

        // 마지막 페이지인지 판별 (남은 줄이 현재 페이지 가용 기본 줄 수 이하인 경우)
        const isLastPage = (totalBodyLines - currentLineIdx) <= baseLines;
        const allowedLines = isLastPage ? Math.max(3, baseLines - lastPageFooterLines) : baseLines;

        const chunk = bodyLines.slice(currentLineIdx, currentLineIdx + allowedLines);
        pages.push(chunk);
        currentLineIdx += chunk.length;
      }
    }

    const pageCount = pages.length;
    const currentPage = fullView ? 1 : Math.min(Math.max(Number.parseInt(pageNo, 10) || 1, 1), pageCount);
    const visibleBodyLines = pages[currentPage - 1] || [];
    const pageLabel = fullView ? '(전체)' : buildPageLabel(currentPage, pageCount);

    // Pass targetCols to top header
    parts.push(buildTopHeader(topic ? ['뉴스', topic, '기사 읽기'] : ['뉴스', '기사 읽기'], pageLabel, targetCols));

    titleLines.forEach((line, index) => {
      const label = index === 0 ? '제목: ' : '      ';
      parts.push(ansiColor(14) + label + ansiColor(15) + line + ANSI_RESET);
    });

    if (metaParts.length) {
      if (isMobile) {
        metaParts.forEach(part => {
          parts.push(ansiColor(8) + part + ANSI_RESET);
        });
      } else {
        parts.push(ansiColor(8) + metaParts.join('  ') + ANSI_RESET);
      }
    }

    parts.push(ansiHLine(targetCols, 8));

    visibleBodyLines.forEach((line) => {
      parts.push(ansiColor(15) + line + ANSI_RESET);
    });

    if (currentPage >= pageCount) {
      sourceLinkLines.forEach((line) => {
        parts.push(ansiColor(8) + line + ANSI_RESET);
      });
      // [LOG_ID: 20260710_1530] fullView(갈무리)에서는 복사 완료 텍스트 안내 및 엔터 복귀 안내를 출력한다.
      if (fullView) {
        parts.push(ansiColor(10) + '◆ 기사 본문 전체가 클립보드에 복사되었습니다.' + ANSI_RESET);
        parts.push(ansiColor(14) + '[엔터]를 누르면 페이지 보기로 돌아갑니다' + ANSI_RESET);
      } else {
        parts.push(ansiColor(14) + '마지막 페이지입니다' + ANSI_RESET);
      }
    }

    return {
      pageCount,
      pageNo: currentPage,
      text: padPartsToScreenHeight(parts).join('\n')
    };
  }

  return {
    buildNewsArticleAnsi,
    buildNewsListAnsi
  };
}
