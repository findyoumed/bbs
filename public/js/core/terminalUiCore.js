import { esc, applyTerminalEffects } from './uiUtils.js';
import { createTerminalDialog } from './terminalDialog.js';
import { createTerminalFeedback } from './terminalFeedback.js';
import { createTerminalHintFooter } from './terminalHintFooter.js';
import { createTerminalInputUi } from './terminalInputUi.js';
import { createTerminalSequentialRenderer } from './terminalSequentialRenderer.js';

/**
 * terminalUiCore.js
 * [LOG: 20260426_0615] Evolve Mode: Integrated scanline/shimmer effects and command echo.
 * [LOG: 20260426_2130] Evolution Mode: Integrated i18n for all UI strings.
 */

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
  let mobileKeyboardVisible = false;
  const terminalFooter = document.getElementById('terminal-footer');

  function syncVisualViewportMetrics() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const vv = window.visualViewport;
    const fallbackHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, 0);
    const viewportHeight = vv ? vv.height : fallbackHeight;
    const viewportTop = vv ? vv.offsetTop : 0;
    const viewportWidth = vv ? vv.width : (window.innerWidth || document.documentElement?.clientWidth || 0);
    const layoutHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, viewportHeight);
    const keyboardInset = vv
      ? Math.max(0, Math.round(layoutHeight - (vv.height + vv.offsetTop)))
      : 0;
    const keyboardVisible = keyboardInset >= 96;
    const keyboardJustClosed = mobileKeyboardVisible && !keyboardVisible;

    root.style.setProperty('--mobile-visual-viewport-height', `${Math.round(viewportHeight)}px`);
    root.style.setProperty('--mobile-visual-viewport-width', `${Math.round(viewportWidth)}px`);
    root.style.setProperty('--mobile-visual-viewport-top', `${Math.round(viewportTop)}px`);
    root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
    root.style.setProperty('--mobile-keyboard-visible', keyboardVisible ? '1' : '0');

    if (body) {
      body.dataset.mobileKeyboard = keyboardVisible ? 'visible' : 'hidden';
    }

    if (keyboardJustClosed && screenEl) {
      const resetScrollPosition = () => {
        screenEl.scrollTop = 0;
      };
      window.requestAnimationFrame(() => {
        resetScrollPosition();
        window.setTimeout(resetScrollPosition, 120);
      });
    }

    mobileKeyboardVisible = keyboardVisible;
  }

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

  function buildLoadingScreenMarkup(message) {
    const lines = [];

    if (message) {
      lines.push(`<div class="loading"><span class="bbs-loading-text">${esc(message)}</span></div>`);
    }

    return lines.join('');
  }

  function normalizeLoadingMessage(message) {
    // [LOG: 20260615_1538] Keep loading copy static and let CSS render the single blinking dot.
    return String(message || '연결하는 중입니다')
      .trim()
      .replace(/[.．。]+$/u, '');
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
        setFooterVisibility(false);
      }
    },
    setLoading: (message) => {
      if (!screenEl) return;
      if (core._loadingTimer) clearTimeout(core._loadingTimer);
      if (core._progressTimer) {
        clearInterval(core._progressTimer);
        core._progressTimer = null;
      }

      // [LOG: 20260610_2020] Pure static terminal feel: no animations, instant response.
      setBusy(true);
      if (cmdInput) cmdInput.disabled = true;

      const staticMessage = normalizeLoadingMessage(message);
      
      // Show static text in footer immediately
      if (hintEl) {
        hintEl.innerHTML = `<span class="bbs-loading-text">${esc(staticMessage)}</span>`;
        setFooterVisibility(true);
      }

      // [LOG: 20260611_1330] Avoid flickering by waiting 200ms before showing the full loading overlay.
      core._loadingTimer = setTimeout(() => {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
        screenEl.innerHTML = buildLoadingScreenMarkup(staticMessage);
        // [LOG: 20260613_1134] Hide footer to prevent duplicate loading message display
        setFooterVisibility(false);
      }, 200);
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
