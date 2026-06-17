import { esc, applyTerminalEffects } from './uiUtils.js';
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
        cmdInput.focus();
      }
      soundService.playTransition();
    },
    onClose: () => {
      if (cmdInput && terminalFooter?.dataset.footerState !== 'hidden') {
        cmdInput.disabled = false;
        cmdInput.focus();
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
        // [LOG: 20260617_1650] Keep footer visible even in non-ready states to maintain UI structure.
        setFooterVisibility(true);
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
        setFooterVisibility(true);
      }
      core._loadingTimer = setTimeout(() => {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
        screenEl.innerHTML = buildLoadingScreenMarkup(staticMessage);
        // [LOG: 20260617_1635] Keep footer visible to avoid "disappearing hint bar" regression during navigation.
        setFooterVisibility(true);
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
