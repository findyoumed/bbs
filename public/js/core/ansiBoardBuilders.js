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
    // 목록의 '쪽' 컬럼 — 글이 몇 화면 분량인지. 하이텔/나우누리 원전 목록에 모두 있다.
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

  function buildPostListAnsi(board, posts, page, totalPages, totalCount, contextTitle = '', searchParams = {}) {
    void contextTitle;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const boardName = getBoardDisplayName(board);
    const boardCode = getBoardCode(board);
    const pageLabel = buildPageLabel(page, totalPages);

    // [LOG_ID: 20260718_1000] 원전(hitel_upgrade_plan U-3)은 게시판명·총건수·페이지가 **한 줄**이다:
    //   나우누리: `PCMARKET          나우장터-컴퓨터/주변기기 (총 19227건)                 1/1282`
    //   하이텔  : `큰마을 (PLAZA)  11100/12801 (총 3357건)`
    // 우리는 상단바 아래에 `1-7/7 ( 총 7건 )` 라는 **별도 줄**을 하나 더 쓰고 있었다.
    // U-3에 "우리 방식이 더 명확 — 변경 보류"로 남겨뒀던 항목인데, 사용자가 원전 일치를
    // 요구해 정리한다: 총건수를 상단바의 게시판명 옆으로 합치고 별도 줄을 없앤다.
    // (표시 범위 "1-7"은 페이지 라벨 (01/01)이 이미 같은 정보를 주므로 버린다.)
    //
    // 단, 상단바 가운데 칸에 안 들어가면 buildTopHeader가 잘라버려 "(총 3건)"이 "("처럼
    // 쓰레기 문자로 남는다(모바일 44칸 + 긴 게시판명에서 실제로 재현). 들어갈 때만 붙인다.
    const countSuffix = totalCount ? ` (총 ${totalCount}건)` : '';
    const centerBudget = targetCols - displayWidth(boardCode) - displayWidth(pageLabel) - 4;
    const centerLabel = (countSuffix && displayWidth(boardName + countSuffix) <= centerBudget)
      ? boardName + countSuffix
      : boardName;

    const highlightTerm = String(searchParams.lt || '').trim();

    // [LOG_ID: 20260718_1200] 자료실(PDS) 목록은 원전처럼 파일 정보를 보여준다.
    //   나우누리 실덤프: `번호 올린ID  등록일   파일명    크 기 받음  제목`
    //   하이텔(10장)  : 목록에 "전송(다운로드 수)" 컬럼.
    // 파일명/크기/전송(다운로드 수)은 서버가 목록 항목에 붙여준다(boardRoutes.enrichWith
    // AttachmentSummaries — item.fileName/fileSize/downloadCount). 파일이 없는 글이면 빈 칸.
    const isPdsList = /^pds/.test(String(board?.boardId || board?.id || ''))
      || String(board?.menuPath || '').trim() === 'pds'
      || String(state?.boardMenuTitle || '').includes('자료실');

    // bytes → "28K" / "1.2M" (나우누리 원전 표기: "28K", "647K", "9K").
    function formatSize(bytes) {
      const n = Number(bytes || 0);
      if (n <= 0) return '';
      if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}K`;
      return `${(n / (1024 * 1024)).toFixed(1)}M`;
    }

    if (isPdsList) {
      // 데스크톱: 번호/올린ID/날짜/파일명/크기/전송/제목. 모바일(44칸)은 폭이 좁아 ID·날짜·전송을
      // 빼고 번호/파일명/크기만 — 파일이 핵심이므로 제목 대신 파일명에 공간을 몰아준다.
      const P = isMobile
        ? { no: 6, id: 0, date: 0, size: 6, dn: 0, showTitle: false }
        : { no: 6, id: 8, date: 5, size: 6, dn: 5, showTitle: true };
      // 파일명·제목을 뺀 고정 칸(+칸 사이 공백)을 먼저 확정하고, 남는 폭을 파일명과 제목에 나눈다.
      const pFixed = P.no + 1 + (P.id ? P.id + 1 : 0) + (P.date ? P.date + 1 : 0)
        + P.size + 1 + (P.dn ? P.dn + 1 : 0);
      const slack = targetCols - pFixed;
      // 데스크톱은 파일명 14 + 제목 나머지, 모바일은 제목 없이 파일명이 남는 폭 전부.
      P.file = P.showTitle ? 14 : Math.max(8, slack - 1);
      const pTitleWidth = P.showTitle ? (slack - P.file - 1) : 0;

      const pdsHeader = () => {
        let line = fitCell('번호', P.no, 'right') + ' ';
        if (P.id) line += fitCell('올린ID', P.id) + ' ';
        if (P.date) line += fitCell('날짜', P.date) + ' ';
        line += fitCell('파일명', P.file) + ' '
          + fitCell('크기', P.size, 'right') + ' ';
        if (P.dn) line += fitCell('전송', P.dn, 'right') + ' ';
        if (P.showTitle && pTitleWidth > 0) line += fitCell('제  목', pTitleWidth);
        return ansiColor(14) + line + ANSI_RESET;
      };

      const pdsLine = (post) => {
        let line = ansiColor(15) + fitCell(String(post.id || ''), P.no, 'right') + ' ';
        if (P.id) line += ansiColor(11) + fitCell(post.userId || post.authorUserId || '', P.id) + ' ';
        if (P.date) line += ansiColor(8) + fitCell(formatShortDate(post.createdAt).slice(3), P.date) + ' ';
        line += ansiColor(15) + fitCell(String(post.fileName || ''), P.file) + ' '
          + ansiColor(8) + fitCell(formatSize(post.fileSize), P.size, 'right') + ' ';
        if (P.dn) line += ansiColor(8) + fitCell(String(post.downloadCount || 0), P.dn, 'right') + ' ';
        if (P.showTitle && pTitleWidth > 0) {
          const t = highlightText(String(post.title || ''), highlightTerm, 14, 15);
          line += ansiColor(15) + fitCell(t, pTitleWidth);
        }
        return line + ANSI_RESET;
      };

      const parts = [
        buildTopHeader({ leftLabel: boardCode, centerLabel }, pageLabel, targetCols),
        pdsHeader(),
        ansiHLine(targetCols, 8)
      ];
      if (!posts.length) {
        parts.push(ansiColor(8) + ' 등록된 자료가 없습니다.' + ANSI_RESET);
      } else {
        posts.slice(0, 15).forEach((post) => parts.push(pdsLine(post)));
      }
      return parts.join('\n');
    }

    // [LOG_ID: 20260717_1600] 원전(하이텔/나우누리 실기) 게시판 목록 형식.
    //
    //   하이텔  : 번호 / ID / 날짜 / 조회 / 쪽 / 제목        (docs/hitel_upgrade_plan.txt)
    //   나우누리: 번호 / 올린ID / 이름 / 날짜 / 읽음 / 쪽 / 제목
    //             "번호 올린ID   이  름   날 짜 읽음  쪽    제   목"
    //             "37884 015404   장은수   04/25    0   1 ●옥소리 매직●을 싸게팝니다"
    //             (docs/NOWNURI_SCREENS_FULL_DECODED.txt — NOW_MENU.DAT 실덤프)
    //
    // 이 앱의 기본 화면은 하이텔 계열이므로 하이텔 컬럼을 따른다 — 이름(닉네임) 없음, '쪽' 있음.
    // 20260717_1500에 웹 이식본(gmapds.oscc.kr)을 참조해 '쪽'을 뺐던 것을 되돌린다: 그 사이트는
    // 원전을 웹 테이블로 옮기며 '쪽'(글이 몇 화면인지)을 버린 버전이라, 그걸 따라가면 오히려
    // 원전에서 멀어진다("실제로 나우누리, 하이텔 UI랑 일치해?" 사용자 지적으로 원전 재확인).
    //
    // 날짜도 원전은 연도 없는 MM/DD("04/25")다. 종전 코드는 formatShortDate()가 돌려주는
    // "YY/MM/DD"(8칸)를 폭 5로 잘라 "26/07"(= YY/MM)을 보여줘, 정작 필요한 '일'이 사라져 있었다.
    //
    // 헤더와 데이터를 같은 폭 상수(COL)에서 만들어 손으로 맞춘 공백 때문에 어긋나지 않게 한다.
    const COL = isMobile
      ? { no: 6, id: 8, date: 5, hit: 0, pages: 0 }
      : { no: 6, id: 8, date: 5, hit: 4, pages: 3 };
    const optionalWidth = (COL.hit ? COL.hit + 1 : 0) + (COL.pages ? COL.pages + 1 : 0);
    const titleWidth = targetCols - (COL.no + 1 + COL.id + 1 + COL.date + 1 + optionalWidth);

    function columnHeader() {
      let line = fitCell('번호', COL.no, 'right') + ' '
        + fitCell('ID', COL.id) + ' '
        + fitCell('날짜', COL.date) + ' ';
      if (COL.hit) {
        line += fitCell('조회', COL.hit, 'right') + ' ';
      }
      if (COL.pages) {
        line += fitCell('쪽', COL.pages, 'right') + ' ';
      }
      line += fitCell('제  목', titleWidth);
      return ansiColor(14) + line + ANSI_RESET;
    }

    function postLine(post) {
      const titlePrefix = Number(post.step || 0) > 0 ? '└ ' : '';
      const rawTitle = titlePrefix + String(post.title || '');
      const highlightedTitle = highlightText(rawTitle, highlightTerm, 14, 15);
      const title = fitCell(highlightedTitle, titleWidth);

      const postId = fitCell(String(post.id || ''), COL.no, 'right');
      const userId = fitCell(post.userId || post.authorUserId || '', COL.id);
      // formatShortDate → "YY/MM/DD". 원전은 연도를 안 쓰므로 앞 3글자("YY/")를 떼어 MM/DD로 쓴다.
      const date = fitCell(formatShortDate(post.createdAt).slice(3), COL.date);

      let line = ansiColor(15) + postId + ' '
        + ansiColor(11) + userId + ' '
        + ansiColor(8) + date + ' ';
      if (COL.hit) {
        line += ansiColor(8) + fitCell(String(post.hit || post.views || 0), COL.hit, 'right') + ' ';
      }
      if (COL.pages) {
        line += ansiColor(8) + fitCell(String(estimatePostPageCount(post)), COL.pages, 'right') + ' ';
      }
      line += ansiColor(15) + title + ANSI_RESET;
      return line;
    }

    const parts = [
      buildTopHeader({ leftLabel: boardCode, centerLabel }, pageLabel, targetCols),
      columnHeader(),
      ansiHLine(targetCols, 8)
    ];

    // [LOG_ID: 20260717_1900] 동호회 신분 배너("## OOO님은 손님입니다 ##") 제거 — 호출부
    // (postListView.js)에서 더 이상 넘기지 않는다. 사유는 그쪽 주석 참조.

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

    // [LOG_ID: 20260718_1000] 종전엔 `#305/?` 처럼 물음표가 그대로 노출됐다. state.totalCount는
    // 목록 화면이 채우는 값인데, URL로 글에 바로 들어오면(/board/plaza/305) 목록을 거치지 않아
    // 늘 비어 있었다(자료실은 목록을 먼저 불러오지만 게시판은 안 한다). 모르는 값을 '?'로 찍느니
    // 아예 빼는 게 낫다 — 원전에도 없는 표기다. (이전/다음글은 서버가 주는 _postNavigation
    // 폴백으로 동작하므로 기능상 문제는 없다.)
    const metaNumber = totalCount ? `#${post?.id || ''}/${totalCount}` : `#${post?.id || ''}`;
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
      // [LOG_ID: 20260718_1000] '보낸이'는 편지(쪽지) 용어다 — 게시판 글의 작성자는 원전에서
      // '올린이'다(나우누리 실덤프: `올린이 : 이삭    (이란희  )    95/03/09 04:57    읽음 : 68`).
      parts.push(
        ansiColor(8) + fitCell(metaNumber, 13) +
        ansiColor(14) + ' 올린이 : ' +
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
    // [LOG_ID: 20260713_1165] 나우누리 가이드(GUIDE) 메뉴 전용 렌더링 스위칭
    if (state && state.theme === 'nownuri' && state.boardMenuPath === 'guide') {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const targetCols = isMobile ? 44 : 80;
      return buildNownuriGuideAnsi(targetCols);
    }

    const options = titleOrOptions && typeof titleOrOptions === 'object' && !Array.isArray(titleOrOptions)
      ? titleOrOptions
      : { title: titleOrOptions };
    const titlePath = Array.isArray(options.titlePath)
      ? options.titlePath
      : [options.title || '메뉴'];
    const parts = [buildTopHeader(titlePath, options.pageLabel || '')];

    // [LOG_ID: 20260713_1230] 나우누리식 ( 신규 / 전체 ) 건수 병기 — NOW_MENU.DAT의 BBS 메뉴
    // 원전(` 1. 열린광장 (   54 / 3947 )`) 재현.
    //
    // [LOG_ID: 20260717_1800] 그런데 **건수 병기는 나우누리만의 것이다.** 하이텔 메뉴는
    // 번호+이름뿐이고 건수를 달지 않는다(docs/메뉴-하이텔.txt = 마이컴 CD 수록 하이텔 전체
    // 메뉴, 길라잡이 정리본 어디에도 메뉴 건수 표기가 없다). 이 앱의 기본 화면은 하이텔
    // 계열인데 나우누리 표기를 무조건 붙이고 있어서 두 원전이 섞여 있었다
    // (사용자 지적: "오른쪽에 갯수는 안나도돼. 하이텔과 나우누리 참고해봐").
    //
    // → 기본(하이텔)은 건수 없음, 나우누리 테마(SET THEME NOWNURI)일 때만 건수를 붙인다.
    //   테마별 분기는 이 파일이 이미 쓰고 있는 방식이다(위 buildMainMenuAnsi/GUIDE 분기).
    const isMobileSelect = typeof window !== 'undefined' && window.innerWidth < 768;
    const isNownuriTheme = Boolean(state && state.theme === 'nownuri');
    const boardCounts = (state && state._boardCounts && state._boardCounts.data) || null;

    // [LOG_ID: 20260714_2400] GUIDE는 게시판(공지사항/건의하기)과 도움말/정책(명령어안내
    // 등)이 섞인 메뉴다 — 다른 모든 메뉴(GAME 등)처럼 항목 전체가 "라벨 (코드)" 한 가지
    // 형식으로만 보이도록 GUIDE에서는 건수 표기 자체를 생략해 시각 언어를 통일한다.
    const suppressCount = !isNownuriTheme || (state && state.boardMenuPath === 'guide');
    const useColumnPadding = !suppressCount && !!boardCounts
      && boards.some((b) => b?.boardId && boardCounts[b.boardId]);

    // [LOG_ID: 20260717_1700] 원전(NOW_MENU.DAT 실덤프) 게시판 메뉴:
    //     ` 1. 열린광장       (   54 / 3947 )`
    //     ` 3. 우스개         (   78 / 6661 )`
    // 이름 열은 "가장 긴 항목"에 맞춰 딱 붙고, 건수는 `( 새글 /전체 )` 한 덩어리다.
    //
    // 종전엔 라벨 열 폭이 26(모바일 20)으로 **고정**이라, 우리 게시판 이름은 길어야 8칸
    // (열린광장/우스개)인데도 뒤에 공백이 18칸이나 벌어져 "( 0 / 7 )"이 저 멀리 떨어져
    // 보였다(사용자 지적: "bbs 메뉴가 이상한데"). 항목들의 실제 길이에서 열 폭을 구한다.
    //
    // 코드((PLAZA) 등)는 원전엔 없지만 이 앱은 GO 명령용으로 노출하는 정책이다(TOP도
    // "1. 서비스안내 (GUIDE)"). 종전엔 건수 **뒤에** 덧붙어 "( 0 / 7 ) (PLAZA)"처럼
    // 어색했는데, TOP과 동일하게 이름 옆으로 옮겨 라벨의 일부로 취급한다.
    const rows = boards.map((board) => {
      const door = String(board?.door || getBoardDoor(board) || '').padStart(2, ' ');
      const label = String(board?.label || board?.name || getBoardDisplayName(board) || '메뉴').trim();
      const code = String(board?.code || '').trim();
      const suffix = code && !label.toUpperCase().includes(`(${code.toUpperCase()})`) ? ` (${code})` : '';

      const countInfo = useColumnPadding && board?.boardId ? boardCounts[board.boardId] : null;
      let countText = '';
      if (countInfo) {
        // 원전 표기: `( ` + 새글(4칸 우측) + ` /` + 전체(5칸 우측) + ` )` → "(   54 / 3947 )"
        countText = isMobileSelect
          ? `(${countInfo.recent}/${countInfo.total})`
          : `( ${String(countInfo.recent).padStart(4, ' ')} /${String(countInfo.total).padStart(5, ' ')} )`;
      }

      return { text: `${door}. ${label}${suffix}`, countText };
    });

    // 건수를 붙일 줄이 하나라도 있으면, 그 줄들의 라벨 길이 중 최댓값 + 1칸을 건수 시작 위치로 쓴다.
    const countColStart = rows.some((row) => row.countText)
      ? Math.max(...rows.map((row) => displayWidth(row.text))) + 2
      : 0;

    rows.forEach((row) => {
      const padding = row.countText
        ? ' '.repeat(Math.max(1, countColStart - displayWidth(row.text)))
        : '';
      parts.push(
        ansiColor(15) + row.text
        + (row.countText ? padding + ansiColor(8) + row.countText : '')
        + ANSI_RESET
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

  // [LOG_ID: 20260713_1165] 나우누리 가이드(GUIDE) 메뉴 ANSI 렌더링 함수
  function buildNownuriGuideAnsi(targetCols) {
    const parts = [];
    parts.push(ansiColor(14) + 'GUIDE                           서비스 안내                     ☏ 02-590-3800' + ANSI_RESET);
    parts.push('이용해 주셔서 감사합니다.(도움말(H) 입력)');
    parts.push('');
    parts.push('   ' + ansiColor(15) + '1. 서비스안내' + ANSI_RESET + '           ' + ansiColor(15) + '2. 나우로안내' + ANSI_RESET + '        3. 가입/해지/요금안내');
    parts.push('');
    parts.push('  [ 서비스안내 ]              [ 이용자안내 ]          [ 커뮤니티 ]');
    parts.push('');
    parts.push('  ' + ansiColor(15) + '11. 메뉴안내' + ANSI_RESET + '               ' + ansiColor(15) + '31. 이용수칙' + ANSI_RESET + '            41. 나우맵');
    parts.push('  ' + ansiColor(15) + '12. 이용약관' + ANSI_RESET + '               ' + ansiColor(15) + '32. 보안실' + ANSI_RESET + '            42. 나우누리 소식');
    parts.push('  ' + ansiColor(15) + '13. 요금안내' + ANSI_RESET + '               33. CUG             43. 나우누리 모임');
    parts.push('  ' + ansiColor(15) + '14. 접속방법' + ANSI_RESET + '               34. 회원주소록      44. 소설/수필/소통');
    parts.push('                              35. 서비스소개      45. 동호회 소식');
    parts.push('  [ 이용자권리 ]              36. 건의함');
    parts.push('                              37. 질문방');
    parts.push('  21. 개인정보 처리방침       38. 버그신고');
    parts.push('  22. 개인정보 열람청구       39. 관련사이트');
    parts.push('');
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
