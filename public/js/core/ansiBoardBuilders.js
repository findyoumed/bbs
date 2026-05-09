import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createBoardAnsiBuilders(deps) {
  const {
    compareDoor,
    getBoardCode,
    getBoardDisplayName,
    getBoardDoor
  } = deps;
  const {
    ANSI_BOLD,
    ANSI_RESET,
    ansiColor,
    buildPageLabel,
    buildTopHeader,
    ansiHLine,
    estimatePostPageCount,
    fitCell,
    formatLongDate,
    formatShortDate,
    wrapAnsiText
  } = createAnsiBuilderUtils(deps);

  // [LOG: 20260410_1330] ANSI 화면 빌더를 board/service 단위로 재분리
  function buildMainMenuAnsi(title, entries, stats = null) {
    void title;
    const sortedEntries = (entries || [])
      .slice()
      .sort((left, right) => compareDoor(left?.door, right?.door));
    const parts = [buildTopHeader(['초기화면'])];
    sortedEntries.forEach((entry) => {
      const door = String(entry?.door || '').trim().padStart(2, ' ');
      const label = String(entry?.title || entry?.label || '메뉴').trim();
      parts.push(ansiColor(15) + `${door}. ${label}` + ANSI_RESET);
    });

    if (!sortedEntries.length) {
      parts.push(ansiColor(8) + ' 등록된 메뉴가 없습니다.' + ANSI_RESET);
    }

    /* [LOG: 20260425_2140] 사용자 요청으로 시스템 통계 요약 제거 
    if (stats) {
      parts.push('');
      parts.push(ansiHLine(80, 8));
      const statsLine = ansiColor(14) + ' [시스템 상태]' + ANSI_RESET +
        ansiColor(8) + '  회원:' + ANSI_RESET + ansiColor(15) + stats.nummembers + ANSI_RESET +
        ansiColor(8) + '  접속:' + ANSI_RESET + ansiColor(15) + stats.numconns + ANSI_RESET +
        ansiColor(8) + '  전체글:' + ANSI_RESET + ansiColor(15) + stats.numarticles + ANSI_RESET +
        ansiColor(8) + '  오늘:' + ANSI_RESET + ansiColor(11) + stats.todaynumarticles + ANSI_RESET;
      parts.push(statsLine);
    }
    */

    return parts.join('\n');
  }

  function buildPostListAnsi(board, posts, page, totalPages, totalCount, contextTitle = '', searchParams = {}) {
    void contextTitle;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = getBoardDisplayName(board);
    const boardCode = getBoardCode(board);
    const startIndex = posts.length ? ((page - 1) * 15) + 1 : 0;
    const endIndex = posts.length ? startIndex + posts.length - 1 : 0;
    const pageLabel = buildPageLabel(page, totalPages);
    const countLine = totalCount
      ? `${startIndex}-${endIndex}/${totalCount} ( 총 ${totalCount}건 )`
      : `${page}/${totalPages} page`;

    const highlightTerm = String(searchParams.lt || '').trim();

    function columnHeader() {
      // [LOG: 20260427_1200] Shorten column header for mobile
      if (isMobile) {
        return ansiColor(14) + ' 번호   ID     날짜  제  목' + ANSI_RESET;
      }
      return ansiColor(14) + ' 번호   이름       ID      날짜  조회 Pg    제  목' + ANSI_RESET;
    }

    function postLine(post) {
      if (isMobile) {
        const titlePrefix = Number(post.step || 0) > 0 ? '└ ' : '';
        const rawTitle = titlePrefix + String(post.title || '');
        const highlightedTitle = highlightText(rawTitle, highlightTerm, 14, 15);
        // Mobile row budget: targetCols - (postId:6 + userId:8 + date:5 + spaces:3) = 44 - 22 = 22
        const title = fitCell(highlightedTitle, 22);

        const userId = fitCell(post.userId || post.authorUserId || '', 8);
        const date = fitCell(formatShortDate(post.createdAt).slice(0, 5), 5);
        const postId = fitCell(String(post.id || ''), 6, 'right');

        return ansiColor(15) + postId + ' ' +
          ansiColor(11) + userId + ' ' +
          ansiColor(8) + date + ' ' +
          ansiColor(15) + title +
          ANSI_RESET;
      }

      const titlePrefix = Number(post.step || 0) > 0 ? '└ ' : '';
      const rawTitle = titlePrefix + String(post.title || '');
      const highlightedTitle = highlightText(rawTitle, highlightTerm, 14, 15);
      const title = fitCell(highlightedTitle, 36);

      const author = fitCell(post.nickName || post.authorNickName || '', 8);
      const userId = fitCell(post.userId || post.authorUserId || '', 8);
      const date = fitCell(formatShortDate(post.createdAt), 5);
      const hits = fitCell(String(post.hit || post.views || 0), 4, 'right');
      const pages = fitCell(String(estimatePostPageCount(post)), 2, 'right');
      const postId = fitCell(String(post.id || ''), 6, 'right');

      return ansiColor(15) + postId + ' ' +
        ansiColor(15) + author + ' ' +
        ansiColor(11) + userId + ' ' +
        ansiColor(8) + date + ' ' +
        ansiColor(8) + hits + ' ' +
        ansiColor(8) + pages + '  ' +
        ansiColor(15) + title +
        ANSI_RESET;
    }

    const parts = [
      buildTopHeader({ leftLabel: boardCode, centerLabel: boardName }, pageLabel, targetCols),
      ansiColor(8) + countLine + ANSI_RESET,
      columnHeader(),
      ansiHLine(targetCols, 8)
    ];
    if (!posts.length) {
      parts.push(ansiColor(8) + ' 등록된 글이 없습니다.' + ANSI_RESET);
    } else {
      posts.slice(0, 15).forEach((post) => parts.push(postLine(post)));
    }

    return parts.join('\n');
  }

  function buildPostViewAnsi(board, post, totalCount, canEdit, isGuest, searchParams = {}) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = getBoardDisplayName(board);
    const boardCode = getBoardCode(board);
    const author = String(post?.nickName || post?.authorNickName || post?.author || '').trim();
    const authorId = String(post?.userId || post?.authorUserId || '').trim();
    const rawTitle = String(post?.title || '').trim();
    const highlightTerm = String(searchParams.lt || '').trim();
    const title = highlightText(rawTitle, highlightTerm, 14, 15);

    const metaNumber = `#${post?.id || ''}/${totalCount || '?'}`;
    const metaDate = isMobile ? formatShortDate(post?.createdAt || '') : formatLongDate(post?.createdAt || '');
    const metaHits = `조회:${post?.hit || post?.views || 0}`;
    const metaRecom = `추천:${post?.recommend || post?.recommends || 0}`;
    const metaFile = (post?.attachments?.length > 0) ? `${ansiColor(11)} [U] 첨부파일: ${post.attachments.length}개${ANSI_RESET}` : '';

    const rawContent = post?.content || post?.body || '';
    const highlightedContent = highlightText(rawContent, highlightTerm, 14, 15);
    const contentLines = wrapAnsiText(highlightedContent, targetCols);

    const parts = [buildTopHeader(['게시판', boardCode ? `${boardName} (${boardCode})` : boardName, '글읽기'], '', targetCols)];

    parts.push(ansiColor(14) + '제목 : ' + ansiColor(15) + title + ANSI_RESET);

    if (isMobile) {
      parts.push(ansiColor(8) + metaNumber + ' ' + author + (authorId ? `(${authorId})` : '') + ANSI_RESET);
      parts.push(ansiColor(8) + `${metaDate} ${metaHits} ${metaRecom}` + metaFile + ANSI_RESET);
    } else {
      parts.push(
        ansiColor(8) + fitCell(metaNumber, 13) +
        ansiColor(14) + ' 보낸이 : ' +
        ansiColor(15) + fitCell(author, 8) +
        (authorId ? ` (${authorId})` : '') + '  ' +
        ansiColor(8) + `${metaDate}  ${metaHits}  ${metaRecom}` +
        metaFile +
        ANSI_RESET
      );
    }
    parts.push(ansiHLine(targetCols, 8));
    contentLines.forEach((line) => {
      parts.push(ansiColor(15) + line + ANSI_RESET);
    });

    return parts.join('\n');
  }

  function buildBoardSelectAnsi(boards, titleOrOptions) {
    const options = titleOrOptions && typeof titleOrOptions === 'object' && !Array.isArray(titleOrOptions)
      ? titleOrOptions
      : { title: titleOrOptions };
    const titlePath = Array.isArray(options.titlePath)
      ? options.titlePath
      : [options.title || '메뉴'];
    const parts = [buildTopHeader(titlePath, options.pageLabel || '')];

    boards.forEach((board) => {
      const door = String(board?.door || getBoardDoor(board) || '').padStart(2, ' ');
      const label = String(board?.label || board?.name || getBoardDisplayName(board) || '메뉴').trim();
      const code = String(board?.code || '').trim();
      const line = `${door}. ${label}`;
      const suffix = code && !label.toUpperCase().includes(`(${code.toUpperCase()})`) ? `(${code})` : '';

      parts.push(
        ansiColor(15) + line +
        (suffix ? ' ' + ansiColor(8) + suffix : '') +
        ANSI_RESET
      );
    });

    if (!boards.length) {
      parts.push(ansiColor(8) + ' 등록된 게시판이 없습니다.' + ANSI_RESET);
    }

    return parts.join('\n');
  }

  function buildAttachmentListAnsi(attachments) {
    const parts = [];
    parts.push(ansiColor(14) + '┌────────────────────────────────────────────────────────────────────────────┐' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(15) + ANSI_BOLD + fitCell('첨부 파일 목록 (PDS LIST)', 74, 'center') + ANSI_RESET + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '├────────────────────────────────────────────────────────────────────────────┤' + ANSI_RESET);

    if (!attachments || attachments.length === 0) {
      parts.push(ansiColor(14) + '│ ' + ansiColor(8) + fitCell('첨부된 파일이 없습니다.', 74, 'center') + ansiColor(14) + ' │' + ANSI_RESET);
    } else {
      attachments.forEach((file, idx) => {
        const num = String(idx + 1).padStart(2);
        const name = fitCell(file.originalFilename || file.filename || '', 40);
        const size = fitCell(`${Math.round(file.fileSize / 1024)} KB`, 10, 'right');
        parts.push(ansiColor(14) + '│ ' + ansiColor(11) + num + '. ' + ansiColor(15) + name + ' ' + ansiColor(8) + size + ' '.repeat(19) + ansiColor(14) + ' │' + ANSI_RESET);
      });
    }

    parts.push(ansiColor(14) + '└────────────────────────────────────────────────────────────────────────────┘' + ANSI_RESET);
    return parts.join('\n');
  }

  return {
    buildBoardSelectAnsi,
    buildMainMenuAnsi,
    buildPostListAnsi,
    buildPostViewAnsi,
    buildAttachmentListAnsi
  };
}
