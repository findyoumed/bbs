import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

// [LOG: 20260622_2301] rankingScreens 구현 — 랭킹 스크린 모듈
export function createRankingScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    applyCommandFooter,
    buildRankingSummaryAnsi,
    buildRankingDetailAnsi,
    cmdInput,
    getCommandFooterText,
    getMenuNodeByKey,
    renderScreenSequential,
    screenEl,
    setHint,
    setPrompt,
    state,
    updateURL
  } = deps;

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function pushHistory() {
    state.history.push({
      screen: state.screen,
      board: state.board,
      boardMenuPath: state.boardMenuPath,
      boardMenuTitle: state.boardMenuTitle,
      serviceData: JSON.parse(JSON.stringify(state.serviceData || {})),
      page: state.page
    });
  }

  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
  // afterBodyRender에서 footer 내용을 채운 뒤에야 하단이 드러난다.
  async function render(ansiText, footerCategory, prompt) {
    await renderAnsiScreenWithTopbarSequential({
      ansiText, ansiToHTML, screenEl, renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footerCategory));
        if (prompt && typeof setPrompt === 'function') setPrompt(prompt);
      }
    });
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  // 1. 종합 랭킹 화면 표시
  async function showRanking(fromHistory = false) {
    state.screen = 'ranking-summary';
    state.serviceData = { kind: 'ranking' };
    if (!fromHistory) { updateURL(); pushHistory(); }

    try {
      const data = await apiFetch('/api/ranking');
      state._rankingData = data; // 상세 전환용 임시 캐싱
      const ansi = buildRankingSummaryAnsi(data);
      await render(ansi, 'amusementInput', '선택 >> ');
    } catch (e) {
      setHint('랭킹 정보를 가져오지 못했습니다: ' + e.message);
    }
  }

  // 2. 카테고리별 상세 랭킹 화면 표시
  async function showRankingDetail(category, fromHistory = false) {
    state.screen = 'ranking-detail';
    state.serviceData = { kind: 'ranking', category };
    if (!fromHistory) { updateURL(); pushHistory(); }

    try {
      let data = state._rankingData;
      if (!data) {
        data = await apiFetch('/api/ranking');
        state._rankingData = data;
      }

      let ansi = '';
      if (category === 'level') {
        ansi = buildRankingDetailAnsi(data.levelRanking || [], '레벨 랭킹', 'Lv');
      } else if (category === 'post') {
        ansi = buildRankingDetailAnsi(data.postRanking || [], '글작성 랭킹', '회');
      } else if (category === 'recommend') {
        ansi = buildRankingDetailAnsi(data.recommendRanking || [], '받은추천 랭킹', '표');
      } else if (category === 'hit') {
        ansi = buildRankingDetailAnsi(data.hitRanking || [], '글조회 랭킹', '회');
      } else {
        throw new Error('올바르지 않은 랭킹 종류입니다.');
      }

      await render(ansi, 'amusementInput', '선택 >> ');
    } catch (e) {
      setHint('랭킹 상세 정보를 가져오지 못했습니다: ' + e.message);
      await showRanking(true);
    }
  }

  return {
    showRanking,
    showRankingDetail
  };
}
