/**
 * interactionHandlers.js
 * [LOG: 20260428_1630] Evolution Mode 16/500: Extracted from appEvents.js for modularity.
 * Contains unified interaction handlers for DOM elements.
 */

import { isMobileDevice } from './uiUtils.js';

export function createInteractionHandlers(deps) {
  const {
    state,
    handleCmd,
    cmdInput,
    moveCaretToEnd,
    setGhostText,
    setSuggestions
  } = deps;

  const desktopPointerQuery = '(hover: hover) and (pointer: fine)';

  /**
   * Decide whether to autofocus the command input.
   */
  function shouldAutoFocusCommandInput() {
    if (isMobileDevice()) return false;
    return window.matchMedia(desktopPointerQuery).matches;
  }

  function showPendingCommandInput(value) {
    const text = String(value || '').trim();
    if (!cmdInput) {
      return false;
    }

    cmdInput.value = text;
    cmdInput.focus();
    if (typeof moveCaretToEnd === 'function') {
      moveCaretToEnd();
    }
    if (typeof setGhostText === 'function') {
      setGhostText('');
    }
    if (typeof setSuggestions === 'function') {
      setSuggestions([]);
    }
    return true;
  }

  function clearPendingCommandInput(value) {
    const text = String(value || '').trim();
    if (!cmdInput || cmdInput.value !== text) {
      return;
    }

    cmdInput.value = '';
    if (typeof setGhostText === 'function') {
      setGhostText('');
    }
    if (typeof setSuggestions === 'function') {
      setSuggestions([]);
    }
  }

  function clearPendingWhenSettled(result, value) {
    Promise.resolve(result).finally(() => clearPendingCommandInput(value));
  }

  function executeCommand(value, options = {}) {
    const text = String(value || '').trim();
    if (!text || typeof handleCmd !== 'function') {
      return false;
    }

    // [LOG: 20260505_2231] Show the clicked command/number in the input line
    // while executing, without dispatching `input` and opening autocomplete.
    if (options.showPending !== false) {
      showPendingCommandInput(text);
    }
    clearPendingWhenSettled(handleCmd(text), text);
    return true;
  }

  function executeSignupChoice(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) {
      return false;
    }

    showPendingCommandInput(text);
    if (typeof state._signupEnterHandler === 'function') {
      const result = state._signupEnterHandler(text);
      if (result) {
        clearPendingWhenSettled(result, text);
        return true;
      }
    }

    return executeCommand(text);
  }

  function getClickableCommandValue(attr, btn) {
    if (!btn) {
      return '';
    }

    const explicitValue = String(btn.dataset.cmdFill || btn.dataset.commandInput || '').trim();
    if (explicitValue) {
      return explicitValue;
    }

    if (attr === 'cmd') return String(btn.dataset.cmd || '').trim();
    if (attr === 'signup-choice') return String(btn.dataset.signupChoice || '').trim().toUpperCase();
    if (attr === 'postid' || attr === 'post-row') return String(btn.dataset.postid || '').trim();
    if (attr === 'boardkey') return String(btn.dataset.boardkey || '').trim();
    if (attr === 'node-key') return String(btn.dataset.door || btn.dataset.nodeKey || '').trim();
    if (attr === 'menu-path') {
      const menuPath = String(btn.dataset.menuPath || '').trim();
      return String(btn.dataset.door || (menuPath === 'top' ? 'T' : menuPath)).trim();
    }
    if (attr === 'board-id') return String(btn.dataset.door || btn.dataset.boardId || '').trim();
    return '';
  }

  const handlers = {
    'signup-choice': (btn) => {
      executeSignupChoice(getClickableCommandValue('signup-choice', btn));
    },
    'postid': (btn) => {
      executeCommand(getClickableCommandValue('postid', btn));
    },
    'post-row': (btn) => {
      executeCommand(getClickableCommandValue('post-row', btn));
    },
    'boardkey': (btn) => {
      executeCommand(getClickableCommandValue('boardkey', btn));
    },
    'node-key': (btn) => {
      executeCommand(getClickableCommandValue('node-key', btn));
    },
    'menu-path': (btn) => {
      // [LOG: 20260505_2245] Topbar home clicks should show only the loading text,
      // not a transient "T" in the command line.
      const showPending = !btn.closest?.('.retro-topbar--ansi');
      executeCommand(getClickableCommandValue('menu-path', btn), { showPending });
    },
    'board-id': (btn) => {
      executeCommand(getClickableCommandValue('board-id', btn));
    },
    'cmd-fill': (btn) => {
      executeCommand(getClickableCommandValue('cmd-fill', btn));
    },
    'external-url': (btn) => {
      const opened = window.open(btn.dataset.externalUrl, '_blank', 'noopener,noreferrer');
      if (opened) opened.opener = null;
    },
    'cmd': (btn) => {
      executeCommand(getClickableCommandValue('cmd', btn));
    }
  };

  function handleGlobalClick(event, interruptRendering) {
    // [LOG: 20260426_1325] 렌더링 중단 여부를 핸들러 내부에서 결정하도록 변경 (무조건 중단 방지)

    const target = event.target;
    
    // 1. Unified attribute-based handler lookup
    const handlerEntries = Object.entries(handlers);
    for (const [attr, handler] of handlerEntries) {
      const btn = target.closest(`[data-${attr}], .${attr}`);
      if (btn) {
        event.preventDefault();

        // [LOG: 20260426_1325] 유틸리티 명령어(C, Y 등)는 렌더링을 중단하지 않도록 개선
        const cmdValue = btn.dataset.cmd || '';
        const QUIET_COMMANDS = ['C', 'COLOR', 'Y', 'MUTE', '+', 'ZOOM', 'RESET', 'PERF', 'SYSINFO', 'DIAG', 'ACT', 'ACTIVITY', 'HIST', 'ENV', 'VARS', 'ALIAS', 'SET'];
        const isQuiet = QUIET_COMMANDS.some(q => cmdValue.toUpperCase().startsWith(q));

        if (!isQuiet && interruptRendering) {
          interruptRendering();
        }
        
        handler(btn);
        return true;
      }
    }
    return false;
  }

  return {
    handlers,
    handleGlobalClick,
    shouldAutoFocusCommandInput
  };
}
