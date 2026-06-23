// [LOG: 20260622_2301] rankingAnsiBuilders 구현 — 랭킹 ANSI 빌더
// [LOG: 20260623_0100] 80컬럼 오버플로우 교정 — 각 열을 조립 후 fitCell로 고정폭 클램프하여
// 한글/영문 혼용 시에도 가로 80칸을 절대 넘지 않도록 보장(구조적 차단).
export function createRankingAnsiBuilders(deps) {
  const {
    ansiColor,
    ANSI_RESET,
    fitCell,
    buildTopHeader,
    ansiHLine
  } = deps.ansiBuilderUtils;

  // --- 종합(3단) 레이아웃 폭 예산 ---
  // 라인 = ' ' + col(25) + ' │' + col(25) + ' │' + col(25) = 1 + 25 + 2 + 25 + 2 + 25 = 80
  const SUMMARY_COL = 25;
  const SUMMARY_NAME = 15; // rank(3) + ' ' + name(15) + ' ' + score(≤5) ≤ 25

  // --- 상세(2단) 레이아웃 폭 예산 ---
  // 라인 = ' ' + col(37) + ' │ ' + col(37) = 1 + 37 + 3 + 37 = 78
  const DETAIL_COL = 37;
  const DETAIL_NAME = 22; // rank(4) + ' ' + name(22) + ' ' + score(≤7) ≤ 37

  // 한 열을 "순위. 아이디(닉네임) 점수" 형태로 조립한 뒤 고정폭으로 클램프한다.
  function buildCell(rank, user, scoreStr, colWidth, nameWidth, rankPad) {
    const rankStr = String(rank).padStart(rankPad, ' ') + '.';
    const name = fitCell(`${user.userId}(${user.nickName})`, nameWidth, 'left');
    const body = `${rankStr} ${name} ${scoreStr}`;
    return fitCell(body, colWidth, 'left');
  }

  function emptyCell(colWidth) {
    return fitCell('', colWidth, 'left');
  }

  // 1. 종합 랭킹 화면 빌더 (Top 10을 3단으로 표시)
  function buildRankingSummaryAnsi(data) {
    const header = buildTopHeader(['오락실', '게시판 종합 랭킹']);
    const levels = data.levelRanking || [];
    const posts = data.postRanking || [];
    const recommends = data.recommendRanking || [];

    const labelLine =
      ' ' +
      fitCell('[ 레벨 TOP10 ]', SUMMARY_COL, 'left') + '  ' +
      fitCell('[ 글작성 TOP10 ]', SUMMARY_COL, 'left') + '  ' +
      fitCell('[ 받은추천 TOP10 ]', SUMMARY_COL, 'left');

    const subLine =
      ' ' +
      fitCell(' 순위 아이디(닉네임)   LV', SUMMARY_COL, 'left') + '  ' +
      fitCell(' 순위 아이디(닉네임)  글수', SUMMARY_COL, 'left') + '  ' +
      fitCell(' 순위 아이디(닉네임)  추천', SUMMARY_COL, 'left');

    let content = '';
    content += ` ${ansiColor(11)}${labelLine.trimStart()}${ANSI_RESET}\n`;
    content += `${ansiColor(7)}${subLine}${ANSI_RESET}\n`;
    content += ansiHLine(80, 8) + '\n';

    for (let i = 0; i < 10; i++) {
      const lvUser = levels[i];
      const postUser = posts[i];
      const recUser = recommends[i];

      const col1 = lvUser
        ? ansiColor(15) + buildCell(i + 1, lvUser, String(lvUser.level).padStart(4, ' '), SUMMARY_COL, SUMMARY_NAME, 2) + ANSI_RESET
        : emptyCell(SUMMARY_COL);
      const col2 = postUser
        ? ansiColor(14) + buildCell(i + 1, postUser, String(postUser.count).padStart(5, ' '), SUMMARY_COL, SUMMARY_NAME, 2) + ANSI_RESET
        : emptyCell(SUMMARY_COL);
      const col3 = recUser
        ? ansiColor(10) + buildCell(i + 1, recUser, String(recUser.count).padStart(5, ' '), SUMMARY_COL, SUMMARY_NAME, 2) + ANSI_RESET
        : emptyCell(SUMMARY_COL);

      content += ` ${col1}${ansiColor(8)} │${ANSI_RESET}${col2}${ansiColor(8)} │${ANSI_RESET}${col3}\n`;
    }

    content += ansiHLine(80, 8) + '\n';
    content += ` ${ansiColor(14)}[1]레벨 [2]글수 [3]추천 [4]조회 | [M]오락실 [T]대문${ANSI_RESET}\n`;

    return header + content;
  }

  // 2. 상세 랭킹 화면 빌더 (Top 40을 2단으로 표시)
  function buildRankingDetailAnsi(list, title, unit = '') {
    const header = buildTopHeader(['오락실', `랭킹 상세 - ${title}`]);

    const subLine =
      ' ' +
      fitCell('  순위  아이디(닉네임)          점수', DETAIL_COL, 'left') + '   ' +
      fitCell('  순위  아이디(닉네임)          점수', DETAIL_COL, 'left');

    let content = '';
    content += ` ${ansiColor(11)}[ ${title} TOP 40 ]${ANSI_RESET}\n`;
    content += `${ansiColor(7)}${subLine}${ANSI_RESET}\n`;
    content += ansiHLine(80, 8) + '\n';

    const half = 20;
    for (let i = 0; i < half; i++) {
      const leftUser = list[i];
      const rightUser = list[i + half];

      const colLeft = leftUser
        ? ansiColor(15) + buildCell(i + 1, leftUser, scoreText(leftUser, unit), DETAIL_COL, DETAIL_NAME, 3) + ANSI_RESET
        : emptyCell(DETAIL_COL);
      const colRight = rightUser
        ? ansiColor(14) + buildCell(i + 1 + half, rightUser, scoreText(rightUser, unit), DETAIL_COL, DETAIL_NAME, 3) + ANSI_RESET
        : emptyCell(DETAIL_COL);

      content += ` ${colLeft}${ansiColor(8)} │ ${ANSI_RESET}${colRight}\n`;
    }

    content += ansiHLine(80, 8) + '\n';
    content += ` ${ansiColor(14)}[B]랭킹메뉴 [1]레벨 [2]글수 [3]추천 [4]조회 | [M]오락실 [T]대문${ANSI_RESET}\n`;

    return header + content;
  }

  // 레벨 랭킹은 level, 그 외는 count 필드를 점수로 사용한다.
  function scoreText(user, unit) {
    const val = user.level !== undefined ? user.level : user.count;
    return String(val).padStart(5, ' ') + unit;
  }

  return {
    buildRankingSummaryAnsi,
    buildRankingDetailAnsi
  };
}
