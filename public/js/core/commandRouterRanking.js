// [LOG: 20260622_2301] commandRouterRanking 구현 — 랭킹 입력 처리 라우터
export function createRankingCommandHandler(deps) {
  const {
    showMain,
    showBoardSelect,
    showRanking,
    showRankingDetail,
    state
  } = deps;

  return async function handleRankingCommand({ s, cmd, rawCmd, context }) {
    if (s === 'ranking-summary') {
      if (cmd === 'T') { await showMain(); return true; }
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('game'); return true; }
      if (rawCmd === '1') { await showRankingDetail('level'); return true; }
      if (rawCmd === '2') { await showRankingDetail('post'); return true; }
      if (rawCmd === '3') { await showRankingDetail('recommend'); return true; }
      if (rawCmd === '4') { await showRankingDetail('hit'); return true; }
      return false;
    }

    if (s === 'ranking-detail') {
      if (cmd === 'T') { await showMain(); return true; }
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('game'); return true; }
      if (cmd === 'B') { await showRanking(); return true; }
      if (rawCmd === '1') { await showRankingDetail('level'); return true; }
      if (rawCmd === '2') { await showRankingDetail('post'); return true; }
      if (rawCmd === '3') { await showRankingDetail('recommend'); return true; }
      if (rawCmd === '4') { await showRankingDetail('hit'); return true; }
      return false;
    }

    return false;
  };
}
