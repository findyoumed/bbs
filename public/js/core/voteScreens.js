import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';

// [LOG: 20260622_2301] voteScreens 구현 — 설문조사 스크린 모듈
export function createVoteScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    applyCommandFooter,
    buildVoteListAnsi,
    buildVoteDetailAnsi,
    buildVoteCreateAnsi,
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

  async function render(ansiText, footerCategory, prompt) {
    await renderAnsiScreenWithTopbar({ ansiText, ansiToHTML, screenEl, renderScreenSequential });
    await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footerCategory));
    if (prompt && typeof setPrompt === 'function') setPrompt(prompt);
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  // 1. 설문조사 목록 화면 표시
  async function showVoteList(fromHistory = false) {
    state.screen = 'vote-list';
    state.serviceData = { kind: 'vote' };
    if (!fromHistory) { updateURL(); pushHistory(); }

    try {
      const votes = await apiFetch('/api/votes');
      const ansi = buildVoteListAnsi(votes || []);
      await render(ansi, 'amusementInput', '설문 번호 입력 >> ');
    } catch (e) {
      setHint('설문조사 목록을 가져오지 못했습니다: ' + e.message);
    }
  }

  // 2. 설문조사 상세 및 결과 화면 표시
  async function showVoteDetail(voteId, fromHistory = false) {
    const id = Number(voteId);
    state.screen = 'vote-detail';
    state.serviceData = { kind: 'vote', voteId: id };
    if (!fromHistory) { updateURL(); pushHistory(); }

    try {
      const vote = await apiFetch(`/api/votes/${id}`);
      const ansi = buildVoteDetailAnsi(vote);
      const prompt = (vote.isActive && vote.userVotedOption === null) ? '투표 번호 입력 >> ' : '선택 >> ';
      await render(ansi, 'amusementInput', prompt);
    } catch (e) {
      setHint('설문 정보를 가져오지 못했습니다: ' + e.message);
      await showVoteList(true);
    }
  }

  // 3. 투표하기 실행
  async function castVote(voteId, optionIndex) {
    try {
      await apiFetch(`/api/votes/${voteId}/cast`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex })
      });
      setHint('투표가 성공적으로 반영되었습니다!');
      await showVoteDetail(voteId, true);
    } catch (e) {
      setHint('투표 실패: ' + e.message);
    }
  }

  // 4. 설문조사 생성 화면 표시
  async function showVoteCreate(fromHistory = false) {
    state.screen = 'vote-create';
    state.serviceData = { kind: 'vote', action: 'create' };
    state.voteCreateStep = 0; // 0: 제목 입력 대기, 1: 보기 입력 대기
    state.voteCreateData = { title: '', options: [] };
    if (!fromHistory) { updateURL(); pushHistory(); }

    await render(buildVoteCreateAnsi(), 'amusementInput', '설문 제목 입력 >> ');
  }

  // 5. 설문조사 생성 제출
  async function submitVote(title, options) {
    try {
      await apiFetch('/api/votes', {
        method: 'POST',
        body: JSON.stringify({ title, options })
      });
      setHint('설문조사가 성공적으로 등록되었습니다.');
      await showVoteList(true);
    } catch (e) {
      setHint('설문조사 등록 실패: ' + e.message);
    }
  }

  return {
    showVoteList,
    showVoteDetail,
    castVote,
    showVoteCreate,
    submitVote
  };
}
