/**
 * appEvents.js
 * [LOG: 20260426_0515] Evolve Mode: Refactored click handler for better readability and maintainability.
 * [LOG: 20260428_1635] Evolution Mode 16/500: Extracted InteractionHandlers to separate module.
 */
import { bindCommandInputEvents } from './appEventsCommandInput.js';
import {
  beginCommandExecution,
  cancelCommandExecution,
  isCommandExecutionLocked as isExecutionLocked,
  trackCommandExecution
} from './commandExecutionState.js';
import { cancelCommandPending, isCommandPending, trackCommandPending } from './commandPendingUi.js';

export function bindAppEvents(deps) {
  const {
    cmdInput,
    handleCmd,
    state,
    interruptRendering,
    setPrompt,
    setReady,
    setGhostText,
    setSuggestions,
    interactionHandlers // New dependency
  } = deps;

  const { handleGlobalClick, shouldAutoFocusCommandInput } = interactionHandlers;
  const { moveCaretToEnd } = bindCommandInputEvents(deps);
  let lastEditorField = null;

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target === cmdInput || target?.matches?.('#terminal-screen input, #terminal-screen textarea, #terminal-screen select')) {
      lastEditorField = target;
    }
  }, true);

  function getCommandClickAction(target) {
    // [LOG_ID: 20260723_2310] GO 등 prefill 토큰도 이 캡처 단계 리스너의 셀렉터에 없으면
    // getCommandClickAction이 null을 반환해 그냥 지나치긴 하지만(버블 단계로 넘어감), 실제
    // 기기에서 손가락이 토큰과 바로 옆 쉼표(.cmd-sep) 경계를 살짝 벗어나 짚었을 때의 히트테스트
    // 차이 등 재현하기 어려운 변수를 없애기 위해, 이 1차 캡처 리스너에서부터 명시적으로 인식한다.
    const commandToken = target?.closest?.('[data-cmd-execute], [data-cmd-fill], [data-cmd-prefill], [data-cmd-focus-next], [data-cmd], [data-signup-choice]');
    if (!commandToken || commandToken.closest?.('[data-external-url]')) {
      return null;
    }

    if (commandToken.dataset.cmdFocusNext !== undefined) {
      return { kind: 'focus-next' };
    }

    if (commandToken.dataset.cmdPrefill) {
      return { kind: 'prefill', value: commandToken.dataset.cmdPrefill };
    }

    const value = String(commandToken.dataset.cmdFill || commandToken.dataset.cmd || commandToken.dataset.signupChoice || '')
      .trim()
      .toUpperCase();
    if (!value) {
      return null;
    }

    return {
      kind: commandToken.dataset.signupChoice ? 'signup-choice' : 'command',
      value
    };
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

  function focusNextEditorField() {
    const fields = Array.from(document.querySelectorAll(
      '#terminal-screen input:not([disabled]), #terminal-screen textarea:not([disabled]), #terminal-screen select:not([disabled])'
    ));
    if (cmdInput && !cmdInput.disabled && !fields.includes(cmdInput)) {
      fields.push(cmdInput);
    }
    if (fields.length === 0) {
      return false;
    }

    const currentIndex = fields.indexOf(document.activeElement === cmdInput
      ? cmdInput
      : (fields.includes(document.activeElement) ? document.activeElement : lastEditorField));
    const next = fields[(currentIndex + 1 + fields.length) % fields.length];
    try {
      next.focus({ preventScroll: true });
    } catch (_) {
      next.focus();
    }
    if (next === cmdInput && typeof next.select === 'function') {
      next.select();
    } else if (typeof next.setSelectionRange === 'function') {
      const end = next.value?.length || 0;
      next.setSelectionRange(end, end);
    }
    return true;
  }

  function executeCommandFromClick(action) {
    if (isCommandExecutionLocked()) {
      // [LOG: 20260617_1035] Swallow command clicks while a submitted line is waiting.
      return true;
    }

    if (action?.kind === 'focus-next') {
      return focusNextEditorField();
    }

    // [LOG_ID: 20260723_2310] prefill(GO 등)은 실행하지 않고 입력줄만 채운다 — 인자가 꼭 필요한
    // 명령을 클릭 즉시 실행하면 아무 일도 안 일어나는 죽은 버튼이 되므로, 사용자가 이어서 직접
    // 타이핑하도록 값만 채우고 포커스한다. interruptRendering/handleCmd는 건드리지 않는다.
    if (action?.kind === 'prefill') {
      const text = String(action.value || '');
      if (!text || !cmdInput) {
        return false;
      }
      cmdInput.value = text;
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
      }
      moveCaretToEnd();
      if (typeof setGhostText === 'function') {
        setGhostText('');
      }
      if (typeof setSuggestions === 'function') {
        setSuggestions([]);
      }
      return true;
    }

    const text = String(action?.value || '').trim();
    if (!text) {
      return false;
    }

    // [LOG: 20260505_2231] Capture-phase command clicks should show the clicked
    // text in the input line during execution without dispatching `input`, so
    // autocomplete suggestions do not appear.
    if (interruptRendering) {
      interruptRendering();
    }
    if (cmdInput) {
      cmdInput.value = text;
      // [LOG: 20260617_1550] Only focus if auto-focus is enabled (e.g. desktop).
      // On mobile, this prevents the keyboard from popping up and covering the UI when clicking buttons.
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
      }
      moveCaretToEnd();
    }
    if (typeof setGhostText === 'function') {
      setGhostText('');
    }
    if (typeof setSuggestions === 'function') {
      setSuggestions([]);
    }

    if (action.kind === 'signup-choice' && typeof state?._signupEnterHandler === 'function') {
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

    if (typeof handleCmd !== 'function') {
      return false;
    }

    // [LOG_ID: 20260721_1830] interactionHandlers.js의 executeCommand()는 클릭 의도를 구분하려고
    // handleCmd(text, { source: 'click' })로 호출하는데(주석: "typed → message" vs "clicked →
    // navigation"), 여기(풋터의 data-cmd/data-cmd-fill 토큰 클릭 경로)는 그 컨텍스트 없이
    // handleCmd(text)만 호출하고 있었다 — commandDispatcherExecution.js가 context.source==='click'
    // 여부로 raw-text 입력 화면(대화방 등)에서 "타이핑한 메시지"와 "클릭한 명령"을 가르는데,
    // 이 경로로 들어오면 항상 타이핑 취급되어 대화방 풋터의 P/T/O/ST 등을 클릭하면 명령이
    // 실행되는 대신 그 글자 그대로가 채팅 메시지로 전송되는 결함이 있었다(사용자 지적:
    // "다른 화면도 명령어 감사해줘" 조사로 발견 — commandRouterChat.js의 기존
    // "context?.source === 'click' && cmd === 'T'" 분기가 상단바 로고 클릭에서는 동작했지만
    // 풋터 클릭에서는 이 누락 때문에 무력화돼 있었다).
    const token = beginCommandExecution(state);
    const result = handleCmd(text, { source: 'click' });
    trackCommandExecution(state, result, token);
    clearPendingWhenSettled(result, text);
    return true;
  }

  // [LOG: 20260426_1830] Global Shortcut Helper Toggle (Capture Phase for high priority)
  window.addEventListener('keydown', (e) => {
    const helper = document.getElementById('shortcut-helper');
    if (!helper) return;

    if (e.key === 'Alt') {
      if (!e.repeat) {
        helper.classList.toggle('is-visible');
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      if (helper.classList.contains('is-visible')) {
        helper.classList.remove('is-visible');
        e.preventDefault();
        e.stopPropagation(); // Prevent ESC from triggering other actions when helper is open
        return;
      }
    }

    if (e.key === 'Escape' && isCommandExecutionLocked()) {
      // [LOG: 20260617_1035] Let ESC cancel the PC-style wait cursor even when the prompt lost focus.
      cancelCommandExecution(state, { cmdInput, interruptRendering, setGhostText, setPrompt, setReady, setSuggestions });
      cancelCommandPending();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // [LOG: 20260622_1820] ESC로 도움말 화면 닫기(상위로 복귀). 명령 실행 중이 아닐 때만.
    if (e.key === 'Escape' && state?.screen === 'help' && typeof handleCmd === 'function') {
      e.preventDefault();
      e.stopPropagation();
      void handleCmd('P');
    }
  }, { capture: true });

  window.addEventListener('keyup', (e) => {
    // [LOG: 20260426_1800] Removed auto-hide on keyup to support toggle mode
  });

  // [LOG: 20260610_1425] Redirect keyboard inputs to the main command input if no other input is focused
  window.addEventListener('keydown', (e) => {
    if (!cmdInput || cmdInput.disabled) {
      return;
    }

    // Do nothing if command input is already focused
    if (document.activeElement === cmdInput) {
      return;
    }

    // Do nothing if typing in another input, textarea, select, or contenteditable element
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || activeEl.isContentEditable) {
        return;
      }
    }

    // Native buttons/links and custom keyboard controls own Space activation.
    // Treating Space as printable command input here would move focus to
    // #cmd-input before the browser's click-on-keyup behavior can fire, so a
    // focused hotspot (or role=button token) would respond to Enter but not
    // Space. Let the control and the shared token handler process it.
    const focusedInteractive = activeEl && activeEl !== document.body
      && activeEl.matches?.('button, a, [role="button"], [tabindex]');
    if (focusedInteractive) {
      return;
    }

    // Ignore modifier combinations
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // Redirect printable characters and backspace
    if (e.key.length === 1 || e.key === 'Backspace') {
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
        moveCaretToEnd();
      }
      return;
    }

    // [LOG_ID: 20260711_1200] 포커스가 입력창에 없어도 Enter는 명령줄 제출로 동작해야 한다.
    // (빈 엔터는 paged 화면에서 commandNormalizer가 F(다음쪽)로 정규화한다.)
    // 터치 지원 기기(터치스크린 노트북 포함)는 자동 포커스가 꺼져 있어(20260617_1550) 핫스팟
    // 클릭 후 포커스가 body로 떨어지는데, 이때 Enter가 그냥 사라져 "엔터로 다음쪽"이 안 됐다.
    // 문자 키와 달리 Enter는 포커스 이동만으로는 입력창에 전달되지 않으므로 합성 keydown을
    // 직접 보낸다(bubbles 기본값 false라 이 리스너로 재유입되지 않는다). 버튼/링크 등
    // 포커스된 대화형 요소의 Enter 기본 동작(키보드 접근성)은 그대로 둔다.
    if (e.key === 'Enter') {
      const focusedInteractive = activeEl && activeEl !== document.body
        && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'A' || activeEl.hasAttribute?.('tabindex'));
      if (focusedInteractive) {
        return;
      }
      e.preventDefault();
      if (shouldAutoFocusCommandInput()) {
        cmdInput.focus();
        moveCaretToEnd();
      }
      cmdInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
  });

  // [LOG_ID: 20260711_1140] 탭/클릭한 핫스팟에 선택 표시 클래스를 부여한다. 예전에는 터치의
  // sticky :hover가 우연히 이 역할(탭한 뉴스 제목의 박스선)을 했지만, 로딩 화면 위 잔상 문제로
  // hover를 호버 가능 포인터로 제한(20260711_1115)하면서 함께 사라졌다 — CSS가 로딩 중에는
  // 숨기는 조건(is-loading)과 짝을 이뤄, 제자리 선택 표시만 남기고 잔상은 차단한다.
  // 핫스팟 클릭 경로는 두 갈래라 양쪽 모두에서 부여한다: data-cmd/cmd-fill은 여기(캡처 단계,
  // stopImmediatePropagation으로 전파 차단), menu-path/board-id 등은 interactionHandlers.
  function markTapSelectedHotspot(target) {
    const hotspot = target?.closest?.('.ansi-hotspot');
    if (!hotspot) return;
    document.querySelectorAll('.ansi-hotspot.is-tap-selected').forEach((el) => {
      if (el !== hotspot) el.classList.remove('is-tap-selected');
    });
    hotspot.classList.add('is-tap-selected');
  }

  // [LOG_ID: 20260901_1015] Ultra-short landscape viewports compress ANSI
  // rows below the 24px touch target. The resulting hotspot boxes overlap,
  // so browser hit-testing can deliver a tap to the following row. Resolve a
  // pointer click to the hotspot whose visual row center is nearest the
  // pointer while preserving the original target for keyboard-triggered
  // clicks (which do not carry client coordinates).
  function resolveHotspotClickTarget(target, event) {
    const hotspot = target?.closest?.('.ansi-hotspot');
    const x = Number(event?.clientX || 0);
    const y = Number(event?.clientY || 0);
    if (!hotspot || (!x && !y)) return target;

    const layer = hotspot.closest?.('.ansi-hotspot-layer');
    if (!layer) return target;

    const candidates = [...layer.querySelectorAll('.ansi-hotspot')]
      .filter((candidate) => {
        const style = getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && rect.width > 0
          && rect.height > 0;
      });
    if (candidates.length < 2) return target;

    let nearest = hotspot;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      const distance = Math.hypot(centerX - x, centerY - y);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  // [LOG_ID: 20260801_1222] 프로젝트 전역 터미널 포커스 가드 (Focus Guard)
  // 예외 없이 모든 화면에서 정해진 입력 필드 이외의 영역을 클릭할 때 포커스 날아감 방지 및 자동 복구.
  if (typeof shouldAutoFocusCommandInput === 'function' && shouldAutoFocusCommandInput()) {
    let lastFocusedElement = null;

    document.addEventListener('focusin', (event) => {
      const target = event.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      if (isInput && !target.disabled) {
        lastFocusedElement = target;
      }
    }, true);

    const isOutsideActiveInput = (event) => {
      const closestFocusable = event.target.closest('input, textarea, select, a, button, [tabindex]');
      return !closestFocusable || closestFocusable.disabled;
    };

    document.addEventListener('mousedown', (event) => {
      if (isOutsideActiveInput(event)) {
        event.preventDefault();
      }
    }, true);

    document.addEventListener('click', (event) => {
      if (!isOutsideActiveInput(event)) return;

      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      event.stopPropagation();

      let targetToFocus = lastFocusedElement;
      if (!targetToFocus || !document.body.contains(targetToFocus) || targetToFocus.disabled) {
        const inlineInput = document.querySelector('#terminal-screen input:not([disabled]), #terminal-screen textarea:not([disabled]), #terminal-screen select:not([disabled])');
        if (inlineInput) {
          targetToFocus = inlineInput;
        } else {
          targetToFocus = cmdInput;
        }
      }

      if (targetToFocus && document.activeElement !== targetToFocus) {
        targetToFocus.focus();
        if (targetToFocus.setSelectionRange && (targetToFocus.tagName === 'INPUT' || targetToFocus.tagName === 'TEXTAREA')) {
          const len = targetToFocus.value.length;
          targetToFocus.setSelectionRange(len, len);
        }
      }
    }, true);
  }

  // [LOG_ID: 20260827_1345] Command tokens are spans so their retro text
  // layout remains unchanged. Give keyboard users the same action as a mouse
  // click when a token receives focus with Tab.
  document.addEventListener('keydown', (event) => {
    const token = event.target?.closest?.('.cmd-token, [data-cmd], [data-signup-choice]');
    if (!token || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    token.click();
  }, { capture: true });

  document.addEventListener('click', (event) => {
    const clickTarget = resolveHotspotClickTarget(event.target, event);
    const action = getCommandClickAction(clickTarget);
    if (!action) {
      return;
    }

    const handled = executeCommandFromClick(action);
    if (handled) {
      markTapSelectedHotspot(clickTarget);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  document.addEventListener('click', (event) => {
    // [LOG: 20260426_1835] Close shortcut helper if clicking on close button or background
    const helper = document.getElementById('shortcut-helper');
    const closeBtn = document.getElementById('shortcut-helper-close');
    
    if (helper && helper.classList.contains('is-visible')) {
        const isCloseClick = event.target === closeBtn || event.target.closest('#shortcut-helper-close');
        // If clicking the modal background (the div itself) or the close button
        if (isCloseClick || event.target === helper) {
            helper.classList.remove('is-visible');
            return;
        }
    }
    handleGlobalClick(event, interruptRendering);
  });

  // [LOG: 20260729_1743] 도움말 화면(/help) 빈 화면 클릭 시 이전 화면으로 복귀하던 이벤트 리스너 제거

  // Global click-to-focus for terminal feel
  const terminalFooter = document.getElementById('terminal-footer');
  if (terminalFooter) {
    terminalFooter.addEventListener('click', (event) => {
      // [LOG: 20260617_1605] Only auto-focus on desktop. On mobile, this prevents accidental keyboard popups.
      if (!shouldAutoFocusCommandInput()) return;
      if (event.target.closest('input, textarea, select, button, a, [data-cmd], [data-cmd-fill], [data-cmd-execute], [data-external-url], [data-signup-choice]')) return;
      if (document.querySelector('#terminal-screen input, #terminal-screen textarea, #terminal-screen select')) return;

      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      cmdInput.focus();
      moveCaretToEnd();
    });
  }

  if (shouldAutoFocusCommandInput()) {
    const terminalWrapper = document.getElementById('terminal-wrapper');
    if (terminalWrapper) {
      terminalWrapper.addEventListener('click', (event) => {
        if (event.target.closest('input, textarea, select')) return;
        // [LOG: 20260722_1407] 화면 내부에 인라인 입력창(예: 건의하기)이 렌더링되어 있다면 글로벌 포커스를 cmdInput으로 뺏지 않음
        if (document.querySelector('#terminal-screen input, #terminal-screen textarea, #terminal-screen select')) return;
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        cmdInput.focus();
      });
    }
  }


  // [LOG: 20260610_1145] Enable smooth text selection by disabling pointer-events on hotspots during dragging
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const isSelecting = selection && selection.toString().trim().length > 0;
    const container = document.getElementById('terminal-container');
    if (container) {
      container.classList.toggle('is-selecting', isSelecting);
    }
  });
}
