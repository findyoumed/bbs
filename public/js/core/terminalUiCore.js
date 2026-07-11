import { esc, applyTerminalEffects, shouldAutoFocusCommandInput } from './uiUtils.js';
import { createTerminalDialog } from './terminalDialog.js';
import { createTerminalFeedback } from './terminalFeedback.js';
import { createTerminalHintFooter } from './terminalHintFooter.js';
import { createTerminalInputUi } from './terminalInputUi.js';
import { createTerminalSequentialRenderer } from './terminalSequentialRenderer.js';
import { createTerminalViewportMetrics } from './terminalViewportMetrics.js';
import { buildLoadingScreenMarkup, normalizeLoadingMessage } from './terminalLoadingUi.js';

export function createTerminalUiCore(deps) {
  const {
    hintEl,
    cmdPromptEl,
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    soundService,
    setScale,
    isManualScale,
    performanceService
  } = deps;
  let outputListener = null;
  const terminalFooter = document.getElementById('terminal-footer');
  const { syncVisualViewportMetrics } = createTerminalViewportMetrics({ screenEl });

  function setOutputListener(callback) {
    outputListener = callback;
  }

  const hintFooter = createTerminalHintFooter({
    hintEl,
    cmdPromptEl,
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    getOutputListener: () => outputListener,
    esc
  });

  const {
    applyCommandFooter,
    mountPromptRow,
    restorePromptRow,
    setFooterVisibility,
    setHint,
    setPrompt,
    toggleHintExpansion,
    trimHintEntriesToFit
  } = hintFooter;

  const terminalDialog = createTerminalDialog({
    cmdInput,
    screenEl,
    setPrompt,
    onOpen: () => {
      if (cmdInput) {
        cmdInput.disabled = false;
        if (shouldAutoFocusCommandInput()) cmdInput.focus();
      }
      soundService.playTransition();
    },
    onClose: () => {
      if (cmdInput && terminalFooter?.dataset.footerState !== 'hidden') {
        cmdInput.disabled = false;
        if (shouldAutoFocusCommandInput()) cmdInput.focus();
      }
    }
  });

  const terminalWrapper = document.getElementById('terminal-wrapper');
  applyTerminalEffects(terminalWrapper, true);
  syncVisualViewportMetrics();
  setFooterVisibility(false);

  const { renderInitError, setBusy, showError, showNotification } = createTerminalFeedback({
    screenEl,
    hintEl,
    cmdPromptEl,
    cmdInput,
    soundService,
    getOutputListener: () => outputListener,
    setFooterVisibility,
    setReady: (isReady) => core.setReady(isReady)
  });

  function echoCommand(cmdText) {
    if (!screenEl || !cmdText) return;
    const prompt = cmdPromptEl?.textContent || '>>';
    const echoLine = document.createElement('div');
    echoLine.className = 'ansi-line command-echo';
    echoLine.innerHTML = `<span class="ansi-cyan">${esc(prompt)}</span> <span class="ansi-white">${esc(cmdText)}</span>`;
    screenEl.appendChild(echoLine);
    echoLine.scrollIntoView({ behavior: 'auto', block: 'end' });
  }

  const {
    adjustZoom,
    autoAdjustZoom,
    initBlinkingCursor,
    initTooltips,
    initZoom,
    setGhostText,
    setSuggestions,
    setZoom,
    updateCursorPosition
  } = createTerminalInputUi({
    cmdInput,
    screenEl,
    state,
    setScale,
    isManualScale,
    syncVisualViewportMetrics
  });

  const { interruptRendering, renderScreenSequential } = createTerminalSequentialRenderer({
    screenEl,
    performanceService,
    soundService,
    setBusy,
    showNotification
  });

  const core = {
    renderInitError,
    showError,
    initTooltips,
    initBlinkingCursor,
    initZoom,
    autoAdjustZoom,
    setZoom,
    adjustZoom,
    setHint,
    setOutputListener,
    getOutputListener: () => outputListener,
    setPrompt,
    setSuggestions,
    setGhostText,
    applyCommandFooter: async (assetPath, fallbackText, fallbackAssetPath) => {
      try {
        await hintFooter.applyCommandFooter(assetPath, fallbackText, fallbackAssetPath);
      } finally {
        core.setReady(true);
        // [LOG_ID: 20260708_1215] 힌트/프롬프트 내용이 확정되는 이 시점에만 하단 구분선을 드러낸다.
        // setLoading()이 화면 전환 시작과 동시에 켠 is-divider-pending을 여기서 끈다 (아래 setLoading 주석 참고).
        terminalFooter?.classList.remove('is-divider-pending');
      }
    },
    mountPromptRow,
    restorePromptRow,
    setFooterVisibility,
    esc,
    toggleHintExpansion,
    setReady: (isReady) => {
      if (!screenEl) return;
      if (core._loadingTimer) {
        clearTimeout(core._loadingTimer);
        core._loadingTimer = null;
      }
      if (core._progressTimer) {
        clearInterval(core._progressTimer);
        core._progressTimer = null;
      }

      if (isReady) {
        screenEl.parentElement?.classList.remove('is-loading');
        screenEl.classList.remove('is-loading');
        setBusy(false);
        setFooterVisibility(true);
        if (cmdInput) {
          cmdInput.disabled = false;
        }
      } else {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
        setBusy(true);
        // [LOG_ID: 20260707_2015] 20260707_1815에서 도입된 setFooterVisibility(false) 호출을 제거한다.
        // 이 호출은 매 화면 전환마다 #terminal-footer 전체를 display:none으로 지웠다가 되살려,
        // "타이핑/명령 입력 후 힌트바가 잠깐 사라진다"는 회귀를 만들었다 — 20260706_2247에서 고쳤던
        // "로딩 중 하단 프레임 붕괴" 버그를 CSS가 아닌 이 JS 경로로 재도입한 것.
        // PC통신 하단 상태줄은 로딩 여부와 무관하게 항상 같은 자리에 있어야 한다:
        // 힌트 텍스트만 비우고(높이는 min-height로 이미 예약됨), footer 자체는 숨기지 않는다.
      }
    },
    setLoading: (message) => {
      if (!screenEl) return;
      if (core._loadingTimer) clearTimeout(core._loadingTimer);
      if (core._progressTimer) {
        clearInterval(core._progressTimer);
        core._progressTimer = null;
      }

      // [LOG_ID: 20260708_1300] 20260708_1215에서 여기 추가했던 "setLoading 시작과 동시에 구분선
      // 즉시 숨김"을 되돌린다. 이 즉시-숨김은 구분선만 먼저 사라지고 프롬프트 행(제출된 명령+"선택 >>")은
      // 그대로 남아있는 새로운 불일치를 만들었다(구분선/힌트는 없어지는데 프롬프트만 남는 문제) — 프롬프트
      // 행은 원래 "제출한 명령을 계속 보여주는" 의도된 동작이라 이와 어긋나 보였다.
      // 근본 원인(postListView/postViewView가 setReady(true)를 렌더 호출보다 먼저 불러, 그 사이 남은
      // await 동안 footer가 먼저 드러나던 것)은 각 화면에서 setReady(true) 위치를 render 직전(남은 await
      // 이후)으로 옮겨 직접 해결했다 — 이제 이 즉시-숨김 없이도 구분선/힌트/프롬프트가 모두 같은 시점에
      // (렌더러가 실제로 시작될 때) 함께 바뀐다.

      setBusy(true);
      if (cmdInput) cmdInput.disabled = true;
      const staticMessage = normalizeLoadingMessage(message);
      // [LOG_ID: 20260708_1420] 20260617_1156이 여기서 즉시 hintEl.innerHTML = ''로 힌트 텍스트를 비우던 것을
      // 제거한다. setLoading()은 화면 전환마다(대부분 400ms 미만으로 빨리 끝남) 호출되는데, 즉시-비움은
      // 프롬프트 행("선택 >>", 제출한 명령을 계속 보여주는 의도된 동작)은 그대로 둔 채 힌트만 먼저
      // 사라지는 새 불일치를 만들었다 — "선택 >>는 남아있는데 힌트바가 없어진다"는 재보고의 원인.
      // 원래 목적("연결하는 중..." 로딩 화면 문구와 낡은 힌트 목록이 동시에 보이는 중복 방지)은 아래
      // 400ms 폴백 타이머가 실제로 화면을 로딩 placeholder로 교체하는 시점에만 힌트를 비워도 충분하다 —
      // 그 전까지는 힌트가 이전 내용을 유지하다가 applyCommandFooter의 setHint()가 새 내용으로 자연스럽게
      // 교체하므로, 빠른 전환(대다수)에서는 깜빡임 없이 프롬프트 행과 완전히 동기화된다.
      core._loadingTimer = setTimeout(() => {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
        // [LOG_ID: 20260708_1520] screenEl.innerHTML 전체를 로딩 문구로 갈아엎지 않는다. 상단바(로고+시계+
        // 메뉴명)까지 함께 지워지면, footer(구분선/힌트/프롬프트, 로딩 여부와 무관하게 항상 같은 자리를
        // 지킨다는 20260707_2015 원칙에 따라 그대로 남아있음)만 그대로 남고 화면 위쪽만 사라져, 위/아래가
        // 서로 다른 화면처럼 분리되어 보였다("연결하는 중입니다" 밑에 이전 화면의 구분선/힌트가 뜬금없이
        // 붙어있는 것처럼 보이는 문제). 이미 렌더된 상단바 구조(.ansi-screen-body)가 있으면 본문 영역만
        // 교체해 상단바는 그대로 유지한다 — 상단바가 아직 없는 극초반 부팅 등에서만 기존처럼 전체를 교체.
        // [LOG_ID: 20260708_1545] 여기서 hintEl.innerHTML = ''로 힌트만 비우던 것을 제거한다. 이 타이머는
        // renderAnsiScreenWithTopbarSequential이 아직 시작되지 않은(이전 화면이 그대로 떠 있는) 시점에도
        // 발동할 수 있는데, 그 경우 divider/promptRow는 이전 화면 그대로인 채 힌트 텍스트만 갑자기 비어
        // "입력창(선택 >>)은 남아있는데 힌트바만 없어진다"는 것과 동일한 패턴의 새 불일치를 만들었다.
        // 본문을 로딩 문구로 바꾸는 것과 별개로 footer는 아무것도 건드리지 않아야, 어떤 시점에 이 타이머가
        // 발동하든 footer 3요소(구분선/힌트/프롬프트) 사이의 불일치가 구조적으로 생기지 않는다.
        const bodyContainer = screenEl.querySelector('.ansi-screen-body');
        if (bodyContainer) {
          bodyContainer.innerHTML = buildLoadingScreenMarkup(staticMessage);
        } else {
          screenEl.innerHTML = buildLoadingScreenMarkup(staticMessage);
        }
        // [LOG_ID: 20260707_2015] footer 전체를 숨기지 않는다 (위 setReady 주석 참고).
      }, 400);
    },
    buildLoadingScreenMarkup,
    setBusy,
    echoCommand,
    showNotification,
    showToast: (text, duration = 2500, level = 'info') => {
      showNotification(text, duration, level);
    },
    renderScreenSequential,
    interruptRendering,
    showConfirm: terminalDialog.showConfirm,
    showAlert: terminalDialog.showAlert,
    showPrompt: terminalDialog.showPrompt,
    showEditor: terminalDialog.showEditor
  };

  let _resizeTimeout = null;
  const _onResize = () => {
    if (_resizeTimeout) clearTimeout(_resizeTimeout);
    _resizeTimeout = setTimeout(() => {
      syncVisualViewportMetrics();
      trimHintEntriesToFit();
      if (cmdInput && document.activeElement === cmdInput) {
        updateCursorPosition();
      }
      if (!isManualScale()) {
        autoAdjustZoom();
      }
    }, 150);
  };
  window.addEventListener('resize', _onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _onResize);
    window.visualViewport.addEventListener('scroll', _onResize);
  }
  // [LOG_ID: 20260711_1320] VirtualKeyboard API(Chromium Android): 가상 키보드를 오버레이 모드로
  // 전환해 키보드 개폐 시 브라우저의 레이아웃/시각 뷰포트 리사이즈(이중 리플로우·점프)를 없앤다.
  // 이 모드에서는 visualViewport 높이가 줄지 않으므로 키보드 높이는 geometrychange 이벤트와
  // boundingRect로 받아 terminalViewportMetrics가 기존 CSS 변수 파이프라인에 그대로 공급한다.
  // 미지원 브라우저(iOS Safari 등)는 이 블록을 건너뛰고 기존 visualViewport 경로를 유지한다.
  if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener('geometrychange', _onResize);
    } catch (error) {
      console.warn('[TerminalUI] VirtualKeyboard API setup failed:', error?.message);
    }
  }

  return core;
}
