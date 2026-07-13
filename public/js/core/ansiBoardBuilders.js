import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createBoardAnsiBuilders(deps) {
  const {
    compareDoor,
    getBoardCode,
    getBoardDisplayName,
    getBoardDoor,
    state
  } = deps;
  const {
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
    wrapAnsiText
  } = createAnsiBuilderUtils(deps);

  // [LOG: 20260410_1330] ANSI 화면 빌더를 board/service 단위로 재분리
  // [LOG_ID: 20260712_2150] 하이텔 원전(길라잡이 그림 5.1) 재현: 초기 메뉴를 데스크톱에서 2열
  // 행 우선(1,2 / 3,4 …) 배치 + 행 사이 빈 줄로 화면을 채우고, 하단에 반전 배너 한 줄을 둔다
  // (원전: "하이텔 고속서비스 접속번호 'go con'"). 종전 1열 8항목은 화면 대부분이 공백이었다.
  // 모바일(44칸)은 폭이 좁아 기존 1열을 유지한다. 핫스팟은 buildMenuHotspotsFromRows가 텍스트
  // 스캔("door. " 마커, 같은 줄 복수 탐지)이라 2열에서도 항목별로 정상 생성된다.
  function buildMainMenuAnsi(title, entries, stats = null, noticeText = null) {
    void title;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    // [LOG_ID: 20260713_1155] 나우누리 테마 모드인 경우 나우누리식 전용 대문(TOP) 렌더링
    if (state && state.theme === 'nownuri') {
      return buildNownuriMainMenuAnsi(targetCols, noticeText);
    }

    const sortedEntries = (entries || [])
      .slice()
      .sort((left, right) => compareDoor(left?.door, right?.door));
    const parts = [buildTopHeader(['초기화면'])];

    const entryText = (entry) => {
      const door = String(entry?.door || '').trim().padStart(2, ' ');
      const label = String(entry?.title || entry?.label || '메뉴').trim();
      return `${door}. ${label}`;
    };

    // [LOG_ID: 20260713_1010] 사용자 요청으로 초기 메뉴 2열 배치에서 이전 1열 세로형 배치로 복원
    sortedEntries.forEach((entry) => {
      parts.push(' ' + ansiColor(15) + entryText(entry) + ANSI_RESET);
    });

    if (!sortedEntries.length) {
      parts.push(ansiColor(8) + ' 등록된 메뉴가 없습니다.' + ANSI_RESET);
    }

    if (noticeText) {
      parts.push('');
      // [LOG_ID: 20260712_2200] 작은공지 영역 렌더링
      const prefix = '[작은공지] ';
      const titleOnly = noticeText.startsWith(prefix) ? noticeText.slice(prefix.length) : noticeText;
      const goToken = '(GO NOTICE)';
      const prefixLen = displayWidth(prefix);
      const goLen = displayWidth(goToken);
      const remaining = targetCols - prefixLen - goLen - 2;
      const fitTitle = fitCell(titleOnly, remaining).trim();
      const dotCount = Math.max(2, remaining - displayWidth(fitTitle));
      const formattedNotice = `${prefix}${fitTitle}${'.'.repeat(dotCount)}${goToken}`;
      parts.push(ansiColor(11) + formattedNotice + ANSI_RESET);
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

  function buildPostListAnsi(board, posts, page, totalPages, totalCount, contextTitle = '', searchParams = {}, memberBanner = null) {
    void contextTitle;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = getBoardDisplayName(board);
    const boardCode = getBoardCode(board);
    const startIndex = posts.length ? ((page - 1) * 15) + 1 : 0;
    const endIndex = posts.length ? startIndex + posts.length - 1 : 0;
    const pageLabel = buildPageLabel(page, totalPages);
    // [LOG: 20260707_1500] 건수가 없을 때 "1/1 page" 폴백은 상단바 페이지 라벨 (01/01)과
    // 중복 표기라 제거 — 빈 줄로 레이아웃(줄 수)만 유지한다.
    const countLine = totalCount
      ? `${startIndex}-${endIndex}/${totalCount} ( 총 ${totalCount}건 )`
      : '';

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

    if (memberBanner) {
      // [LOG_ID: 20260712_2200] 동호회 신분 배너 한 줄 삽입
      const bannerLine = fitCell(memberBanner, targetCols, 'left');
      parts.push(ansiColor(14) + bannerLine + ANSI_RESET);
      parts.push(ansiHLine(targetCols, 8));
    }

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

    // [LOG_ID: 20260712_2050] 하이텔 원전(길라잡이 그림 5.5) 재현: 글읽기 상단바는 'READ/글읽기'가
    // 아니라 게시판명('큰마을 (PLAZA)')이다 — 어느 게시판의 글인지 화면에서 사라지던 문제도 함께
    // 해소되고, 목록(125행)과 동일한 config 방식이라 목록↔글읽기 전환 시 상단바가 흔들리지 않는다.
    const parts = [buildTopHeader({ leftLabel: boardCode || 'READ', centerLabel: boardName }, '', targetCols)];

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
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const innerWidth = targetCols - 4;

    // [LOG_ID: 20260708_1030] 다른 화면과 동일하게 buildTopHeader로 정통 상단바(로고 박스+실시간 시계)를
    // 갖춘다. 자체 박스 제목 줄만 쓰던 기존 방식은 renderAnsiScreenWithTopbar가 아닌 맨 ansiToHTML로만
    // 그려져 상단바가 통째로 빠진 채 렌더링됐다.
    const parts = [buildTopHeader({ leftLabel: 'PDS', centerLabel: '첨부 파일 목록' }, '', targetCols)];
    parts.push(ansiColor(14) + '┌' + '─'.repeat(targetCols - 2) + '┐' + ANSI_RESET);

    if (!attachments || attachments.length === 0) {
      parts.push(ansiColor(14) + '│ ' + ansiColor(8) + fitCell('첨부된 파일이 없습니다.', innerWidth, 'center') + ansiColor(14) + ' │' + ANSI_RESET);
    } else {
      attachments.forEach((file, idx) => {
        const num = String(idx + 1).padStart(2);
        const nameWidth = innerWidth - 2 - 2 - 1 - 10;
        const name = fitCell(file.originalFilename || file.filename || '', nameWidth);
        const size = fitCell(`${Math.round(file.fileSize / 1024)} KB`, 10, 'right');
        parts.push(ansiColor(14) + '│ ' + ansiColor(11) + num + '. ' + ansiColor(15) + name + ' ' + ansiColor(8) + size + ansiColor(14) + ' │' + ANSI_RESET);
      });
    }

    parts.push(ansiColor(14) + '└' + '─'.repeat(targetCols - 2) + '┘' + ANSI_RESET);
    return parts.join('\n');
  }

  // [LOG_ID: 20260713_1155] 나우누리 전용 대문 ANSI 생성 함수
  function buildNownuriMainMenuAnsi(targetCols, noticeText) {
    const parts = [];
    
    // 나우누리 로고 타이틀 헤더
    parts.push(ansiColor(14) + 'NowNuri Simulation 1.0' + ANSI_RESET + '  WMAIL                       자료-편지                   ☏ 02-590-3800');
    parts.push('이용해 주셔서 감사합니다.(도움말(H) 입력)');
    parts.push('');
    parts.push('      ' + ansiColor(15) + '1. 서비스안내' + ANSI_RESET + '        ' + ansiColor(15) + '2. 나우로' + ANSI_RESET + '          ' + ansiColor(15) + '3. BOOK-NET' + ANSI_RESET);
    parts.push('');
    parts.push('     [ 서비스 ]           [ 안내 ]           [ 인터넷 ]');
    parts.push('');
    parts.push('     ' + ansiColor(15) + '11. 편지' + ANSI_RESET + '             ' + ansiColor(15) + '21. 뉴스/일반' + ANSI_RESET + '      ' + ansiColor(15) + '31. 인터넷' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '12. 게시판' + ANSI_RESET + '           ' + ansiColor(15) + '22. 토론/동호회' + ANSI_RESET + '    ' + ansiColor(15) + '32. 홈빌더' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '13. 대화실' + ANSI_RESET + '           ' + ansiColor(15) + '23. 정보/문화' + ANSI_RESET + '      ' + ansiColor(15) + '33. 홈쇼핑' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '14. 동호회' + ANSI_RESET + '           ' + ansiColor(15) + '24. 생활/경제' + ANSI_RESET + '      ' + ansiColor(15) + '34. 게임/오락' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '15. 모임' + ANSI_RESET + '             ' + ansiColor(15) + '25. 컴퓨터/통신' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '16. 자료실' + ANSI_RESET + '           ' + ansiColor(15) + '26. 교육/학습' + ANSI_RESET + '      [ 안내 ]');
    parts.push('     ' + ansiColor(15) + '17. 인터넷' + ANSI_RESET + '           ' + ansiColor(15) + '27. 어린이/청소년' + ANSI_RESET + '  ' + ansiColor(15) + '41. 나우맵' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '18. 게임' + ANSI_RESET + '             ' + ansiColor(15) + '28. 스포츠' + ANSI_RESET);
    parts.push('     ' + ansiColor(15) + '19. 정보' + ANSI_RESET + '             ' + ansiColor(15) + '29. 나우누리 CUG' + ANSI_RESET + '   ' + ansiColor(15) + '51. 인터넷' + ANSI_RESET);
    parts.push('');

    // 작은공지 영역 렌더링
    if (noticeText) {
      const prefix = '[작은공지] ';
      const titleOnly = noticeText.startsWith(prefix) ? noticeText.slice(prefix.length) : noticeText;
      const goToken = '(GO NOTICE)';
      const prefixLen = displayWidth(prefix);
      const goLen = displayWidth(goToken);
      const remaining = targetCols - prefixLen - goLen - 2;
      const fitTitle = fitCell(titleOnly, remaining).trim();
      const dotCount = Math.max(2, remaining - displayWidth(fitTitle));
      const formattedNotice = `${prefix}${fitTitle}${'.'.repeat(dotCount)}${goToken}`;
      parts.push(ansiColor(11) + formattedNotice + ANSI_RESET);
    }

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
