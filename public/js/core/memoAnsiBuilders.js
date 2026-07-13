import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

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
    buildTopHeader,
    fitCell,
    formatLongDate
  } = createAnsiBuilderUtils(deps);

  // [LOG_ID: 20260713_1000] 받은쪽지함과 보낸쪽지함을 구분하여 컬럼과 헤더를 빌드하도록 boxType 추가
  function buildMemoListAnsi(memos, boxType = 'inbox') {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const isSent = boxType === 'sent';

    function colHeader() {
      if (isMobile) {
        return ansiColor(14) +
          fitCell('번호', 4, 'right') + ' ' +
          fitCell(isSent ? '받는이' : '보낸이', 10) + ' ' +
          fitCell('내용 요약', 18) + ' ' +
          fitCell('날짜', 8) +
          ANSI_RESET;
      }
      return ansiColor(14) +
        fitCell('번호', 4, 'right') + ' ' +
        fitCell(isSent ? '받는사람' : '보낸사람', 12) + ' ' +
        fitCell('내용 요약', 40) + ' ' +
        fitCell('날짜', 12) + ' ' +
        fitCell('상태', 8) +
        ANSI_RESET;
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
      const userField = isSent ? (memo.recipientUserId || 'guest') : (memo.senderUserId || 'guest');
      const marker = memoTypeMarker(memo);
      const cleanTitle = stripMemoTypeTag(memo.title) || memo.content || '';
      if (isMobile) {
        const markerText = marker ? `[${marker}]` : '';
        const summaryWidth = 18 - (marker ? 4 : 0);
        const user = fitCell(userField, 10);
        const summary = fitCell(cleanTitle, summaryWidth);
        const date = fitCell(String(memo.createdAt || '').substring(5, 10), 8); // MM-DD
        const color = memo.isRead ? 8 : 15;
        return ansiColor(color) + num + ' ' +
          ansiColor(10) + user + ' ' +
          (markerText ? ansiColor(9) + markerText + ' ' : '') +
          ansiColor(color) + summary + ' ' +
          ansiColor(8) + date +
          ANSI_RESET;
      }
      const markerText = marker ? `[${marker}]` : '';
      const summaryWidth = 40 - (marker ? 5 : 0);
      const user = fitCell(userField, 12);
      const summary = fitCell(cleanTitle, summaryWidth);
      const date = fitCell(String(memo.createdAt || '').substring(0, 10), 12);
      // 보낸쪽지함에서는 수신여부 표시, 받은쪽지함에서는 회색/흰색 글씨로만 구분
      const statusText = isSent ? (memo.isRead ? '수신' : '않읽음') : '';
      const status = fitCell(statusText, 8);
      const color = memo.isRead ? 8 : 15;

      return ansiColor(color) + num + ' ' +
        ansiColor(10) + user + ' ' +
        (markerText ? ansiColor(9) + markerText + ' ' : '') +
        ansiColor(color) + summary + ' ' +
        ansiColor(8) + date + ' ' +
        ansiColor(isSent && !memo.isRead ? 15 : 8) + status +
        ANSI_RESET;
    }

    const boxTitle = isSent ? '보낸쪽지함' : '받는쪽지함';
    const parts = [
      buildTopHeader({ leftLabel: 'MEMO', centerLabel: boxTitle }, `(총 ${memos.length}통)`, targetCols),
      colHeader(),
      ansiHLine(targetCols, 8)
    ];
    if (!memos.length) {
      parts.push(ansiColor(8) + (isSent ? '   보낸 쪽지가 없습니다.' : '   도착한 쪽지가 없습니다.') + ANSI_RESET);
    } else {
      memos.slice(0, 16).forEach((memo, index) => parts.push(memoLine(memo, index)));
    }

    // buildTopHeader의 4줄은 renderAnsiScreenWithTopbar가 본문에서 떼어내므로,
    // 총 24줄(80x24 PC통신 프레임) 예산에 맞춰 나머지를 빈 줄로 채운다.
    while (parts.length < 24) {
      parts.push('');
    }

    return parts.join('\n');
  }

  // [LOG_ID: 20260713_1000] 보낸 편지 상세 조회 시 보낸이 대신 '받는이: ID'로 표시하도록 currentUserId 전달받음
  function buildMemoViewAnsi(memo, currentUserId) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const innerWidth = targetCols - 4;

    const isSent = memo.senderUserId === currentUserId;
    const userLabel = isSent ? '받는이: ' : '보낸이: ';
    const userValue = isSent ? (memo.recipientUserId || '') : (memo.senderUserId || '');

    // [LOG_ID: 20260708_1030] 바깥 제목 줄("쪽지 보기")을 buildTopHeader의 정통 상단바로 옮기고,
    // 내용 박스는 그대로 유지한다 — 다른 화면들과 마찬가지로 renderAnsiScreenWithTopbar로 렌더링해야
    // 로고 박스+실시간 시계가 보인다(기존엔 자체 박스 헤더뿐이라 상단바가 통째로 빠져 있었다).
    const parts = [buildTopHeader({ leftLabel: 'MEMO', centerLabel: '쪽지 보기' }, '', targetCols)];
    parts.push(ansiColor(14) + '┌' + '─'.repeat(targetCols - 2) + '┐' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell(userLabel, 8) + ansiColor(15) + fitCell(userValue, innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('받은날: ', 8) + ansiColor(15) + fitCell(formatLongDate(memo.createdAt) || memo.createdAt || '', innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    // [LOG_ID: 20260713_1660] 편지 종류(비밀/답장요망/지연 조합)를 보기 화면에도 명확히 표시 —
    // 이전엔 목록 요약 텍스트에만 대괄호 태그로 섞여 있어 상세보기에서는 아예 보이지 않았다.
    const typeTag = parseMemoTypeTag(memo.title);
    if (typeTag) {
      parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('종류: ', 8) + ansiColor(9) + fitCell(typeTag, innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    }
    parts.push(ansiColor(14) + '├' + '─'.repeat(targetCols - 2) + '┤' + ANSI_RESET);

    const contentLines = String(memo.content || '').split('\n');
    contentLines.forEach(line => {
      parts.push(ansiColor(14) + '│ ' + ansiColor(15) + fitCell(line, innerWidth) + ansiColor(14) + ' │' + ANSI_RESET);
    });

    while (parts.length < 17) {
      parts.push(ansiColor(14) + '│ ' + ' '.repeat(innerWidth) + ' │' + ANSI_RESET);
    }
    parts.push(ansiColor(14) + '└' + '─'.repeat(targetCols - 2) + '┘' + ANSI_RESET);

    return parts.join('\n');
  }

  return {
    buildMemoListAnsi,
    buildMemoViewAnsi
  };
}
