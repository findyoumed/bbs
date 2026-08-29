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
  // [LOG_ID: 20260726_1515] 뷰포트 밖으로 밀려나는 문제(20260726_1500)의 scrollIntoView 처리는
  // 이제 mountPromptRow 공용 함수(terminalHintFooter.js) 안으로 옮겨져 모든 호출부에 자동 적용된다.
  function inlineMount(hostId, hostClass) { if (screenEl && typeof mountPromptRow === 'function') { let host = document.getElementById(hostId); if (!host) { host = document.createElement('div'); host.id = hostId; host.className = hostClass; screenEl.appendChild(host); } mountPromptRow(host); } }
  // [LOG_ID: 20260829_1015] 게임 입력 오류도 건의/쪽지/게시글 편집기와 같은
  // 본문 인라인 영역에 표시한다. setHint()는 화면 문맥을 복원하면서 하단 힌트바를
  // 다시 그릴 수 있으므로, 게임 입력 화면에서는 전용 오류 행만 갱신한다.
  function clearGameValidationError() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.game-inline-validation').forEach((node) => node.remove());
  }
  function showGameValidationError(message, hostId) {
    if (typeof document === 'undefined') return;
    clearGameValidationError();
    const host = hostId ? document.getElementById(hostId) : null;
    const body = screenEl?.querySelector?.('.ansi-screen-body');
    const prompt = document.getElementById('terminal-prompt-row');
    const anchor = host || prompt;
    const parent = host?.parentNode || body || prompt?.parentNode || screenEl;
    if (!parent) return;
    const errorEl = document.createElement('div');
    errorEl.className = 'game-inline-validation';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    errorEl.textContent = String(message || '입력값을 확인해주세요.');
    if (host?.parentNode === parent) parent.insertBefore(errorEl, host);
    else parent.appendChild(errorEl);
  }
  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다 —
  // afterBodyRender에서 footer 내용을 채운 뒤에야 renderAnsiScreenWithTopbarSequential이 하단을 드러낸다.
  const render = async (ansi, footer, prompt) => { const rendered = await renderAnsiScreenWithTopbarSequential({ ansiText: ansi, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender: async () => { if (footer === 'none') { await applyCommandFooter(null, ''); if (prompt !== undefined) setPrompt(prompt); } else { await applyCommandFooter(getMenuNodeByKey('game')?.footer, getCommandFooterText(footer)); if (prompt !== undefined) setPrompt(prompt); } } }); focus(); return rendered; };
  const validDate = (input) => { const value = String(input || '').replace(/\D/g, ''); if (value.length !== 8) return null; const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6))); return date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() === Number(value.slice(4, 6)) - 1 && date.getDate() === Number(value.slice(6)) ? date : null; };
  const validYear = (input) => { const year = Number(String(input || '').replace(/\D/g, '')); return year >= 1900 && year <= new Date().getFullYear() ? year : null; };
  async function showBiorhythm(fromHistory = false) { state.screen = 'bio-input'; state.serviceData = { kind: 'biorhythm' }; if (!fromHistory) updateURL(); await render(buildBiorhythmIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('bio-prompt-host', 'game-prompt-host'); }
  async function showBiorhythmResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { inlineMount('bio-prompt-host', 'game-prompt-host'); showGameValidationError('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01', 'bio-prompt-host'); return false; } clearGameValidationError(); if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'bio-result'; state.serviceData = { kind: 'biorhythm', birth: birth.getTime() }; if (!fromHistory) updateURL(); const userName = state.user?.nickname || state.user?.username || state.user?.name || '사용자'; await render(buildBiorhythmAnsi(birth, new Date(), userName), 'amusementView', '선택 >> '); return true; }
  // [LOG: 20260724_0948] 생년월일 8자리 입력 처리 및 birth 전달
  async function showFortune(fromHistory = false) { state.screen = 'fortune-input'; state.serviceData = { kind: 'fortune' }; if (!fromHistory) updateURL(); await render(buildFortuneIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('fortune-prompt-host', 'game-prompt-host'); }
  async function showFortuneResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { inlineMount('fortune-prompt-host', 'game-prompt-host'); showGameValidationError('생년월일 형식이 올바르지 않습니다. 예) 19900101', 'fortune-prompt-host'); return false; } clearGameValidationError(); if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'fortune-result'; state.serviceData = { kind: 'fortune', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildFortuneAnsi(birth), 'amusementView', '선택 >> '); return true; }


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
      showGameValidationError('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.', 'mbti-list-prompt-host');
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

      showGameValidationError('선택지 번호(1 또는 2)를 입력하세요.', 'mbti-test-prompt-host');
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

  async function showMbtiDetail(input, fromHistory = false) { const type = findMbtiType(input); if (!type) { showGameValidationError('번호(1~16) 또는 유형코드(예: INFP)를 입력하세요.', 'mbti-list-prompt-host'); return false; } clearGameValidationError(); if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'mbti-detail'; state.serviceData = { kind: 'mbti', mbtiCode: type.code }; state._mbtiCode = type.code; if (!fromHistory) updateURL(); await render(buildMbtiDetailAnsi(type), 'amusementView', '선택 >> '); return true; }

  // [LOG_ID: 20260719_1600] 천리안 원전 온라인 철학관(BLOOD/SAJU) 재현 — 혈액형 성격진단/궁합/토정비결.
  // [LOG_ID: 20260811_1126] 혈액형 입력/결과 화면 전역 클릭 위임으로 A, B, O, AB 핫스팟 클릭 100% 동작 보장
  if (typeof window !== 'undefined' && !window._bloodHotspotDelegated) {
    window._bloodHotspotDelegated = true;
    const activateBloodHotspot = (e) => {
      const target = e.target?.closest('.blood-hotspot');
      if (!target) return;
      const val = target.getAttribute('data-val');
      if (!val || !['A', 'B', 'O', 'AB'].includes(val.toUpperCase())) return;
      e.preventDefault();
      e.stopPropagation();
      if (cmdInput) {
        cmdInput.value = val.toUpperCase();
      }
      showBloodResult(val.toUpperCase());
    };
    document.addEventListener('click', activateBloodHotspot, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target?.closest?.('.blood-hotspot')) return;
      activateBloodHotspot(e);
    }, true);
  }

  // [LOG_ID: 20260811_1233] 혈액형 프롬프트 핫스팟: 클릭 전용 mock div.
  // 키보드 입력은 #cmd-input(별개 요소)에서 처리되므로 realRenderer 숨김에 영향 없음.
  // 키보드 라우팅 수정은 commandRouterService.js의 정규식 우선순위로 해결됨.
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
      pointer-events: auto !important;
      position: relative;
      z-index: 100;
    `;
    mock.innerHTML = `혈액형 입력 (<span class="blood-hotspot" data-val="A">A</span>/<span class="blood-hotspot" data-val="B">B</span>/<span class="blood-hotspot" data-val="O">O</span>/<span class="blood-hotspot" data-val="AB">AB</span>) >>`;

    const hotspots = mock.querySelectorAll('.blood-hotspot');
    hotspots.forEach(el => {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `혈액형 ${el.getAttribute('data-val') || ''}`);
    });

    realRenderer.parentNode.insertBefore(mock, realRenderer);
  }

  async function showBlood(fromHistory = false) {
    const prevErr = document.querySelector('.blood-error-msg');
    if (prevErr) prevErr.remove();
    state.screen = 'blood-input';
    state.serviceData = { kind: 'blood' };
    if (!fromHistory) updateURL();
    const rendered = await render(buildBloodIntroAnsi(), 'amusementInput', '혈액형 입력 (A/B/O/AB) >>');
    inlineMount('blood-prompt-host', 'game-prompt-host');
    attachBloodPromptHotspots();
    if (rendered && rendered.screenNode) {
      attachBloodResultHotspots(rendered.screenNode);
    }
  }

  function attachBloodResultHotspots(screenNode) {
    if (!screenNode) return;
    const bodyContainer = screenNode.querySelector('.ansi-screen-body') || screenNode;
    const lineNodes = Array.from(bodyContainer.querySelectorAll('.ansi-line'));
    const targetLine = lineNodes.find(ln => (ln.textContent || '').includes('A/B/O/AB') || (ln.textContent || '').includes('다른 혈액형을 보려면'));
    if (!targetLine) return;

    let html = targetLine.innerHTML;
    const replacement = '<span class="blood-hotspot" data-val="A">A</span>/<span class="blood-hotspot" data-val="B">B</span>/<span class="blood-hotspot" data-val="O">O</span>/<span class="blood-hotspot" data-val="AB">AB</span>';
    if (html.includes('A/B/O/AB')) {
      targetLine.innerHTML = html.replace(/A\/B\/O\/AB/g, replacement);
    }

    const hotspots = targetLine.querySelectorAll('.blood-hotspot');
    hotspots.forEach(el => {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `혈액형 ${el.getAttribute('data-val') || ''}`);
    });
  }

  async function showBloodResult(input, fromHistory = false, pageNo = 1) {
    const rawVal = String(input || '').trim().toUpperCase();
    if (!rawVal) return false;
    const type = findBloodType(rawVal);
    if (!type) {
      // [LOG_ID: 20260811_1242] setHint()는 syncScreenContext()→restorePromptRow()를 트리거하여
      // 프롬프트가 터미널 푸터로 복귀하는 부작용이 있으므로 사용하지 않는다.
      // 대신 프롬프트 호스트 바로 위에 안내 메시지를 직접 삽입한다.
      const host = document.getElementById('blood-prompt-host');
      if (host) {
        let errEl = document.querySelector('.blood-error-msg');
        if (!errEl) {
          errEl = document.createElement('div');
          errEl.className = 'blood-error-msg';
          errEl.style.cssText = 'color: #ff6; font-family: inherit; font-size: inherit; white-space: pre; padding: 0; margin: 0;';
          host.parentNode.insertBefore(errEl, host);
        }
        errEl.textContent = '혈액형은 A, B, O, AB 중에서 입력하세요.';
      }
      return false;
    }
    // 이전 에러 메시지 제거
    const prevErr = document.querySelector('.blood-error-msg');
    if (prevErr) prevErr.remove();
    if (typeof restorePromptRow === 'function') {
      restorePromptRow();
    }
    state.screen = 'blood-result';
    const built = buildBloodAnsi(type, pageNo);
    state.serviceData = { kind: 'blood', bloodCode: type.code, pageNo: built.pageNo, pageCount: built.pageCount };
    if (!fromHistory) updateURL();
    const rendered = await render(built.text, 'amusementView', '선택 >> ');
    if (rendered && rendered.screenNode) {
      attachBloodResultHotspots(rendered.screenNode);
    }
    return true;
  }

  async function showCompat(fromHistory = false) { state.screen = 'compat-input'; state.serviceData = { kind: 'compat' }; if (!fromHistory) updateURL(); await render(buildCompatIntroAnsi(), 'amusementInput', '첫 번째 사람 생년월일 입력 (예: 19900101) >> '); inlineMount('compat-prompt-host', 'game-prompt-host'); }
  async function showCompatStep2(input, fromHistory = false) {
    const birth1 = input instanceof Date ? input : validDate(input);
    if (!birth1) {
      inlineMount('compat-prompt-host', 'game-prompt-host');
      showGameValidationError('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01', 'compat-prompt-host');
      return false;
    }
    clearGameValidationError();
    state.screen = 'compat-input2';
    state.serviceData = { kind: 'compat', birth1: birth1.getTime() };
    if (!fromHistory) updateURL();
    await render(buildCompatIntro2Ansi(birth1), 'amusementInput', '두 번째 사람 생년월일 입력 (예: 19950505) >> ');
    inlineMount('compat2-prompt-host', 'game-prompt-host');
    return true;
  }
  async function showCompatResult(input, fromHistory = false, pageNo = 1) {
    const birth2 = input instanceof Date ? input : validDate(input);
    if (!birth2) {
      inlineMount('compat2-prompt-host', 'game-prompt-host');
      showGameValidationError('생년월일 형식이 올바르지 않습니다. 예) 1995-05-05', 'compat2-prompt-host');
      return false;
    }
    clearGameValidationError();
    const birth1Time = state.serviceData?.birth1;
    if (!birth1Time) { await showCompat(fromHistory); return false; }
    if (typeof restorePromptRow === 'function') { restorePromptRow(); }
    const birth1 = new Date(birth1Time);
    state.screen = 'compat-result';
    const built = buildCompatAnsi(birth1, birth2, pageNo);
    state.serviceData = { kind: 'compat', birth1: birth1Time, birth2: birth2.getTime(), pageNo: built.pageNo, pageCount: built.pageCount };
    if (!fromHistory) updateURL();
    await render(built.text, 'amusementView', '선택 >> ');
    return true;
  }

  async function showTojeong(fromHistory = false) { state.screen = 'tojeong-input'; state.serviceData = { kind: 'tojeong' }; if (!fromHistory) updateURL(); await render(buildTojeongIntroAnsi(), 'amusementInput', '생년월일 입력 (예: 19900101) >> '); inlineMount('tojeong-prompt-host', 'game-prompt-host'); }
  async function showTojeongResult(input, fromHistory = false) { const birth = input instanceof Date ? input : validDate(input); if (!birth) { inlineMount('tojeong-prompt-host', 'game-prompt-host'); showGameValidationError('생년월일 형식이 올바르지 않습니다. 예) 1990-01-01', 'tojeong-prompt-host'); return false; } clearGameValidationError(); if (typeof restorePromptRow === 'function') { restorePromptRow(); } state.screen = 'tojeong-result'; state.serviceData = { kind: 'tojeong', birth: birth.getTime() }; if (!fromHistory) updateURL(); await render(buildTojeongAnsi(birth), 'amusementView', '선택 >> '); return true; }

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
