import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { findDoorArt, DOOR_ART } from './doorArtAssets.js';
import { createServiceUiUtils } from './serviceUiUtils.js';
import { createArcadeScreens } from './arcadeScreens.js';

// [LOG_ID: 20260623_1300] Restored GAME screen flow.
export function createAmusementScreens(deps) {
  const { ansiToHTML, applyCommandFooter, buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, buildBloodIntroAnsi, buildBloodAnsi, findBloodType, buildCompatIntroAnsi, buildCompatIntro2Ansi, buildCompatAnsi, buildTojeongIntroAnsi, buildTojeongAnsi, buildRetroArtListAnsi, buildRetroArtViewAnsi, findMbtiType, cmdInput, getCommandFooterText, getMenuNodeByKey, renderScreenSequential, screenEl, setHint, setPrompt, state, updateURL, displayWidth } = deps;
  
  // [LOG: 20260713_1355] 핫스팟 생성을 위한 공통 UI 유틸리티 초기화
  const { measureServiceLineBounds, estimateServiceLineBounds, createHotspotLayer, createHotspotButton } = createServiceUiUtils({ displayWidth });

  const focus = () => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) cmdInput.focus(); };
  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
  // afterBodyRender에서 footer 내용을 채운 뒤에야 renderAnsiScreenWithTopbarSequential이 하단을 드러낸다.
  const render = async (ansi, footer, prompt) => { const rendered = await renderAnsiScreenWithTopbarSequential({ ansiText: ansi, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender: async () => { await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footer)); if (prompt) setPrompt(prompt); } }); focus(); return rendered; };
  const validDate = (input) => { const value = String(input || '').replace(/\D/g, ''); if (value.length !== 8) return null; const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6))); return date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() === Number(value.slice(4, 6)) - 1 && date.getDate() === Number(value.slice(6)) ? date : null; };
  const validYear = (input) => { const year = Number(String(input || '').replace(/\D/g, '')); return year >= 1900 && year <= new Date().getFullYear() ? year : null; };
  async function showBiorhythm(fromHistory = false) { state.screen = 'bio-input'; state.serviceData = { kind: 'biorhythm' }; if (!fromHistory) updateURL(); await render(buildBiorhythmIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); }
  async function showBiorhythmResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; } state.screen = 'bio-result'; state.serviceData = { kind: 'biorhythm', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildBiorhythmAnsi(birth), 'amusementView'); return true; }
  async function showFortune(fromHistory = false) { state.screen = 'fortune-input'; state.serviceData = { kind: 'fortune' }; if (!fromHistory) updateURL(); await render(buildFortuneIntroAnsi(), 'amusementInput', '태어난 연도 입력 (예: 1990) >> '); }
  async function showFortuneResult(input, fromHistory = false) { const year = typeof input === 'number' ? input : validYear(input); if (!year) { setHint('태어난 연도 4자리를 입력하세요. 예) 1990'); return false; } state.screen = 'fortune-result'; state.serviceData = { kind: 'fortune', birthYear: year }; if (!fromHistory) updateURL(); await render(buildFortuneAnsi(year), 'amusementView'); return true; }
  async function showMbti(fromHistory = false) { state.screen = 'mbti-list'; state.serviceData = { kind: 'mbti' }; if (!fromHistory) updateURL(); await render(buildMbtiListAnsi(), 'amusementInput', '번호 또는 유형코드 입력 (예: INFP) >> '); }
  async function showMbtiDetail(input, fromHistory = false) { const type = findMbtiType(input); if (!type) { setHint('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.'); return false; } state.screen = 'mbti-detail'; state.serviceData = { kind: 'mbti', mbtiCode: type.code }; state._mbtiCode = type.code; if (!fromHistory) updateURL(); await render(buildMbtiDetailAnsi(type), 'amusementView'); return true; }

  // [LOG_ID: 20260719_1600] 천리안 원전 온라인 철학관(BLOOD/SAJU) 재현 — 혈액형 성격진단/궁합/토정비결.
  // 결과는 URL로 복원하지 않는다(바이오리듬/오늘의운세/MBTI와 동일하게, 새로고침 시 입력 화면으로 복귀).
  async function showBlood(fromHistory = false) { state.screen = 'blood-input'; state.serviceData = { kind: 'blood' }; if (!fromHistory) updateURL(); await render(buildBloodIntroAnsi(), 'amusementInput', '혈액형 입력 (A/B/O/AB) >> '); }
  async function showBloodResult(input, fromHistory = false) { const type = findBloodType(input); if (!type) { setHint('혈액형을 A, B, O, AB 중에서 입력하세요.'); return false; } state.screen = 'blood-result'; state.serviceData = { kind: 'blood', bloodCode: type.code }; if (!fromHistory) updateURL(); await render(buildBloodAnsi(type), 'amusementView'); return true; }

  async function showCompat(fromHistory = false) { state.screen = 'compat-input'; state.serviceData = { kind: 'compat' }; if (!fromHistory) updateURL(); await render(buildCompatIntroAnsi(), 'amusementInput', '첫 번째 사람 생년월일 입력 (예: 19900101) >> '); }
  async function showCompatStep2(input, fromHistory = false) {
    const birth1 = input instanceof Date ? input : validDate(input);
    if (!birth1) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; }
    state.screen = 'compat-input2';
    state.serviceData = { kind: 'compat', birth1: birth1.getTime() };
    if (!fromHistory) updateURL();
    await render(buildCompatIntro2Ansi(birth1), 'amusementInput', '두 번째 사람 생년월일 입력 (예: 19950505) >> ');
    return true;
  }
  async function showCompatResult(input, fromHistory = false) {
    const birth2 = input instanceof Date ? input : validDate(input);
    if (!birth2) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1995-05-05'); return false; }
    const birth1Time = state.serviceData?.birth1;
    if (!birth1Time) { await showCompat(fromHistory); return false; }
    const birth1 = new Date(birth1Time);
    state.screen = 'compat-result';
    state.serviceData = { kind: 'compat', birth1: birth1Time, birth2: birth2.getTime() };
    if (!fromHistory) updateURL();
    await render(buildCompatAnsi(birth1, birth2), 'amusementView');
    return true;
  }

  async function showTojeong(fromHistory = false) { state.screen = 'tojeong-input'; state.serviceData = { kind: 'tojeong' }; if (!fromHistory) updateURL(); await render(buildTojeongIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); }
  async function showTojeongResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; } state.screen = 'tojeong-result'; state.serviceData = { kind: 'tojeong', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildTojeongAnsi(birth), 'amusementView'); return true; }

  // [LOG: 20260713_1355] 추억의 접속화면(retro-list) 목록 마우스 호버 및 클릭(핫스팟) 활성화
  function renderRetroArtListHotspots(screenNode, items, lineOffset = 3) {
    if (!screenNode || !items.length) return;
    const layer = createHotspotLayer();
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    items.forEach((item, index) => {
      const rowIdx = lineOffset + index;
      if (!lineNodes[rowIdx]) return;
      const text = lineNodes[rowIdx].textContent || '';
      if (!text.trim()) return;

      const bounds = measureServiceLineBounds(screenNode, lineNodes[rowIdx]) || estimateServiceLineBounds(screenNode, lineNodes[rowIdx]);
      if (!bounds) return;

      const btn = createHotspotButton(String(index + 1), item.name || '', bounds);
      layer.appendChild(btn);
    });

    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  // [LOG_ID: 20260711_1400] 추억의 접속화면 — olddos-bbs(hanulso) txt/door 원본 아트 뷰어.
  async function showRetroArt(fromHistory = false) { state.screen = 'retro-list'; state.serviceData = { kind: 'retro-art' }; if (!fromHistory) updateURL(); const rendered = await render(buildRetroArtListAnsi(), 'amusementInput', '번호 입력 >> '); if (rendered && rendered.screenNode) { renderRetroArtListHotspots(rendered.screenNode, DOOR_ART, 3); } }
  async function showRetroArtView(input, fromHistory = false) { const item = findDoorArt(input); if (!item) { setHint('목록의 번호를 입력하세요.'); return false; } state.screen = 'retro-view'; state.serviceData = { kind: 'retro-art', artKey: item.key }; if (!fromHistory) updateURL(); const rendered = await render(buildRetroArtViewAnsi(item), 'amusementView'); if (rendered && rendered.screenNode) { rendered.screenNode.style.cursor = 'pointer'; rendered.screenNode.title = '클릭하면 목록으로 돌아갑니다 (L)'; rendered.screenNode.addEventListener('click', async (e) => { if (e.target.closest('a')) return; await showRetroArt(); }); } return true; }
  // [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" — 오락실 게임 5종.
  // render 헬퍼를 공유해 이 return 에 spread 하면 appFactoryRuntime 의 ...screens.amusementScreens
  // spread 를 통해 refs/라우팅/서비스핸들러에 자동 등록된다.
  const arcade = createArcadeScreens({ ...deps, render });
  return { showBiorhythm, showBiorhythmResult, showFortune, showFortuneResult, showMbti, showMbtiDetail, showBlood, showBloodResult, showCompat, showCompatStep2, showCompatResult, showTojeong, showTojeongResult, showRetroArt, showRetroArtView, ...arcade };
}
