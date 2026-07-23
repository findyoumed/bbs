/**
 * interactionHandlers.js
 * [LOG: 20260428_1630] Evolution Mode 16/500: Extracted from appEvents.js for modularity.
 * Contains unified interaction handlers for DOM elements.
 */

import {
  beginCommandExecution,
  isCommandExecutionLocked as isExecutionLocked,
  trackCommandExecution
} from './commandExecutionState.js';
import { isMobileDevice, shouldAutoFocusCommandInput } from './uiUtils.js';
import { isCommandPending, trackCommandPending } from './commandPendingUi.js';

export function createInteractionHandlers(deps) {
  const {
    state,
    handleCmd,
    cmdInput,
    moveCaretToEnd,
    setGhostText,
    setSuggestions,
    showToast
  } = deps;

  /**
   * Decide whether to autofocus the command input.
   * [LOG: 20260617_1540] Moved to uiUtils.js.
   */

  function showPendingCommandInput(value) {
    const text = String(value || '').trim();
    if (!cmdInput) {
      return false;
    }

    cmdInput.value = text;
    // [LOG: 20260617_1545] Only focus the input if we should auto-focus (e.g. on desktop).
    // Forcing focus on mobile causes the virtual keyboard to pop up and cover the screen when tapping buttons.
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
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

  // [LOG_ID: 20260723_2300] GO처럼 인자가 꼭 필요한 명령은 클릭해도 그대로 실행하면 죽은 버튼이라
  // (사용자 요청) 클릭 시 실행하지 않고 입력줄에 "CMD "만 채워 넣고 포커스만 준다 — 이어서 사용자가
  // 직접 인자를 타이핑해서 엔터를 누르는 방식. showPendingCommandInput(실행 직전 표시용)과 달리
  // 여기서는 executeCommand를 아예 호출하지 않는다.
  function prefillCommandInput(value) {
    const text = String(value || '');
    if (!cmdInput) {
      return false;
    }

    cmdInput.value = text;
    // [LOG_ID: 20260723_2300] 이건 사용자가 직접 탭한 결과라, 화면 자동 전환 때 키보드 팝업을
    // 막는 shouldAutoFocusCommandInput()의 일반 규칙과 무관하게 항상 포커스를 준다.
    cmdInput.focus();
    if (typeof moveCaretToEnd === 'function') {
      moveCaretToEnd();
    }
    // [LOG_ID: 20260723_2320] P/T/H와 달리 화면이 안 바뀌는 조용한 동작이라 토스트로 확실히 알린다.
    if (typeof showToast === 'function') {
      showToast(`"${text.trim()}" 다음에 코드를 입력하고 엔터를 누르세요.`, 2500, 'info');
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
    trackCommandPending(result, { value });
    Promise.resolve(result).finally(() => clearPendingCommandInput(value));
  }

  function isCommandExecutionLocked() {
    return isCommandPending() || isExecutionLocked(state);
  }

  function executeCommand(value, options = {}) {
    if (isCommandExecutionLocked()) {
      // [LOG: 20260617_1035] Do not let another clickable command replace a pending submitted line.
      return true;
    }

    const text = String(value || '').trim();
    if (!text || typeof handleCmd !== 'function') {
      return false;
    }

    // [LOG: 20260505_2231] Show the clicked command/number in the input line
    // while executing, without dispatching `input` and opening autocomplete.
    const showPending = options.showPending !== false;
    if (showPending) {
      showPendingCommandInput(text);
    }
    const token = beginCommandExecution(state);
    // [LOG: 20260707_1224] 클릭 출처를 디스패처에 알린다. 대화실 등 raw-text 화면에서
    // 타이핑 입력은 메시지로, 클릭 명령(상단바 로고 'T' 등)은 내비게이션으로 구분하기 위함.
    const result = handleCmd(text, { source: 'click' });
    trackCommandExecution(state, result, token);
    // [LOG: 20260621_1100] showPending=false(상단바 로고 클릭 등)면 입력창에 명령을 표시하지 않으므로
    // 대기 caret(trackCommandPending)에도 명령 텍스트를 넘기지 않는다. 80ms 후 'T'가 잠깐 노출되던 버그 차단.
    clearPendingWhenSettled(result, showPending ? text : '');
    return true;
  }

  function executeSignupChoice(value) {
    if (isCommandExecutionLocked()) {
      // [LOG: 20260617_1035] Signup choices share the same immutable pending command rule.
      return true;
    }

    const text = String(value || '').trim().toLowerCase();
    if (!text) {
      return false;
    }

    showPendingCommandInput(text);
    if (typeof state._signupEnterHandler === 'function') {
      const token = beginCommandExecution(state);
      const result = state._signupEnterHandler(text);
      if (result) {
        trackCommandExecution(state, result, token);
        clearPendingWhenSettled(result, text);
        return true;
      }
      state._commandInFlight = false;
      delete state._commandInFlightToken;
      delete state._commandAbortController;
      delete state._commandScreenBeforeInFlight;
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
    'cmd-prefill': (btn) => {
      prefillCommandInput(btn.dataset.cmdPrefill || '');
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
        const QUIET_COMMANDS = ['C', 'COLOR', 'Y', 'MUTE', '+', 'ZOOM', 'RESET', 'PERF', 'SYSINFO', 'DIAG', 'ACT', 'ACTIVITY', 'HIST', 'ENV', 'VARS', 'SET'];
        // [LOG_ID: 20260723_2300] prefill(GO 등)은 아무것도 실행/제출하지 않으므로 중단할 렌더링이 없다.
        const isQuiet = Boolean(btn.dataset.cmdPrefill) || QUIET_COMMANDS.some(q => cmdValue.toUpperCase().startsWith(q));

        if (!isQuiet && interruptRendering) {
          interruptRendering();
        }

        // [LOG_ID: 20260711_1140] 탭/클릭한 핫스팟에 선택 표시 클래스를 부여한다. 예전에는 터치의
        // sticky :hover가 우연히 이 역할(탭한 뉴스 제목에 박스선)을 했지만, 로딩 화면 위 잔상 문제로
        // hover를 호버 가능 포인터로 제한(20260711_1115)하면서 함께 사라졌다 — CSS가 로딩 중에는
        // 숨기는 조건과 짝을 이뤄, 제자리 선택 표시만 남기고 잔상은 차단한다.
        if (btn.classList?.contains('ansi-hotspot')) {
          document.querySelectorAll('.ansi-hotspot.is-tap-selected').forEach((el) => {
            if (el !== btn) el.classList.remove('is-tap-selected');
          });
          btn.classList.add('is-tap-selected');
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
