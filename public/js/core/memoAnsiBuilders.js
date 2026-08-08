import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
// [LOG_ID: 20260719_1200] 하이텔 (10)-3 축하카드(vmail) — content 맨 앞 [CARD:key] 마커의 아트.
import { getMemoCard } from './memoCardAssets.js';

// [LOG_ID: 20260713_1660] 편지 종류(1-8) 태그는 제목 앞 대괄호로 인코딩되어 있다(memoScreens.js
// buildMemoTitleTag와 동일 형식). 목록/보기 화면에서 공통으로 파싱해 표시하기 위한 헬퍼.
function parseMemoTypeTag(title) {
  const match = String(title || '').match(/^\[([^\]]+)\]\s*/);
  return match ? match[1] : null;
}

function stripMemoTypeTag(title) {
  return String(title || '').replace(/^\[([^\]]+)\]\s*/, '');
}

export function createMemoAnsiBuilders(deps) {
  const {
    ANSI_RESET,
    ansiColor,
    ansiHLine,
    buildPageLabel,
    buildTopHeader,
    displayWidth,
    fitCell,
    formatLongDate,
    formatShortDate,
    wrapAnsiText
  } = createAnsiBuilderUtils(deps);

  // [LOG_ID: 20260713_1000] 받은쪽지함과 보낸쪽지함을 구분하여 컬럼과 헤더를 빌드하도록 boxType 추가
  // [LOG_ID: 20260716_1000] 하이텔 원전(길라잡이 그림 7.4 편지 받기/그림 7.8 보낸 편지 확인)의
  // 컬럼 순서를 재현 — "No. 발신자ID ... 제목"처럼 아이디를 앞쪽에 두고 제목을 가장 뒤(가장
  // 넓은 칸)에 배치한다. 기존엔 번호/보낸사람/내용요약/날짜/상태 순으로 제목이 가운데 끼어
  // 있어 하이텔 목록과 열 순서가 달랐다(사용자 요청: 스크린샷을 보면서 화면을 맞춰라).
  // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — boxType에 'archive'가 추가됐다.
  // 보관함에는 받은 쪽지와 보낸 쪽지가 섞여 있으므로, "상대방"이 누구인지는 상자 종류가 아니라
  // 쪽지마다(내가 보낸 것이면 받는이, 받은 것이면 보낸이) 따로 판단해야 한다.
  function buildMemoListAnsi(memos, boxType = 'inbox', currentUserId = '') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const isSent = boxType === 'sent';
    const isArchive = boxType === 'archive';

    const idWidth = isMobile ? 10 : 12;
    const dateWidth = isMobile ? 8 : 12;
    const statusWidth = 8;
    // 그림 7.8(보낸 편지 확인)에만 '상태(수신/않읽음)' 컬럼이 있다 — 받은쪽지함(그림 7.4)엔 없다.
    // 모바일은 폭이 좁아 데스크톱에서도 부가 정보였던 상태 컬럼을 기존처럼 생략한다.
    const showStatus = isSent && !isMobile;
    const fixedWidth = 4 + 1 + idWidth + 1 + dateWidth + 1 + (showStatus ? statusWidth + 1 : 0);
    const titleWidth = targetCols - fixedWidth;

    function colHeader() {
      let line = ansiColor(14) +
        fitCell('번호', 4, 'right') + ' ' +
        fitCell(isArchive ? '상대방' : (isSent ? '받는이' : '보낸이'), idWidth) + ' ' +
        fitCell('날짜', dateWidth) + ' ';
      if (showStatus) {
        line += fitCell('상태', statusWidth) + ' ';
      }
      line += fitCell('제목', titleWidth) + ANSI_RESET;
      return line;
    }

    // [LOG_ID: 20260713_1660] 편지 종류 태그를 목록에서도 짧은 마커로 보여준다 —
    // 이전엔 대괄호 태그가 그대로 요약 텍스트에 섞여 잘리기 일쑤였다.
    function memoTypeMarker(memo) {
      const tag = parseMemoTypeTag(memo.title);
      if (!tag) return '';
      let marker = '';
      if (tag.includes('비밀')) marker += '비';
      if (tag.includes('답장요망')) marker += '답';
      if (tag.includes('지연')) marker += '지';
      return marker;
    }

    function memoLine(memo, index) {
      const num = String(index + 1).padStart(4);
      // 보관함은 내가 보낸 쪽지면 받는이를, 받은 쪽지면 보낸이를 "상대방"으로 보여준다.
      const isMineSent = isArchive && currentUserId && memo.senderUserId === currentUserId;
      const userField = (isSent || isMineSent)
        ? (memo.recipientUserId || 'guest')
        : (memo.senderUserId || 'guest');
      const marker = memoTypeMarker(memo);
      let rawTitle = stripMemoTypeTag(memo.title).split(/[\r\n]+/)[0].trim();
      if (!rawTitle && memo.content) {
        rawTitle = String(memo.content).split(/[\r\n]+/)[0].trim();
      }
      const cleanTitle = rawTitle || '(제목 없음)';
      const markerText = marker ? `[${marker}]` : '';
      const availableTitleWidth = titleWidth - (markerText ? displayWidth(markerText) + 1 : 0);
      const user = fitCell(userField, idWidth);
      // [LOG: 20260801_0900] UTC raw substring → formatShortDate로 KST 변환 적용
      // 기존: substring(0,10)/substring(5,10) 은 UTC ISO 날짜 문자를 그대로 잘라
      // KST(UTC+9) 기준 15:00~24:00 사이에 생성된 쪽지 날짜가 하루 이른 값으로 표시됐다.
      // formatShortDate는 hasExplicitTimezoneMarker(Z)를 감지해 new Date()를 통해
      // 브라우저 로컬 시각(KST)으로 변환하므로 날짜 경계 오류가 없다.
      const dateRaw = isMobile
        ? formatShortDate(memo.createdAt).slice(3) // MM/DD (로컬 시각)
        : formatShortDate(memo.createdAt);           // YY/MM/DD (로컬 시각)
      const date = fitCell(dateRaw, dateWidth);
      const title = fitCell(cleanTitle, availableTitleWidth);
      const color = memo.isRead ? 8 : 15;

      let line = ansiColor(color) + num + ' ' +
        ansiColor(10) + user + ' ' +
        ansiColor(8) + date + ' ';
      if (showStatus) {
        const statusText = memo.isRead ? '수신' : '않읽음';
        line += ansiColor(memo.isRead ? 8 : 15) + fitCell(statusText, statusWidth) + ' ';
      }
      line += (markerText ? ansiColor(9) + markerText + ' ' : '') +
        ansiColor(color) + title +
        ANSI_RESET;
      return line;
    }

    const boxTitle = isArchive ? '편지보관함' : (isSent ? '보낸편지함' : '받은편지함');
    const leftLabel = isArchive ? 'MAIL' : (isSent ? 'CMAIL' : 'RMAIL');
    const parts = [
      buildTopHeader({ leftLabel, centerLabel: boxTitle }, `(총 ${memos.length}통)`, targetCols),
      colHeader(),
      ansiHLine(targetCols, 8)
    ];
    if (!memos.length) {
      const emptyText = isArchive
        ? '   보관한 쪽지가 없습니다.'
        : (isSent ? '   보낸 쪽지가 없습니다.' : '   도착한 쪽지가 없습니다.');
      parts.push(ansiColor(8) + emptyText + ANSI_RESET);
    } else {
      memos.slice(0, 16).forEach((memo, index) => parts.push(memoLine(memo, index)));
      // [LOG_ID: 20260727_0445] 쪽지함은 `/api/memos?box=...`가 페이지 파라미터 없이 전체를
      // 받아오는데(memoScreens.js) 이 화면은 16통 넘으면 안내 없이 잘랐다 — 헤더의 "(총 N통)"은
      // 진짜 총량을 보여주면서 정작 목록엔 그 차이를 설명하는 안내가 없었다(회의실/안건 목록과
      // 같은 버그 클래스). 이 함수는 끝에서 24줄까지 빈 줄만 채우고 잘라내지 않으므로(패딩 전용)
      // 안내 줄 하나 추가는 항상 안전하다.
      if (memos.length > 16) {
        parts.push(ansiColor(8) + `   ... 외 ${memos.length - 16}통 더 있습니다.` + ANSI_RESET);
      }
    }

    // buildTopHeader의 4줄은 renderAnsiScreenWithTopbar가 본문에서 떼어내므로,
    // 총 24줄(80x24 PC통신 프레임) 예산에 맞춰 나머지를 빈 줄로 채운다.
    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 23) {
      joinedLines.push('');
    }

    return joinedLines.slice(0, 23).join('\n');
  }

  // [LOG_ID: 20260713_1000] 보낸 편지 상세 조회 시 보낸이 대신 '받는이: ID'로 표시하도록 currentUserId 전달받음
  // [LOG_ID: 20260716_1000] 하이텔 원전(길라잡이 그림 7.5 편지 읽기) 재현 — 박스(┌─┐)를 걷어내고
  // 게시글 읽기(buildPostViewAnsi, 그림 5.5 재현)와 동일한 "라벨 : 값" 평문 줄 + 구분선 스타일로
  // 통일한다. 하이텔은 박스를 파일 전송 진행률 같은 대화상자(그림 10.4)에만 쓰고, 편지/게시물
  // 읽기 같은 일반 콘텐츠 화면엔 평문을 쓴다 — 기존 MEMO 보기만 이 관례에서 벗어나 있었다.
  // [LOG_ID: 20260726_0010] 쪽지 본문은 페이징 없이 무조건 이어붙였다 — 토론의 광장 안건
  // 보기(20260726_2300)와 완전히 동일한 버그 클래스. 쪽지 작성(memo-write)은 여러 줄을
  // 계속 입력받아 /s로 등록하는 방식이라 본문 길이에 사실상 상한이 없다. 실측: 짧은 문장
  // 15개(약 900자)만으로 53줄이 나와 ansiEngine.js의 25행 고정 격자를 넘는 나머지(절반 이상)가
  // HTML 렌더 이전에 통째로 버려짐을 확인 — buildConfAgendaViewAnsi와 동일한 페이징 패턴을
  // 적용한다. F는 이미 "쪽지 전달(forward)"에 쓰이고 있어 다른 페이징 화면처럼 F/엔터를 함께
  // 쓸 수 없다 — 엔터(빈 명령)만 다음쪽으로 쓰고 F는 그대로 전달 기능으로 둔다(commandRouterMemo.js).
  function buildMemoViewAnsi(memo, currentUserId, requestedPageNo = 1) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const isSent = memo.senderUserId === currentUserId;
    const userLabel = isSent ? '받는이' : '보낸이';
    const userValue = isSent ? (memo.recipientUserId || '') : (memo.senderUserId || '');
    const typeTag = parseMemoTypeTag(memo.title);
    const cleanTitle = stripMemoTypeTag(memo.title);
    const labelWidth = isMobile ? 6 : 8;
    // [LOG_ID: 20260716_1000] 라벨(labelWidth) + ' : '(3칸)을 뺀 나머지가 값의 가용 폭이다 —
    // 값을 그대로 이어붙이면 제목이 길 때 targetCols를 넘어섰다(모바일 44칸에서 실측 확인).
    const valueWidth = targetCols - labelWidth - 3;

    const headerLines = [];
    headerLines.push(ansiColor(14) + fitCell(userLabel, labelWidth) + ' : ' + ansiColor(15) + fitCell(userValue, valueWidth) + ANSI_RESET);
    headerLines.push(ansiColor(14) + fitCell('받은날', labelWidth) + ' : ' + ansiColor(15) + fitCell(formatLongDate(memo.createdAt) || memo.createdAt || '', valueWidth) + ANSI_RESET);
    // [LOG_ID: 20260713_1660] 편지 종류(비밀/답장요망/지연 조합)를 보기 화면에도 명확히 표시 —
    // 이전엔 목록 요약 텍스트에만 대괄호 태그로 섞여 있어 상세보기에서는 아예 보이지 않았다.
    if (typeTag) {
      headerLines.push(ansiColor(14) + fitCell('종류', labelWidth) + ' : ' + ansiColor(9) + fitCell(typeTag, valueWidth) + ANSI_RESET);
    }
    let singleLineTitle = '';
    if (cleanTitle) {
      singleLineTitle = cleanTitle.split(/[\r\n]+/)[0].trim();
      if (singleLineTitle) {
        const titleLabel = fitCell('제목', labelWidth);
        headerLines.push(ansiColor(14) + `${titleLabel} : ` + ansiColor(15) + fitCell(singleLineTitle, valueWidth) + ANSI_RESET);
      }
    }
    headerLines.push(ansiHLine(targetCols, 8));

    // [LOG_ID: 20260719_1200] 축하카드: content 맨 앞이 [CARD:key]면 카드 아트를 가운데 정렬해 렌더하고,
    // 마커 줄을 뺀 나머지를 인사말 본문으로 이어 보여준다.
    let bodyText = String(memo.content || '');
    const cardMatch = bodyText.match(/^\[CARD:([a-z0-9_]+)\]\n?/i);
    if (cardMatch) {
      const card = getMemoCard(cardMatch[1]);
      bodyText = bodyText.slice(cardMatch[0].length);
      if (card) {
        card.art.forEach((artLine) => {
          const pad = Math.max(0, Math.floor((targetCols - displayWidth(artLine)) / 2));
          headerLines.push(ansiColor(card.color || 15) + ' '.repeat(pad) + artLine + ANSI_RESET);
        });
        headerLines.push(ansiHLine(targetCols, 8));
      }
    }

    const cleanSingleTitle = stripMemoTypeTag(singleLineTitle).trim();
    const rawBodyLines = bodyText.split('\n');
    if (cleanSingleTitle && rawBodyLines.length > 0) {
      const cleanFirstBodyLine = stripMemoTypeTag(rawBodyLines[0]).trim();
      if (cleanFirstBodyLine === cleanSingleTitle || cleanFirstBodyLine.startsWith(cleanSingleTitle)) {
        rawBodyLines.shift();
      }
    }

    const contentLines = [];
    rawBodyLines.forEach((line) => {
      wrapAnsiText(line, targetCols).forEach((wrapped) => {
        contentLines.push(wrapped);
      });
    });

    const totalLines = 23;
    const topHeaderLines = 4; // buildTopHeader() 반환 줄 수
    const baseLines = Math.max(3, totalLines - topHeaderLines - headerLines.length - 1);

    const pages = [];
    let currentLineIdx = 0;
    const totalBodyLines = Math.max(1, contentLines.length);
    while (currentLineIdx < totalBodyLines) {
      const isLastPage = (totalBodyLines - currentLineIdx) <= baseLines;
      const allowedLines = isLastPage ? Math.max(3, baseLines) : baseLines;
      const chunk = contentLines.slice(currentLineIdx, currentLineIdx + allowedLines);
      pages.push(chunk);
      currentLineIdx += chunk.length;
    }

    const pageCount = pages.length;
    const currentPage = Math.min(Math.max(Number.parseInt(requestedPageNo, 10) || 1, 1), pageCount);
    const visibleBodyLines = pages[currentPage - 1] || [];
    const pageLabel = buildPageLabel(currentPage, pageCount);

    const parts = [buildTopHeader({ leftLabel: 'MEMO', centerLabel: '편지 읽기' }, pageLabel, targetCols)];
    parts.push(...headerLines);
    visibleBodyLines.forEach((line) => {
      parts.push(ansiColor(15) + line + ANSI_RESET);
    });

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < totalLines) {
      joinedLines.push(ANSI_RESET);
    }

    return {
      text: joinedLines.slice(0, totalLines).join('\n'),
      pageNo: currentPage,
      pageCount
    };
  }

  // [LOG_ID: 20260807_1405] 나우누리 원전(docs/NOWNURI_SCREENS_FULL_DECODED.txt 91행) 기준
  // 전자우편(MAIL) 대문 서브메뉴 ANSI 화면 생성 함수
  function buildMemoMenuAnsi(currentUserId = '') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader({ leftLabel: 'MAIL', centerLabel: '전자우편' }, '', targetCols),
      '',
      ansiColor(15) + '  1. 편지 읽기         (RMAIL)' + ANSI_RESET,
      ansiColor(15) + '  2. 편지 쓰기         (WMAIL)' + ANSI_RESET,
      ansiColor(15) + '  3. 배달 확인         (CMAIL)' + ANSI_RESET,
      '',
      ansiColor(15) + '  5. 동보편지 주소록   (GRP)' + ANSI_RESET,
      ansiColor(15) + '  6. 부재 설정         (ABSENT)' + ANSI_RESET,
      ansiColor(15) + '  7. 전자우편 이용안내' + ANSI_RESET,
      ''
    ];

    const joinedLines = parts.join('\n').split('\n');
    while (joinedLines.length < 24) {
      joinedLines.push('');
    }

    return joinedLines.join('\n');
  }

  return {
    buildMemoListAnsi,
    buildMemoViewAnsi,
    buildMemoMenuAnsi
  };
}
