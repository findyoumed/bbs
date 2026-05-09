import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

export function createMemoAnsiBuilders(deps) {
  const {
    ANSI_BOLD,
    ANSI_RESET,
    ansiColor,
    ansiHLine,
    displayWidth,
    fitCell
  } = createAnsiBuilderUtils(deps);

  function buildMemoListAnsi(memos) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    function headerBar() {
      const label = isMobile ? ' ▣ 쪽 지 함 ▣ ' : ' ▣ 쪽 지 함 (MEMO) ▣ ';
      const count = ` 총 ${memos.length}통 `;
      const dashes = '─'.repeat(Math.max(0, targetCols - displayWidth(label) - displayWidth(count) - 2));
      return ansiColor(14) + '─' + label + dashes + count + '─' + ANSI_RESET;
    }

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

    const parts = [headerBar(), colHeader(), ansiHLine(targetCols, 4)];
    if (!memos.length) {
      parts.push(ansiColor(8) + '   도착한 쪽지가 없습니다.' + ANSI_RESET);
    } else {
      memos.slice(0, 16).forEach((memo, index) => parts.push(memoLine(memo, index)));
    }

    while (parts.length < 20) {
      parts.push('');
    }

    return parts.join('\n');
  }

  function buildMemoViewAnsi(memo) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const innerWidth = targetCols - 4;

    const parts = [];
    parts.push(ansiColor(14) + '┌' + '─'.repeat(targetCols - 2) + '┐' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(15) + ANSI_BOLD + fitCell('쪽지 보기', innerWidth, 'center') + ANSI_RESET + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '├' + '─'.repeat(targetCols - 2) + '┤' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('보낸이: ', 8) + ansiColor(15) + fitCell(memo.senderUserId || '', innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '│ ' + ansiColor(11) + fitCell('받은날: ', 8) + ansiColor(15) + fitCell(memo.createdAt || '', innerWidth - 8) + ansiColor(14) + ' │' + ANSI_RESET);
    parts.push(ansiColor(14) + '├' + '─'.repeat(targetCols - 2) + '┤' + ANSI_RESET);

    const contentLines = String(memo.content || '').split('\n');
    contentLines.forEach(line => {
      parts.push(ansiColor(14) + '│ ' + ansiColor(15) + fitCell(line, innerWidth) + ansiColor(14) + ' │' + ANSI_RESET);
    });

    while (parts.length < 18) {
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
