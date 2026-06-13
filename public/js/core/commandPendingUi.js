import { displayWidth } from './ansiRenderUtils.js';

let commandPendingTimer = 0;
let commandPendingToken = 0;

function setCommandPending(active) {
  const container = document.getElementById('terminal-container');
  if (!container) {
    return;
  }

  container.classList.toggle('is-command-pending', Boolean(active));

  if (active) {
    const cmdInput = document.getElementById('cmd-input');
    const commandLength = Math.max(1, displayWidth(cmdInput?.value));
    // [LOG: 20260613_1248] Size the pending input so the underscore sits immediately after the submitted text.
    container.style.setProperty('--pending-command-length', String(commandLength));
  } else {
    container.style.removeProperty('--pending-command-length');
  }
}

export function trackCommandPending(result, options = {}) {
  if (!result || typeof result.finally !== 'function') {
    return;
  }

  const delayMs = Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : 80;
  const pendingValue = String(options.value || '').trim();
  const clearOnSettled = options.clearOnSettled === true;
  const token = commandPendingToken + 1;
  commandPendingToken = token;

  if (commandPendingTimer) {
    window.clearTimeout(commandPendingTimer);
    commandPendingTimer = 0;
  }

  commandPendingTimer = window.setTimeout(() => {
    if (commandPendingToken === token) {
      // [LOG: 20260611_1735] Show the underscore wait caret for keyboard and mouse command submissions.
      if (pendingValue) {
        const cmdInput = document.getElementById('cmd-input');
        if (cmdInput) {
          // [LOG: 20260611_1805] Keep the submitted command visible so the wait caret appears as "1_".
          cmdInput.value = pendingValue;
          if (typeof CustomEvent === 'function') {
            cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
          }
        }
      }
      setCommandPending(true);
    }
  }, delayMs);

  Promise.resolve(result)
    .finally(() => {
      if (commandPendingToken !== token) {
        return;
      }

      if (commandPendingTimer) {
        window.clearTimeout(commandPendingTimer);
        commandPendingTimer = 0;
      }

        setCommandPending(false);
        if (clearOnSettled && pendingValue) {
          const cmdInput = document.getElementById('cmd-input');
          if (cmdInput?.value === pendingValue) {
            cmdInput.value = '';
            if (typeof CustomEvent === 'function') {
              cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
            }
          }
        }
      })
      .catch(() => {});
}
