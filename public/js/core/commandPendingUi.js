let commandPendingTimer = 0;
let commandPendingToken = 0;
let commandPendingActive = false;
let commandPendingValue = '';

function setCommandPending(active) {
  const container = document.getElementById('terminal-container');
  const cmdInput = document.getElementById('cmd-input');
  if (!container) {
    return;
  }

  commandPendingActive = Boolean(active);
  container.classList.toggle('is-command-pending', commandPendingActive);

  if (commandPendingActive) {
    // [LOG_ID: 20260707_1645] Keep the submitted command visible during pending, but lock the footer width to the command text.
    const pendingLength = Math.max(1, String(commandPendingValue || cmdInput?.value || '').length);
    container.style.setProperty('--pending-command-length', String(pendingLength));
    if (cmdInput) {
      // [LOG: 20260617_1035] Lock submitted command text during pending so number commands cannot morph mid-load.
      cmdInput.readOnly = true;
      cmdInput.dataset.commandPending = '1';
      if (typeof CustomEvent === 'function') {
        cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
      }
    }
  } else {
    container.style.removeProperty('--pending-command-length');
    if (cmdInput?.dataset.commandPending === '1') {
      cmdInput.readOnly = false;
      delete cmdInput.dataset.commandPending;
    }
  }
}

export function isCommandPending() {
  return commandPendingActive || commandPendingTimer !== 0;
}

export function getPendingCommandValue() {
  return commandPendingValue;
}

export function cancelCommandPending(options = {}) {
  if (commandPendingTimer) {
    window.clearTimeout(commandPendingTimer);
    commandPendingTimer = 0;
  }

  commandPendingToken += 1;
  const canceledValue = commandPendingValue;
  commandPendingValue = '';
  setCommandPending(false);

  const cmdInput = document.getElementById('cmd-input');
  if (cmdInput && (options.clearInput !== false || cmdInput.value === canceledValue)) {
    cmdInput.value = '';
    if (typeof CustomEvent === 'function') {
      cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
    }
  }

  return canceledValue;
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
  commandPendingValue = pendingValue;

  if (commandPendingTimer) {
    window.clearTimeout(commandPendingTimer);
    commandPendingTimer = 0;
  }

  commandPendingTimer = window.setTimeout(() => {
    if (commandPendingToken === token) {
      // [LOG: 20260611_1735] Show the wait caret for keyboard and mouse command submissions.
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

      commandPendingValue = '';
      setCommandPending(false);
      if (clearOnSettled && pendingValue) {
        const cmdInput = document.getElementById('cmd-input');
        if (cmdInput) {
          cmdInput.value = '';
          if (typeof CustomEvent === 'function') {
            cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
          }
        }
      }
    })
    .catch(() => {});
}
