/**
 * appEvents.js
 * [LOG: 20260426_0515] Evolve Mode: Refactored click handler for better readability and maintainability.
 * [LOG: 20260428_1635] Evolution Mode 16/500: Extracted InteractionHandlers to separate module.
 */
import { bindCommandInputEvents } from './appEventsCommandInput.js';

export function bindAppEvents(deps) {
  const {
    cmdInput,
    handleCmd,
    state,
    interruptRendering,
    setGhostText,
    setSuggestions,
    interactionHandlers // New dependency
  } = deps;

  const { handleGlobalClick, shouldAutoFocusCommandInput } = interactionHandlers;
  const { moveCaretToEnd } = bindCommandInputEvents(deps);

  function getCommandClickAction(target) {
    const commandToken = target?.closest?.('[data-cmd-execute], [data-cmd-fill], [data-cmd], [data-signup-choice]');
    if (!commandToken || commandToken.closest?.('[data-external-url]')) {
      return null;
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
    Promise.resolve(result).finally(() => clearPendingCommandInput(value));
  }

  function executeCommandFromClick(action) {
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
      cmdInput.focus();
      moveCaretToEnd();
    }
    if (typeof setGhostText === 'function') {
      setGhostText('');
    }
    if (typeof setSuggestions === 'function') {
      setSuggestions([]);
    }

    if (action.kind === 'signup-choice' && typeof state?._signupEnterHandler === 'function') {
      const result = state._signupEnterHandler(text);
      if (result) {
        clearPendingWhenSettled(result, text);
        return true;
      }
    }

    if (typeof handleCmd !== 'function') {
      return false;
    }

    clearPendingWhenSettled(handleCmd(text), text);
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
      }
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

    // Ignore modifier combinations
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // Redirect printable characters and backspace
    if (e.key.length === 1 || e.key === 'Backspace') {
      cmdInput.focus();
      moveCaretToEnd();
    }
  });

  document.addEventListener('click', (event) => {
    const action = getCommandClickAction(event.target);
    if (!action) {
      return;
    }

    const handled = executeCommandFromClick(action);
    if (handled) {
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

  // Global click-to-focus for terminal feel
  const terminalFooter = document.getElementById('terminal-footer');
  if (terminalFooter) {
    terminalFooter.addEventListener('click', (event) => {
      if (shouldAutoFocusCommandInput()) return;
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
