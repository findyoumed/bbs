import { shouldAutoFocusCommandInput } from './uiUtils.js';

// [LOG: 20260617_1118] Shared command execution lock/cancel state for keyboard and clickable command paths.

export function beginCommandExecution(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const token = {};
  state._commandCancelActive = false;
  state._commandInFlight = true;
  state._commandInFlightToken = token;
  state._commandScreenBeforeInFlight = state.screen;

  if (typeof AbortController !== 'undefined') {
    state._commandAbortController = new AbortController();
  } else {
    delete state._commandAbortController;
  }

  return token;
}

export function trackCommandExecution(state, result, token) {
  if (!state || typeof state !== 'object') {
    return;
  }

  Promise.resolve(result)
    .finally(() => {
      if (state._commandInFlightToken !== token) {
        return;
      }

      state._commandInFlight = false;
      delete state._commandInFlightToken;
      delete state._commandAbortController;
      delete state._commandScreenBeforeInFlight;
      state._commandCancelActive = false;
    })
    .catch(() => {});
}

export function isCommandExecutionLocked(state) {
  return state?._commandInFlight === true;
}

export function isCommandCancelledError(error) {
  return error?.type === 'cancelled' || error?.name === 'CommandCancelledError';
}

export function cancelCommandExecution(state, options = {}) {
  const {
    cmdInput,
    interruptRendering,
    setGhostText,
    setPrompt,
    setReady,
    setSuggestions
  } = options;

  if (typeof interruptRendering === 'function') {
    interruptRendering();
  }

  if (state && typeof state === 'object') {
    state._commandCancelActive = true;
    if (state._commandAbortController && typeof state._commandAbortController.abort === 'function') {
      state._commandAbortController.abort();
    }
    if (state._commandScreenBeforeInFlight) {
      state.screen = state._commandScreenBeforeInFlight;
    }
    state._commandInFlight = false;
    delete state._commandInFlightToken;
    delete state._commandAbortController;
    delete state._commandScreenBeforeInFlight;
  }

  if (typeof setReady === 'function') {
    setReady(true);
  }
  if (typeof setPrompt === 'function') {
    setPrompt('선택 >>');
  }
  if (cmdInput) {
    cmdInput.disabled = false;
    cmdInput.readOnly = false;
    if (cmdInput.dataset?.commandPending === '1') {
      delete cmdInput.dataset.commandPending;
    }
    cmdInput.value = '';
    if (typeof CustomEvent === 'function') {
      cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
    }
    // [LOG: 20260617_1600] Prevent keyboard popup on mobile.
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }
  if (typeof setGhostText === 'function') {
    setGhostText('');
  }
  if (typeof setSuggestions === 'function') {
    setSuggestions([]);
  }
}
