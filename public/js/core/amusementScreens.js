import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';
import { findDoorArt, DOOR_ART } from './doorArtAssets.js';
import { createServiceUiUtils } from './serviceUiUtils.js';
import { createArcadeScreens } from './arcadeScreens.js';

// [LOG_ID: 20260623_1300] Restored GAME screen flow.
export function createAmusementScreens(deps) {
  const { ansiToHTML, applyCommandFooter, mountPromptRow, restorePromptRow, buildBiorhythmIntroAnsi, buildBiorhythmAnsi, buildFortuneIntroAnsi, buildFortuneAnsi, buildMbtiListAnsi, buildMbtiDetailAnsi, buildBloodIntroAnsi, buildBloodAnsi, findBloodType, buildCompatIntroAnsi, buildCompatIntro2Ansi, buildCompatAnsi, buildTojeongIntroAnsi, buildTojeongAnsi, buildRetroArtListAnsi, buildRetroArtViewAnsi, findMbtiType, buildMbtiIntroAnsi, buildMbtiTestQuestionAnsi, calculateMbtiFromAnswers, MBTI_QUESTIONS, MBTI_TYPES, cmdInput, getCommandFooterText, getMenuNodeByKey, renderScreenSequential, screenEl, setHint, setPrompt, state, updateURL, displayWidth } = deps;
  
  // [LOG: 20260713_1355] 핫스팟 생성을 위한 공통 UI 유틸리티 초기화
  const { measureServiceLineBounds, estimateServiceLineBounds, createHotspotLayer, createHotspotButton } = createServiceUiUtils({ displayWidth });

  const focus = () => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) cmdInput.focus(); };
  // [LOG_ID: 20260723_1102] 오락실 입력 화면 공통 인라인 마운트 헬퍼
  function inlineMount(hostId, hostClass) { if (screenEl && typeof mountPromptRow === 'function') { let host = document.getElementById(hostId); if (!host) { host = document.createElement('div'); host.id = hostId; host.className = hostClass; screenEl.appendChild(host); } mountPromptRow(host); } }
  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
  // afterBodyRender에서 footer 내용을 채운 뒤에야 renderAnsiScreenWithTopbarSequential이 하단을 드러낸다.
  const render = async (ansi, footer, prompt) => { const rendered = await renderAnsiScreenWithTopbarSequential({ ansiText: ansi, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender: async () => { if (footer === 'none') { await applyCommandFooter(null, ''); if (prompt !== undefined) setPrompt(prompt); } else { await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footer)); if (prompt !== undefined) setPrompt(prompt); } } }); focus(); return rendered; };
  const validDate = (input) => { const value = String(input || '').replace(/\D/g, ''); if (value.length !== 8) return null; const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6))); return date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() === Number(value.slice(4, 6)) - 1 && date.getDate() === Number(value.slice(6)) ? date : null; };
  const validYear = (input) => { const year = Number(String(input || '').replace(/\D/g, '')); return year >= 1900 && year <= new Date().getFullYear() ? year : null; };
  async function showBiorhythm(fromHistory = false) { state.screen = 'bio-input'; state.serviceData = { kind: 'biorhythm' }; if (!fromHistory) updateURL(); await render(buildBiorhythmIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('bio-prompt-host', 'game-prompt-host'); }
  async function showBiorhythmResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'bio-result'; state.serviceData = { kind: 'biorhythm', birth: birth.getTime() }; if (!fromHistory) updateURL(); const userName = state.user?.nickname || state.user?.username || state.user?.name || '사용자'; await render(buildBiorhythmAnsi(birth, new Date(), userName), 'amusementView', '선택 >> '); return true; }
  // [LOG: 20260724_0948] 생년월일 8자리 입력 처리 및 birth 전달
  async function showFortune(fromHistory = false) { state.screen = 'fortune-input'; state.serviceData = { kind: 'fortune' }; if (!fromHistory) updateURL(); await render(buildFortuneIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('fortune-prompt-host', 'game-prompt-host'); }
  async function showFortuneResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 19900101'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'fortune-result'; state.serviceData = { kind: 'fortune', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildFortuneAnsi(birth), 'amusementView', '선택 >> '); return true; }

  // [LOG_ID: 20260723_1134] MBTI 화면 요소별 마우스 호버/클릭(핫스팟) 바인딩 헬퍼
  function attachMbtiHotspots(screenNode, items) {
    if (!screenNode || !items || !items.length) return;
    const layer = createHotspotLayer();
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));

    items.forEach((item) => {
      let targetLine = null;
      if (typeof item.lineIndex === 'number') {
        targetLine = lineNodes[item.lineIndex];
      } else if (item.matchRegex) {
        targetLine = lineNodes.find((ln) => item.matchRegex.test(ln.textContent || ''));
      } else if (item.matchText) {
        targetLine = lineNodes.find((ln) => (ln.textContent || '').includes(item.matchText));
      }

      if (!targetLine) return;
      const text = targetLine.textContent || '';
      if (!text.trim()) return;

      const bounds = measureServiceLineBounds(screenNode, targetLine) || estimateServiceLineBounds(screenNode, targetLine);
      if (!bounds) return;

      const btn = createHotspotButton(String(item.value), item.title || text.trim(), bounds);
      if (item.onClick) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.onClick();
        });
      }
      layer.appendChild(btn);
    });

    if (layer.childElementCount > 0) screenNode.appendChild(layer);
  }

  // [LOG_ID: 20260723_1130] MBTI 자가 진단 테스트 프로세스
  async function showMbti(fromHistory = false) {
    state.screen = 'mbti-intro';
    state.serviceData = { kind: 'mbti', step: 'intro' };
    if (!fromHistory) updateURL();
    const rendered = await render(buildMbtiIntroAnsi(), 'amusementInput', '선택 (1~2, 엔터시 진단 시작) >> ');
    inlineMount('mbti-intro-prompt-host', 'game-prompt-host');
    if (rendered && rendered.screenNode) {
      attachMbtiHotspots(rendered.screenNode, [
        { matchRegex: /^\s*1\.\s/, value: '1', title: '자가 진단 시작', onClick: async () => await startMbtiTest() },
        { matchRegex: /^\s*2\.\s/, value: '2', title: '목록 보기', onClick: async () => await showMbtiList() }
      ]);
    }
  }

  async function showMbtiList(fromHistory = false) {
    state.screen = 'mbti-list';
    state.serviceData = { kind: 'mbti', step: 'list' };
    if (!fromHistory) updateURL();
    const rendered = await render(buildMbtiListAnsi(), 'amusementInput', '번호 또는 유형코드 입력 (예: INFP) >> ');
    inlineMount('mbti-list-prompt-host', 'game-prompt-host');
    if (rendered && rendered.screenNode) {
      const items = (MBTI_TYPES || []).map(([code, nick], idx) => ({
        matchRegex: new RegExp(`^\\s*${idx + 1}\\.\\s`),
        value: String(idx + 1),
        title: `${code} (${nick})`,
        onClick: async () => await showMbtiDetail(code)
      }));
      attachMbtiHotspots(rendered.screenNode, items);
    }
  }

  async function startMbtiTest(fromHistory = false) {
    await showMbtiQuestion(0, [], fromHistory);
  }

  async function showMbtiQuestion(qIndex, answers = [], fromHistory = false) {
    state.screen = 'mbti-test';
    state.serviceData = { kind: 'mbti', step: 'test', qIndex, answers };
    if (!fromHistory) updateURL();
    const rendered = await render(buildMbtiTestQuestionAnsi(qIndex, answers), 'amusementInput', `선택 (1 또는 2) [질문 ${qIndex + 1}/12] >> `);
    inlineMount('mbti-test-prompt-host', 'game-prompt-host');
    if (rendered && rendered.screenNode) {
      attachMbtiHotspots(rendered.screenNode, [
        { matchRegex: /^\s*1\.\s/, value: '1', title: '1번 선택', onClick: async () => await handleMbtiAnswer('1') },
        { matchRegex: /^\s*2\.\s/, value: '2', title: '2번 선택', onClick: async () => await handleMbtiAnswer('2') }
      ]);
    }
  }

  async function handleMbtiAnswer(input) {
    const raw = String(input || '').trim();
    const upper = raw.toUpperCase();

    // 현재 상태 확인
    const sd = state.serviceData;
    if (!sd || sd.kind !== 'mbti') {
      await showMbti();
      return true;
    }

    // 1. 안내 화면(intro)에서 선택
    if (sd.step === 'intro' || state.screen === 'mbti-intro') {
      if (raw === '2') {
        await showMbtiList();
        return true;
      }
      // 1번이나 빈 엔터나 기타 입력 시 자가 진단 시작
      await startMbtiTest();
      return true;
    }

    // 2. 목록 보기(list) 상태에서 입력 시
    if (sd.step === 'list' || state.screen === 'mbti-list') {
      const type = findMbtiType(raw);
      if (type) {
        await showMbtiDetail(type.code);
        return true;
      }
      if (raw === '1' || raw === 'T' || upper === 'T') {
        await startMbtiTest();
        return true;
      }
      setHint('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.');
      return false;
    }

    // 3. 자가 진단(test) 중일 때 질문 응답
    if (sd.step === 'test' || state.screen === 'mbti-test') {
      const qIndex = sd.qIndex || 0;
      const answers = sd.answers ? [...sd.answers] : [];

      if (upper === 'B' || upper === 'BACK') {
        if (qIndex > 0) {
          await showMbtiQuestion(qIndex - 1, answers);
        } else {
          await showMbti();
        }
        return true;
      }

      if (raw === '1' || raw === '2') {
        const choice = Number(raw);
        answers[qIndex] = choice;

        const nextIndex = qIndex + 1;
        if (nextIndex < MBTI_QUESTIONS.length) {
          await showMbtiQuestion(nextIndex, answers);
        } else {
          // 12문항 모두 응답 완료 -> 결과 계산
          const resultMbti = calculateMbtiFromAnswers(answers);
          setHint(`[진단 완료] 당신의 성격유형은 ${resultMbti}입니다!`);
          await showMbtiDetail(resultMbti);
        }
        return true;
      }

      setHint('선택지 번호(1 또는 2)를 입력하세요.');
      return false;
    }

    // 기타 상태
    const type = findMbtiType(raw);
    if (type) {
      await showMbtiDetail(type.code);
      return true;
    }
    await showMbti();
    return true;
  }

  async function showMbtiDetail(input, fromHistory = false) { const type = findMbtiType(input); if (!type) { setHint('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'mbti-detail'; state.serviceData = { kind: 'mbti', mbtiCode: type.code }; state._mbtiCode = type.code; if (!fromHistory) updateURL(); await render(buildMbtiDetailAnsi(type), 'amusementView', '선택 >> '); return true; }

  // [LOG_ID: 20260719_1600] 천리안 원전 온라인 철학관(BLOOD/SAJU) 재현 — 혈액형 성격진단/궁합/토정비결.
  // 결과는 URL로 복원하지 않는다(바이오리듬/오늘의운세/MBTI와 동일하게, 새로고침 시 입력 화면으로 복귀).
  // [LOG_ID: 20260724_0955] 혈액형 입력 프롬프트 내 마우스 호버 및 클릭(핫스팟) 적용
  function attachBloodPromptHotspots() {
    const promptRow = document.querySelector('#blood-prompt-host #terminal-prompt-row');
    if (!promptRow) return;
    let mock = promptRow.querySelector('#blood-prompt-renderer-mock');
    if (mock) mock.remove();
    const realRenderer = promptRow.querySelector('#cmd-prompt-renderer');
    if (!realRenderer) return;

    realRenderer.style.display = 'none';

    mock = document.createElement('div');
    mock.id = 'blood-prompt-renderer-mock';
    mock.style.cssText = `
      display: inline-block;
      font-family: inherit !important;
      font-size: inherit !important;
      color: #ffffff;
      background: var(--bgcolor, #000);
      margin: 0;
      padding: 0;
      box-sizing: content-box;
      vertical-align: middle;
      white-space: pre;
      user-select: none;
    `;
    mock.innerHTML = `혈액형 입력 (<span class="blood-hotspot" data-val="A">A</span>/<span class="blood-hotspot" data-val="B">B</span>/<span class="blood-hotspot" data-val="O">O</span>/<span class="blood-hotspot" data-val="AB">AB</span>) >> `;

    const hotspots = mock.querySelectorAll('.blood-hotspot');
    hotspots.forEach(el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = el.getAttribute('data-val');
        await showBloodResult(val);
      });
    });

    realRenderer.parentNode.insertBefore(mock, realRenderer);
  }

  async function showBlood(fromHistory = false) {
    state.screen = 'blood-input';
    state.serviceData = { kind: 'blood' };
    if (!fromHistory) updateURL();
    await render(buildBloodIntroAnsi(), 'amusementInput', '혈액형 입력 (A/B/O/AB) >> ');
    inlineMount('blood-prompt-host', 'game-prompt-host');
    attachBloodPromptHotspots();
  }
  // [LOG_ID: 20260724_0957] 혈액형 결과 화면 본문 안내문 내 A/B/O/AB 클릭 가능하게 치환 적용
  function attachBloodResultHotspots(screenNode) {
    if (!screenNode) return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const targetLine = lineNodes.find(ln => (ln.textContent || '').includes('다른 혈액형을 보려면'));
    if (!targetLine) return;

    let html = targetLine.innerHTML;
    const replacement = '<span class="blood-hotspot" data-val="A">A</span>/<span class="blood-hotspot" data-val="B">B</span>/<span class="blood-hotspot" data-val="O">O</span>/<span class="blood-hotspot" data-val="AB">AB</span>';
    if (html.includes('A/B/O/AB')) {
      targetLine.innerHTML = html.replace('A/B/O/AB', replacement);
    }

    const hotspots = targetLine.querySelectorAll('.blood-hotspot');
    hotspots.forEach(el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = el.getAttribute('data-val');
        await showBloodResult(val);
      });
    });
  }

  async function showBloodResult(input, fromHistory = false, pageNo = 1) { const type = findBloodType(input); if (!type) { setHint('혈액형을 A, B, O, AB 중에서 입력하세요.'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'blood-result'; const built = buildBloodAnsi(type, pageNo); state.serviceData = { kind: 'blood', bloodCode: type.code, pageNo: built.pageNo, pageCount: built.pageCount }; if (!fromHistory) updateURL(); const rendered = await render(built.text, 'amusementView', '선택 >> '); if (rendered && rendered.screenNode) { attachBloodResultHotspots(rendered.screenNode); } return true; }

  async function showCompat(fromHistory = false) { state.screen = 'compat-input'; state.serviceData = { kind: 'compat' }; if (!fromHistory) updateURL(); await render(buildCompatIntroAnsi(), 'amusementInput', '첫 번째 사람 생년월일 입력 (예: 19900101) >> '); inlineMount('compat-prompt-host', 'game-prompt-host'); }
  async function showCompatStep2(input, fromHistory = false) {
    const birth1 = input instanceof Date ? input : validDate(input);
    if (!birth1) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; }
    state.screen = 'compat-input2';
    state.serviceData = { kind: 'compat', birth1: birth1.getTime() };
    if (!fromHistory) updateURL();
    await render(buildCompatIntro2Ansi(birth1), 'amusementInput', '두 번째 사람 생년월일 입력 (예: 19950505) >> ');
    inlineMount('compat2-prompt-host', 'game-prompt-host');
    return true;
  }
  async function showCompatResult(input, fromHistory = false) {
    const birth2 = input instanceof Date ? input : validDate(input);
    if (!birth2) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1995-05-05'); return false; }
    const birth1Time = state.serviceData?.birth1;
    if (!birth1Time) { await showCompat(fromHistory); return false; }
    if (typeof restorePromptRow === 'function') { restorePromptRow(); }
    const birth1 = new Date(birth1Time);
    state.screen = 'compat-result';
    state.serviceData = { kind: 'compat', birth1: birth1Time, birth2: birth2.getTime() };
    if (!fromHistory) updateURL();
    await render(buildCompatAnsi(birth1, birth2), 'amusementView', '선택 >> ');
    return true;
  }

  async function showTojeong(fromHistory = false) { state.screen = 'tojeong-input'; state.serviceData = { kind: 'tojeong' }; if (!fromHistory) updateURL(); await render(buildTojeongIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('tojeong-prompt-host', 'game-prompt-host'); }
  async function showTojeongResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { setHint('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'tojeong-result'; state.serviceData = { kind: 'tojeong', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildTojeongAnsi(birth), 'amusementView', '선택 >> '); return true; }

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
  // [LOG_ID: 20260722_2500] 사용자 지적 — "다른 메뉴들은 선택 >> 같은데, 번호라고 표시하는 메뉴가
  // 있어?" 이 목록은 바이오리듬/혈액형처럼 실제 자유 입력(생년월일 등)을 받는 화면이 아니라
  // 목록에 보이는 번호(1~8)만 고르는 화면이라(findDoorArt는 표시되지 않는 key 매칭도 지원하지만
  // 화면엔 번호만 노출됨) GAME 메뉴·board-select 등 다른 번호 선택 목록과 구조가 같다 — 세 번째
  // 인자(커스텀 프롬프트)를 빼서 다른 목록 화면과 동일한 기본 프롬프트("선택 >>")를 쓰도록 통일한다.
  async function showRetroArt(fromHistory = false) { state.screen = 'retro-list'; state.serviceData = { kind: 'retro-art' }; if (!fromHistory) updateURL(); const rendered = await render(buildRetroArtListAnsi(), 'amusementView', '선택 >> '); inlineMount('retro-prompt-host', 'game-prompt-host'); if (rendered && rendered.screenNode) { renderRetroArtListHotspots(rendered.screenNode, DOOR_ART, 3); } }
  async function showRetroArtView(input, fromHistory = false) { const item = findDoorArt(input); if (!item) { setHint('목록의 번호를 입력하세요.'); return false; } if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'retro-view'; state.serviceData = { kind: 'retro-art', artKey: item.key }; if (!fromHistory) updateURL(); const rendered = await render(buildRetroArtViewAnsi(item), 'amusementView', '선택 >> '); if (rendered && rendered.screenNode) { rendered.screenNode.style.cursor = 'pointer'; rendered.screenNode.title = '클릭하면 목록으로 돌아갑니다 (L)'; rendered.screenNode.addEventListener('click', async (e) => { if (e.target.closest('a')) return; await showRetroArt(); }); } return true; }
  // [LOG_ID: 20260720_1358] 천리안 원전 6.14.1 "컴퓨터와 게임을" — 오락실 게임 5종.
  // render 헬퍼를 공유해 이 return 에 spread 하면 appFactoryRuntime 의 ...screens.amusementScreens
  // spread 를 통해 refs/라우팅/서비스핸들러에 자동 등록된다.
  const arcade = createArcadeScreens({ ...deps, render });
  return { showBiorhythm, showBiorhythmResult, showFortune, showFortuneResult, showMbti, showMbtiDetail, showMbtiList, startMbtiTest, handleMbtiAnswer, showBlood, showBloodResult, showCompat, showCompatStep2, showCompatResult, showTojeong, showTojeongResult, showRetroArt, showRetroArtView, ...arcade };
}
