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

  let notificationTimeout = null;

  function writeErrorRow(message) {
    const normalizedMessage = String(message || UI_TEXT.RENDER_ERROR).trim();
    const errorEl = document.getElementById('terminal-error');
    if (errorEl) {
      errorEl.textContent = normalizedMessage;
      errorEl.hidden = false;
      return true;
    }

    // Backward-compatible fallback for embedded shells that do not yet have
    // the dedicated error row.
    if (hintEl) {
      hintEl.innerHTML = `<span class="bbs-error-text">${esc(normalizedMessage)}</span>`;
      hintEl.classList.remove('has-cmd-tokens');
      return true;
    }
    return false;
  }

  function showNotification(text, duration = 3000, level = 'info', options = {}) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    const notifyEl = document.getElementById('terminal-notification');
    if (notifyEl) {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }

      const onClick = typeof options?.onClick === 'function' ? options.onClick : null;
      notifyEl.className = `terminal-notification-row level-${level}${onClick ? ' is-interactive' : ''}`;
      notifyEl.textContent = normalizedText;
      notifyEl.setAttribute('role', onClick ? 'button' : 'status');
      notifyEl.setAttribute('aria-live', 'polite');
      notifyEl.setAttribute('aria-label', onClick
        ? `${normalizedText} 쪽지함을 열려면 클릭하세요.`
        : normalizedText);
      if (onClick) {
        notifyEl.tabIndex = 0;
        notifyEl.title = options.title || '클릭하여 쪽지함 열기';
        notifyEl.onclick = (event) => {
          event.preventDefault();
          onClick(event);
        };
        notifyEl.onkeydown = (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onClick(event);
        };
      } else {
        notifyEl.removeAttribute('tabindex');
        notifyEl.removeAttribute('title');
        notifyEl.onclick = null;
        notifyEl.onkeydown = null;
      }
      notifyEl.style.display = 'block';

      notificationTimeout = setTimeout(() => {
        notifyEl.style.display = 'none';
        notifyEl.textContent = '';
        notificationTimeout = null;
      }, duration);
    } else {
      const method = level === 'error'
        ? 'error'
        : level === 'warn'
          ? 'warn'
          : 'info';
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
          // [LOG_ID: 20260806_1601] AI 코딩 주석화 — console.warn 주석 처리
          // console.warn('[Terminal] Busy state guardian triggered: Auto-clearing busy state.');
          // [LOG: 20260506_0949] Clear stuck busy state silently; do not show timeout toast to users.
          setBusy(false);
        }
      }, 15000);
    }
  }

  function renderInitError(message) {
    const normalizedMessage = String(message || UI_TEXT.RENDER_ERROR);

    if (screenEl) {
      screenEl.innerHTML = `<div class="bbs-error">${esc(normalizedMessage)}</div>`;
    }

    setFooterVisibility(true);
    // [LOG_ID: 20260708_1215] 에러 화면도 내용이 확정된 이 시점에 하단 구분선을 드러낸다
    // (setLoading()이 화면 전환 시작 시 켠 is-divider-pending을 여기서 정리 — 안 하면 다음
    // 화면까지 구분선이 계속 숨겨진 채로 고착된다).
    document.getElementById('terminal-footer')?.classList.remove('is-divider-pending');

    writeErrorRow(normalizedMessage);

    if (cmdPromptEl) {
      cmdPromptEl.textContent = '>>';
      const cmdPromptRendererEl = document.getElementById('cmd-prompt-renderer');
      if (cmdPromptRendererEl) {
        // [LOG: 20260615_1621] Keep the input-rendered prompt fallback in sync with init errors.
        cmdPromptRendererEl.value = '>>';
        cmdPromptRendererEl.style.width = '2ch';
      }
    }

    // [LOG: 20260611_1430] Ensure loading timer is cleared even on error
    if (typeof deps.setReady === 'function') {
      deps.setReady(true);
    }

    // [LOG: 20260706] 화면 흔들림 대신 터미널 비주얼 벨(화면 플래시)로 에러 표시.
    triggerVisualFeedback(document.body, 'flash-terminal');
    soundService.playError();
  }

  function showError(message) {
    // [LOG_ID: 20260806_1601] AI 코딩 주석화 — console.error 주석 처리
    // console.error('[BBS UI ERROR]', message);
    setFooterVisibility(true);
    document.getElementById('terminal-footer')?.classList.remove('is-divider-pending');

    writeErrorRow(message);

    // [LOG: 20260706] 입력 흔들림 대신 터미널 비주얼 벨(화면 플래시)로 에러 표시.
    triggerVisualFeedback(cmdInput?.parentElement, 'flash-terminal');
    soundService.playError();
  }

  return {
    renderInitError,
    setBusy,
    showError,
    showNotification
  };
}
