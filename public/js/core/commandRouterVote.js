// [LOG: 20260622_2301] commandRouterVote 구현 — 설문조사 입력 처리 라우터
export function createVoteCommandHandler(deps) {
  const {
    showMain,
    showBoardSelect,
    showVoteList,
    showVoteDetail,
    castVote,
    showVoteCreate,
    submitVote,
    setHint,
    setPrompt,
    state
  } = deps;

  return async function handleVoteCommand({ s, cmd, rawCmd, context }) {
    if (s === 'vote-list') {
      if (cmd === 'T') { await showMain(); return true; }
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('game'); return true; }
      if (cmd === 'W') {
        if (!context || context.isGuest) {
          setHint('설문조사 등록은 로그인 후에 가능합니다.');
          return true;
        }
        await showVoteCreate();
        return true;
      }
      const voteId = Number(rawCmd);
      if (!isNaN(voteId) && voteId > 0) {
        await showVoteDetail(voteId);
        return true;
      }
      return false;
    }

    if (s === 'vote-detail') {
      if (cmd === 'T') { await showMain(); return true; }
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('game'); return true; }
      if (cmd === 'B') { await showVoteList(); return true; }

      const voteId = state.serviceData?.voteId;
      const optionIndex = Number(rawCmd) - 1; // 1-based to 0-based

      if (!isNaN(optionIndex) && optionIndex >= 0) {
        if (!context || context.isGuest) {
          setHint('투표에 참여하려면 로그인이 필요합니다.');
          return true;
        }
        await castVote(voteId, optionIndex);
        return true;
      }
      return false;
    }

    if (s === 'vote-create') {
      if (cmd === 'B' || cmd === 'P' || cmd === 'M' || cmd === 'T') {
        await showVoteList();
        return true;
      }

      if (state.voteCreateStep === 0) {
        const title = String(rawCmd || '').trim();
        if (!title) {
          setHint('제목을 정확히 입력해 주세요.');
          return true;
        }
        state.voteCreateData.title = title;
        state.voteCreateStep = 1;
        setPrompt('선택지 입력 (쉼표로 구분) >> ');
        setHint('선택지 예시: 짜장면, 짬뽕, 탕수육');
        return true;
      }

      if (state.voteCreateStep === 1) {
        const optionsRaw = String(rawCmd || '').trim();
        const options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);
        if (options.length < 2) {
          setHint('최소 2개 이상의 선택지가 필요합니다. (예: 짜장면, 짬뽕)');
          return true;
        }
        const title = state.voteCreateData.title;
        await submitVote(title, options);
        return true;
      }

      return false;
    }

    return false;
  };
}
