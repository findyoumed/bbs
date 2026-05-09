import { UI_TEXT } from './i18n.js';
import { esc, triggerVisualFeedback } from './uiUtils.js';

export function createTerminalFeedback(deps) {
  const {
    screenEl,
    hintEl,
    cmdPromptEl,
    cmdInput,
    soundService,
    setFooterVisibility
  } = deps;

  let busyTimeout = null;

  function showNotification(text, duration = 3000, level = 'info', options = {}) {
    const normalizedText = String(text || '').trim();
    const method = level === 'error'
      ? 'error'
      : level === 'warn'
        ? 'warn'
        : 'info';
    if (normalizedText) {
      // [LOG: 20260507_1520] Toast/notification messages must not appear in the terminal UI.
      console[method]('[BBS Notification]', normalizedText);
    }
  }

  function setBusy(active, options = {}) {
    const container = document.getElementById('terminal-container');
    const isDataOnly = options.dataOnly === true;

    if (container) {
      if (isDataOnly) {
        container.classList.toggle('is-data-busy', !!active);
      } else {
        container.classList.toggle('is-busy', !!active);
      }
    }

    if (busyTimeout) {
      clearTimeout(busyTimeout);
      busyTimeout = null;
    }

    if (active) {
      busyTimeout = window.setTimeout(() => {
        if (container && (container.classList.contains('is-busy') || container.classList.contains('is-data-busy'))) {
          console.warn('[Terminal] Busy state guardian triggered: Auto-clearing busy state.');
          // [LOG: 20260506_0949] Clear stuck busy state silently; do not show timeout toast to users.
          setBusy(false);
        }
      }, 15000);
    }
  }

  function renderInitError(message) {
    const normalizedMessage = String(message || UI_TEXT.RENDER_ERROR);

    if (screenEl) {
      screenEl.innerHTML = `<div class="bbs-error">${normalizedMessage}</div>`;
    }

    setFooterVisibility(true);

    if (hintEl) {
      hintEl.textContent = UI_TEXT.ERROR;
    }

    if (cmdPromptEl) {
      cmdPromptEl.textContent = '>>';
    }

    triggerVisualFeedback(document.body, 'shake');
    soundService.playError();
  }

  function showError(message) {
    console.error('[BBS UI ERROR]', message);
    setFooterVisibility(true);

    if (hintEl) {
      hintEl.innerHTML = `<span class="bbs-error-text">${esc(message)}</span>`;
      hintEl.classList.remove('has-cmd-tokens');
    }

    triggerVisualFeedback(cmdInput?.parentElement, 'shake');
    soundService.playError();
  }

  return {
    renderInitError,
    setBusy,
    showError,
    showNotification
  };
}
