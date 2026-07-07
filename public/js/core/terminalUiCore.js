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

      setBusy(true);
      if (cmdInput) cmdInput.disabled = true;
      const staticMessage = normalizeLoadingMessage(message);
      if (hintEl) {
        // [LOG: 20260617_1156] Clear footer hint text to prevent duplicate "connecting" messages on screen and footer.
        hintEl.innerHTML = '';
        // [LOG_ID: 20260707_2015] footer 전체를 숨기지 않는다 (위 setReady 주석 참고).
      }
      core._loadingTimer = setTimeout(() => {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
        screenEl.innerHTML = buildLoadingScreenMarkup(staticMessage);
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

  return core;
}
