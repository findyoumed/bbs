import { esc, applyTerminalEffects, shouldAutoFocusCommandInput } from './uiUtils.js';
import { createTerminalDialog } from './terminalDialog.js';
import { createTerminalFeedback } from './terminalFeedback.js';
import { createTerminalHintFooter } from './terminalHintFooter.js';
import { createTerminalInputUi } from './terminalInputUi.js';
import { createTerminalSequentialRenderer } from './terminalSequentialRenderer.js';
import { createTerminalViewportMetrics } from './terminalViewportMetrics.js';
import { createTerminalLoadingState } from './terminalLoadingState.js';
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
  const { syncVisualViewportMetrics, resetStableViewportHeight } = createTerminalViewportMetrics({ screenEl });

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
    setReady: (isReady) => loadingState.setReady(isReady)
  });

  // [LOG_ID: 20260715_1700] setReady/setLoading 로딩 상태 전이 로직은 terminalLoadingState.js로
  // 분리했다 — 이 파일 자체가 qa:final의 250줄 제한(core 파일 대상)을 넘어서(295줄) 발견됨.
  const loadingState = createTerminalLoadingState({
    screenEl,
    cmdInput,
    setBusy,
    setFooterVisibility,
    buildLoadingScreenMarkup,
    normalizeLoadingMessage
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
    showNotification,
    state
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
    setReady: loadingState.setReady,
    setLoading: loadingState.setLoading,
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
  // [LOG_ID: 20260721_1500] 화면 회전은 키보드 개폐와 달리 실제로 기준 높이가 바뀌는 경우라,
  // 고정해둔 --stable-vh를 강제로 다시 읽는다(모니터링만 하는 위 resize는 더 큰 값만 채택하는
  // monotonic-max라 회전으로 더 작아진 새 방향에는 자동으로 안 좁혀지기 때문).
  window.addEventListener('orientationchange', () => {
    window.setTimeout(resetStableViewportHeight, 150);
  });
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
