import { getCommandMatches } from './commandService.js';
import { trackCommandPending } from './commandPendingUi.js';

export function bindCommandInputEvents(deps) {
  const {
    cmdInput,
    handleCmd,
    interruptRendering,
    jumpToContent,
    saveHistory,
    setGhostText,
    setSuggestions,
    state
  } = deps;

  let lastMatchIndex = -1;

  function moveCaretToEnd() {
    if (typeof cmdInput.setSelectionRange !== 'function') return;
    const end = cmdInput.value.length;
    cmdInput.setSelectionRange(end, end);
  }

  function clearSuggestions() {
    // [LOG: 20260506_1315] Command suggestion UI disabled.
    setSuggestions([]);
    if (typeof setGhostText === 'function') setGhostText('');
  }

  function isSensitiveCommandInput() {
    return state?._maskCommandInput === true;
  }

  function handleInput(event) {
    if (interruptRendering) interruptRendering();

    const rawVal = cmdInput.value;
    const val = rawVal.trim();
    if (event.inputType !== undefined) {
      lastMatchIndex = -1;
    }

    if (!val) {
      clearSuggestions();
      return;
    }

    /*
    [LOG: 20260506_1315] Command suggestion UI disabled.
    if (!rawVal.includes(' ')) {
      const matches = getCommandMatches(val);
      if (matches.length > 1) {
        setSuggestions(matches, lastMatchIndex);
        if (typeof setGhostText === 'function') setGhostText('');
        return;
      }
      if (matches.length === 1) {
        const fullCmd = matches[0];
        setSuggestions([fullCmd]);
        if (typeof setGhostText === 'function') {
          if (fullCmd.startsWith(val.toUpperCase()) && fullCmd.length > val.length) {
            setGhostText(val + fullCmd.slice(val.length).toLowerCase());
          } else {
            setGhostText('');
          }
        }
        return;
      }
      clearSuggestions();
      return;
    }

    const parts = val.split(' ');
    const firstPart = parts[0].toUpperCase();
    const matches = getCommandMatches(firstPart);
    if (matches.length === 1 && matches[0] === firstPart) {
      setSuggestions([firstPart]);
    } else {
      setSuggestions([]);
    }
    */
    if (typeof setGhostText === 'function') setGhostText('');
  }

  function handleTabKey(event, matches) {
    if (matches.length <= 0) return;
    event.preventDefault();
    lastMatchIndex = (lastMatchIndex + 1) % matches.length;
    cmdInput.value = matches[lastMatchIndex];
    moveCaretToEnd();
    if (matches.length > 1) setSuggestions(matches, lastMatchIndex);
  }

  function handleSuggestionNavigation(event, matches) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      lastMatchIndex = (lastMatchIndex <= 0) ? matches.length - 1 : lastMatchIndex - 1;
      setSuggestions(matches, lastMatchIndex);
      cmdInput.value = matches[lastMatchIndex];
      moveCaretToEnd();
      return true;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      lastMatchIndex = (lastMatchIndex + 1) % matches.length;
      setSuggestions(matches, lastMatchIndex);
      cmdInput.value = matches[lastMatchIndex];
      moveCaretToEnd();
      return true;
    }

    return false;
  }

  function handleHistoryNavigation(event) {
    if (isSensitiveCommandInput() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      return true;
    }

    if (event.key === 'ArrowUp') {
      if (state.cmdHistory && state.cmdHistory.length > 0) {
        event.preventDefault();
        if (state.cmdHistoryIndex === -1) {
          state.cmdHistoryTemp = cmdInput.value;
        }
        if (state.cmdHistoryIndex < state.cmdHistory.length - 1) {
          state.cmdHistoryIndex++;
          const entry = state.cmdHistory[state.cmdHistoryIndex];
          cmdInput.value = typeof entry === 'string' ? entry : entry.cmd;
          moveCaretToEnd();
          setSuggestions([]);
          lastMatchIndex = -1;
        }
      }
      return true;
    }

    if (event.key === 'ArrowDown') {
      if (state.cmdHistoryIndex > -1) {
        event.preventDefault();
        state.cmdHistoryIndex--;
        if (state.cmdHistoryIndex === -1) {
          cmdInput.value = state.cmdHistoryTemp;
        } else {
          const entry = state.cmdHistory[state.cmdHistoryIndex];
          cmdInput.value = typeof entry === 'string' ? entry : entry.cmd;
        }
        moveCaretToEnd();
        setSuggestions([]);
        lastMatchIndex = -1;
      }
      return true;
    }
    return false;
  }

  function dispatchRawTerminalInput(raw) {
    try {
      const terminalInputHandler = typeof state?._terminalInputHandler === 'function'
        ? state._terminalInputHandler
        : null;

      if (terminalInputHandler) {
        const handled = terminalInputHandler(raw);
        if (handled && typeof handled.catch === 'function') {
          handled.catch((error) => {
            console.error('[CommandInput] Terminal input handler failed:', error);
          });
        }
        if (handled) return true;
      }

      // [LOG: 20260509_1115] Raw prompt input is consumed before command history for PC communication-style line editors.
      if (state._signupEnterHandler && state._signupEnterHandler(raw)) return true;
    } catch (error) {
      console.error('[CommandInput] Terminal input dispatch failed:', error);
      return true;
    }

    return false;
  }

  function handleKeyDown(event) {
    if (interruptRendering) interruptRendering();

    const val = cmdInput.value.trim();
    const suggestionsVisible = false;
    const ghostText = document.getElementById('cmd-ghost-text')?.textContent || '';
    const matches = [];

    // [LOG: 20260509_1115] Ctrl+P/Ctrl+H no longer open a central palette overlay.
    if (event.key === 'Tab') {
      if (ghostText && ghostText.length > val.length && val !== '') {
        event.preventDefault();
        cmdInput.value = ghostText.toUpperCase();
        if (typeof setGhostText === 'function') setGhostText('');
        setSuggestions([]);
        moveCaretToEnd();
        return;
      }
      if (matches.length > 0 && cmdInput.value.trim() !== '') {
        handleTabKey(event, matches);
      } else if (typeof jumpToContent === 'function') {
        event.preventDefault();
        jumpToContent();
      }
      return;
    }

    if (event.ctrlKey && (event.key === '=' || event.key === '+')) {
      event.preventDefault();
      void handleCmd('ZOOM IN');
      return;
    }
    if (event.ctrlKey && event.key === '-') {
      event.preventDefault();
      void handleCmd('ZOOM OUT');
      return;
    }
    if (event.ctrlKey && (event.key === '0' || event.key === 'r')) {
      event.preventDefault();
      void handleCmd('ZOOM RESET');
      return;
    }

    if (suggestionsVisible && matches.length > 1) {
      if (handleSuggestionNavigation(event, matches)) return;
    }

    const wantsHintExpand = (event.key === '+' || event.code === 'NumpadAdd')
      && !event.ctrlKey && !event.altKey && !event.metaKey
      && cmdInput.value.trim() === '';

    if (wantsHintExpand) {
      event.preventDefault();
      void handleCmd('+');
      return;
    }

    if (handleHistoryNavigation(event)) return;
    if (event.key !== 'Enter') return;

    const raw = cmdInput.value;
    const cmd = raw.trim();
    cmdInput.value = '';
    if (typeof CustomEvent === 'function') {
      cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
    }
    clearSuggestions();
    lastMatchIndex = -1;

    if (dispatchRawTerminalInput(raw)) {
      state.cmdHistoryIndex = -1;
      state.cmdHistoryTemp = '';
      if (!state._maskCommandInput && cmdInput.type !== 'text') cmdInput.type = 'text';
      return;
    }

    const sensitiveInput = isSensitiveCommandInput();
    if (cmd && !sensitiveInput) {
      if (typeof saveHistory === 'function') {
        saveHistory(cmd, state.screen);
      } else if (state.cmdHistory[0] !== cmd) {
        state.cmdHistory.unshift(cmd);
        if (state.cmdHistory.length > 50) state.cmdHistory.pop();
      }
    } else if (cmd && sensitiveInput && Array.isArray(state.cmdHistory)) {
      // [LOG: 20260507_1735] Purge the submitted secret if it was captured before this guard existed.
      state.cmdHistory = state.cmdHistory.filter((entry) => {
        const value = typeof entry === 'string' ? entry : entry?.cmd;
        return value !== cmd;
      });
      try {
        window.localStorage?.setItem('bbs_cmd_history', JSON.stringify(state.cmdHistory));
      } catch (error) {
        console.warn('[CommandInput] Failed to purge sensitive history:', error.message);
      }
      if (state.cmdStats && typeof state.cmdStats === 'object') {
        delete state.cmdStats[cmd];
        delete state.cmdStats[cmd.toUpperCase()];
        try {
          window.localStorage?.setItem('bbs_cmd_stats', JSON.stringify(state.cmdStats));
        } catch (error) {
          console.warn('[CommandInput] Failed to purge sensitive stats:', error.message);
        }
      }
    }
    state.cmdHistoryIndex = -1;
    state.cmdHistoryTemp = '';

    if (cmdInput.type !== 'text') cmdInput.type = 'text';

    const result = handleCmd(cmd);
    trackCommandPending(result, { value: cmd, clearOnSettled: true });
    void result;
  }

  cmdInput.addEventListener('input', handleInput);
  cmdInput.addEventListener('keydown', handleKeyDown);

  return {
    moveCaretToEnd
  };
}
