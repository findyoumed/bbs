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
      // [LOG_ID: 20260722_2100] 20260714_1200 당시엔 여론광장이 TOP 7 최상위 항목이라 P/M이
      // 초기화면으로 가는 게 맞았는데, 그 뒤 20260718_2200에서 여론광장이 투표/설문·토론의
      // 광장을 담는 type="menu" 컨테이너로 바뀌면서(하이텔 원전 "(12)여론광장-1.토론의 광장"
      // 구조 재현) 투표/설문도 그 하위 항목이 됐다 — 이 주석/동작이 그 변경을 못 따라가서
      // P/M이 여전히 여론광장 메뉴를 건너뛰고 초기화면으로 가고 있었다(/policy, CONF와 같은
      // 패턴, 사용자 리포트로 발견).
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('agora'); return true; }
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
      // [LOG_ID: 20260722_2100] vote-list와 동일한 사유 — 상세 화면의 상위(P/M)도 목록이 아니라
      // (B가 이미 목록으로 감) 곧장 초기화면으로 두 단계를 건너뛰고 있었다. P/M은 원래
      // "한 단계 위"(사이트 전역 관례: M=P 동급) 의미이므로 여기서도 실제 상위인 여론광장
      // 메뉴로 보낸다 — 목록으로 한 단계만 가고 싶으면 기존처럼 B를 쓰면 된다.
      if (cmd === 'P' || cmd === 'M') { await showBoardSelect('agora'); return true; }
      if (cmd === 'B') { await showVoteList(); return true; }

      // [LOG_ID: 20260727_0245] 선택지가 많은 설문(옵션 10개+)은 이제 페이지네이션되므로,
      // 다른 페이징 화면(궁합/사주 등)과 동일하게 F로 다음 페이지를 넘긴다.
      if (cmd === 'F') {
        const pageNo = state.serviceData?.pageNo || 1;
        const pageCount = state.serviceData?.pageCount || 1;
        if (pageNo < pageCount) {
          await showVoteDetail(state.serviceData?.voteId, false, pageNo + 1);
          return true;
        }
      }

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
