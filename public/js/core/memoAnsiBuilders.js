import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createMemoAnsiBuilders(deps) {
  const {
    ANSI_RESET,
    ansiColor,
    ansiHLine,
    buildTopHeader,
    fitCell,
    formatLongDate
  } = createAnsiBuilderUtils(deps);

  function buildMemoListAnsi(memos) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    function colHeader() {
      if (isMobile) {
        return ansiColor(14) +
          fitCell('번호', 4, 'right') + ' ' +
          fitCell('보낸이', 10) + ' ' +
          fitCell('내용 요약', 18) + ' ' +
          fitCell('날짜', 8) +
          ANSI_RESET;
      }
      return ansiColor(14) +
        fitCell('번호', 4, 'right') + ' ' +
        fitCell('보낸사람', 12) + ' ' +
        fitCell('내용 요약', 45) + ' ' +
        fitCell('날짜', 15) +
        ANSI_RESET;
    }

    function memoLine(memo, index) {
      const num = String(index + 1).padStart(4);
      if (isMobile) {
        const sender = fitCell(memo.senderUserId || 'guest', 10);
        const summary = fitCell(memo.title || memo.content || '', 18);
        const date = fitCell(String(memo.createdAt || '').substring(5, 10), 8); // MM-DD
        const color = memo.isRead ? 8 : 15;
        return ansiColor(color) + num + ' ' +
          ansiColor(10) + sender + ' ' +
          ansiColor(color) + summary + ' ' +
          ansiColor(8) + date +
          ANSI_RESET;
      }
      const sender = fitCell(memo.senderUserId || 'guest', 12);
      const summary = fitCell(memo.title || memo.content || '', 45);
      const date = fitCell(String(memo.createdAt || '').substring(0, 10), 15);
      const color = memo.isRead ? 8 : 15;

      return ansiColor(color) + num + ' ' +
        ansiColor(10) + sender + ' ' +
        ansiColor(color) + summary + ' ' +
        ansiColor(8) + date +
        ANSI_RESET;
    }

    // [LOG_ID: 20260708_1030] 다른 목록 화면들과 동일하게 buildTopHeader로 정통 상단바(로고 박스+실시간
    // 시계)를 갖춘다. 기존엔 "▣ 쪽 지 함 (MEMO) ▣" 자체 박스 헤더를 쓰면서 화면 전체가
    // renderAnsiScreenWithTopbar가 아닌 맨 ansiToHTML로만 그려져, 상단바가 통째로 빠진 채 렌더링됐다.
    const parts = [
      buildTopHeader({ leftLabel: 'MEMO', centerLabel: '쪽지함' }, `(총 ${memos.length}통)`, targetCols),
      colHeader(),
      ansiHLine(targetCols, 8)
    ];
    if (!memos.length) {
      parts.push(ansiColor(8) + '   도착한 쪽지가 없습니다.' + ANSI_RESET);
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

  function buildMemoViewAnsi(memo) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const innerWidth = targetCols - 4;

    // [LOG_ID: 20260708_1030] 바깥 제목 줄("쪽지 보기")을 buildTopHeader의 정통 상단바로 옮기고,
    // 내용 박스는 그대로 유지한다 — 다른 화면들과 마찬가지로 renderAnsiScreenWithTopbar로 렌더링해야
    // 로고 박스+실시간 시계가 보인다(기존엔 자체 박스 헤더뿐이라 상단바가 통째로 빠져 있었다).
    const parts = [buildTopHeader({ leftLabel: 'MEMO', centerLabel: '쪽지 보기' }, '', targetCols)];
    parts.push(ansiColor(14) + '┌' + '─'.repeat(targetCols - 2) + '┐' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('보낸이: ', 8) + ansiColor(15) + fitCell(memo.senderUserId || '', innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('받은날: ', 8) + ansiColor(15) + fitCell(formatLongDate(memo.createdAt) || memo.createdAt || '', innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
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
