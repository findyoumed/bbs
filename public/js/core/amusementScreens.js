import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { findDoorArt } from './doorArtAssets.js';

// [LOG_ID: 20260623_1300] Restored GAME screen flow.
export function createAmusementScreens(deps) {
  const { ansiToHTML, applyCommandFooter, buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, buildRetroArtListAnsi, buildRetroArtViewAnsi, findMbtiType, cmdInput, getCommandFooterText, getMenuNodeByKey, renderScreenSequential, screenEl, setHint, setPrompt, state, updateURL } = deps;
  const focus = () => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) cmdInput.focus(); };
  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
  // afterBodyRender에서 footer 내용을 채운 뒤에야 renderAnsiScreenWithTopbarSequential이 하단을 드러낸다.
  const render = async (ansi, footer, prompt) => { await renderAnsiScreenWithTopbarSequential({ ansiText: ansi, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender: async () => { await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footer)); if (prompt) setPrompt(prompt); } }); focus(); };
  const validDate = (input) => { const value = String(input || '').replace(/\D/g, ''); if (value.length !== 8) return null; const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6))); return date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() === Number(value.slice(4, 6)) - 1 && date.getDate() === Number(value.slice(6)) ? date : null; };
  const validYear = (input) => { const year = Number(String(input || '').replace(/\D/g, '')); return year >= 1900 && year <= new Date().getFullYear() ? year : null; };
  async function showBiorhythm(fromHistory = false) { state.screen = 'bio-input'; state.serviceData = { kind: 'biorhythm' }; if (!fromHistory) updateURL(); await render(buildBiorhythmIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); }
  async function showBiorhythmResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; } state.screen = 'bio-result'; state.serviceData = { kind: 'biorhythm', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildBiorhythmAnsi(birth), 'amusementView'); return true; }
  async function showFortune(fromHistory = false) { state.screen = 'fortune-input'; state.serviceData = { kind: 'fortune' }; if (!fromHistory) updateURL(); await render(buildFortuneIntroAnsi(), 'amusementInput', '태어난 연도 입력 (예: 1990) >> '); }
  async function showFortuneResult(input, fromHistory = false) { const year = typeof input === 'number' ? input : validYear(input); if (!year) { setHint('태어난 연도 4자리를 입력하세요. 예) 1990'); return false; } state.screen = 'fortune-result'; state.serviceData = { kind: 'fortune', birthYear: year }; if (!fromHistory) updateURL(); await render(buildFortuneAnsi(year), 'amusementView'); return true; }
  async function showMbti(fromHistory = false) { state.screen = 'mbti-list'; state.serviceData = { kind: 'mbti' }; if (!fromHistory) updateURL(); await render(buildMbtiListAnsi(), 'amusementInput', '번호 또는 유형코드 입력 (예: INFP) >> '); }
  async function showMbtiDetail(input, fromHistory = false) { const type = findMbtiType(input); if (!type) { setHint('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.'); return false; } state.screen = 'mbti-detail'; state.serviceData = { kind: 'mbti', mbtiCode: type.code }; state._mbtiCode = type.code; if (!fromHistory) updateURL(); await render(buildMbtiDetailAnsi(type), 'amusementView'); return true; }
  // [LOG_ID: 20260711_1400] 추억의 접속화면 — olddos-bbs(hanulso) txt/door 원본 아트 뷰어.
  async function showRetroArt(fromHistory = false) { state.screen = 'retro-list'; state.serviceData = { kind: 'retro-art' }; if (!fromHistory) updateURL(); await render(buildRetroArtListAnsi(), 'amusementInput', '번호 입력 >> '); }
  async function showRetroArtView(input, fromHistory = false) { const item = findDoorArt(input); if (!item) { setHint('목록의 번호를 입력하세요.'); return false; } state.screen = 'retro-view'; state.serviceData = { kind: 'retro-art', artKey: item.key }; if (!fromHistory) updateURL(); await render(buildRetroArtViewAnsi(item), 'amusementView'); return true; }
  return { showBiorhythm, showBiorhythmResult, showFortune, showFortuneResult, showMbti, showMbtiDetail, showRetroArt, showRetroArtView };
}
