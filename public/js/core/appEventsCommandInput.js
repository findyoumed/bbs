import { getCommandMatches } from './commandService.js';
import {
  beginCommandExecution,
  cancelCommandExecution,
  isCommandExecutionLocked as isExecutionLocked,
  trackCommandExecution
} from './commandExecutionState.js';
import { cancelCommandPending, getPendingCommandValue, isCommandPending, trackCommandPending } from './commandPendingUi.js';
import { toAsciiPasswordInput } from './hangulKeyboard.js';

export function bindCommandInputEvents(deps) {
  const {
    cmdInput,
    handleCmd,
    interruptRendering,
    jumpToContent,
    saveHistory,
    setGhostText,
    setPrompt,
    setReady,
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

  // [LOG_ID: 20260716_2200] 마스킹(비밀번호, * 표시) 입력은 영문 전용으로 강제한다.
  // 한글 IME 모드로 쳐도 실제 누른 QWERTY 문자만 들어가고 한글은 제거된다(모든 비밀번호 입력창 공통:
  // 로그인·회원가입·내정보 비밀번호/이메일 확인·탈퇴). 조합 중(isComposing)에는 건드리지 않고
  // 조합이 끝난 뒤 정리한다 — 조합 기준이 발밑에서 바뀌어 글자가 씹히는 것을 막기 위함.
  function sanitizeMaskedInput() {
    if (!cmdInput || !isSensitiveCommandInput()) return;
    const before = cmdInput.value || '';
    const after = toAsciiPasswordInput(before);
    if (after === before) return;
    const selStart = typeof cmdInput.selectionStart === 'number' ? cmdInput.selectionStart : after.length;
    cmdInput.value = after;
    if (typeof cmdInput.setSelectionRange === 'function') {
      const nextCaret = Math.max(0, Math.min(after.length, selStart + after.length - before.length));
      cmdInput.setSelectionRange(nextCaret, nextCaret);
    }
    if (typeof CustomEvent === 'function') {
      cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
    }
  }

  function isCommandExecutionLocked() {
    return isCommandPending() || isExecutionLocked(state);
  }

  function handleInput(event) {
    if (isCommandExecutionLocked()) {
      // [LOG: 20260617_1035] Keep submitted command immutable while the PC-style wait cursor is active.
      const pendingValue = getPendingCommandValue();
      if (cmdInput.value !== pendingValue) {
        cmdInput.value = pendingValue;
        moveCaretToEnd();
      }
      event.preventDefault?.();
      return;
    }

    // 마스킹 입력은 영문 전용 — 조합이 끝난 입력에 대해 한글을 QWERTY로 되돌리고 ASCII만 남긴다.
    if (isSensitiveCommandInput() && !(event && event.isComposing)) {
      sanitizeMaskedInput();
    }

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
    if (isCommandExecutionLocked()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelCommandExecution(state, { cmdInput, interruptRendering, setGhostText, setPrompt, setReady, setSuggestions });
        cancelCommandPending();
      } else {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

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
    event.preventDefault();

    // [LOG_ID: 20260709_1210] 한글 자모(ㅜ 등) 입력 중 엔터 시 브라우저 한글 조합(IME) 찌꺼기 잔상이 
    // 터미널 렌더링 영역에 남는 현상을 차단하기 위해, 안전하게 일시적 blur-focus 를 실행하여 한글 조합을 강제 확정(Commit)시킨다.
    // 기존 캐럿의 위치(selectionStart/End)와 포커스 상태를 임시 저장했다가 복원하므로 캐럿 위치는 완벽하게 보호된다.
    const activeEl = document.activeElement;
    const start = cmdInput.selectionStart;
    const end = cmdInput.selectionEnd;
    if (event.isComposing || /[\u3130-\u318F\u1100-\u11FF]/.test(cmdInput.value)) {
      cmdInput.blur();
      if (activeEl === cmdInput) {
        cmdInput.focus();
        if (typeof cmdInput.setSelectionRange === 'function' && start !== null && end !== null) {
          cmdInput.setSelectionRange(start, end);
        }
      }
    }

    const raw = cmdInput.value;
    const cmd = raw.trim();
    
    // [LOG: 20260619_1732] Keep the text on Enter to prevent "disappear-then-reappear" flicker.
    // Clear immediately only for sensitive/masked inputs to preserve security.
    const sensitiveInput = isSensitiveCommandInput();
    if (sensitiveInput) {
      cmdInput.value = '';
      if (typeof CustomEvent === 'function') {
        cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
      }
    }
    clearSuggestions();
    lastMatchIndex = -1;

    if (dispatchRawTerminalInput(raw)) {
      // [LOG_ID: 20260707_1648] Raw-enter handlers own their own clearing/echo behavior; do not blank the footer here.
      state.cmdHistoryIndex = -1;
      state.cmdHistoryTemp = '';
      if (!state._maskCommandInput && cmdInput.type !== 'text') cmdInput.type = 'text';
      return;
    }

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

    const token = beginCommandExecution(state);
    let result;
    try {
      result = handleCmd(cmd);
    } catch (error) {
      state._commandInFlight = false;
      delete state._commandInFlightToken;
      delete state._commandAbortController;
      delete state._commandScreenBeforeInFlight;
      throw error;
    }
    trackCommandExecution(state, result, token);
    trackCommandPending(result, { value: cmd, clearOnSettled: true });
    void result;
  }

  cmdInput.addEventListener('input', handleInput);
  cmdInput.addEventListener('keydown', handleKeyDown);
  // [LOG_ID: 20260716_2200] 한글 조합이 확정되는 compositionend 시점에 마스킹 입력을 영문으로 정리한다.
  // 크롬은 compositionend에서 아직 확정 문자를 value에 못 넣은 경우가 있어 다음 틱에 한 번 더 정리한다.
  cmdInput.addEventListener('compositionend', () => {
    if (!isSensitiveCommandInput()) return;
    sanitizeMaskedInput();
    window.setTimeout(sanitizeMaskedInput, 0);
  });

  return {
    moveCaretToEnd
  };
}
