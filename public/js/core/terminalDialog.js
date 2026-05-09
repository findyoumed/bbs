/**
 * terminalDialog.js
 * [LOG: 20260426_0900] Unified Terminal Dialog System (Evolution Mode 16/100)
 * [LOG: 20260426_2200] Evolution: Integrated i18n and replaced hardcoded labels.
 */
import { esc } from './uiUtils.js';
import { UI_TEXT } from './i18n.js';

export function createTerminalDialog(deps) {
  const { cmdInput, screenEl, setPrompt, onOpen, onClose } = deps;
  let activeCleanup = null;

  function appendTranscript(message, className = 'terminal-dialog-line') {
    if (!screenEl || !message) return;
    const line = document.createElement('div');
    line.className = `ansi-line ${className}`;
    line.innerHTML = esc(message);
    screenEl.appendChild(line);
    line.scrollIntoView({ behavior: 'auto', block: 'end' });
  }

  function appendEcho(prompt, value) {
    if (!screenEl) return;
    const line = document.createElement('div');
    line.className = 'ansi-line command-echo';
    line.innerHTML = `<span class="ansi-cyan">${esc(prompt)}</span> <span class="ansi-white">${esc(value)}</span>`;
    screenEl.appendChild(line);
    line.scrollIntoView({ behavior: 'auto', block: 'end' });
  }

  function finishSession(resolve, value) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    setPrompt?.('>>');
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.disabled = false;
      cmdInput.focus();
    }
    onClose?.();
    resolve(value);
  }

  // [LOG: 20260509_1115] Overlay dialogs are replaced by bottom command-line prompts.
  function readBottomPrompt(message, promptText, defaultValue, handler) {
    return new Promise((resolve) => {
      if (!cmdInput) {
        resolve(handler('', 'enter'));
        return;
      }

      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }

      onOpen?.();
      appendTranscript(message);
      setPrompt?.(promptText);
      cmdInput.disabled = false;
      cmdInput.value = defaultValue || '';
      cmdInput.focus();
      if (defaultValue) cmdInput.select();

      const handleKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const rawValue = cmdInput.value;
        const action = event.key === 'Escape' ? 'escape' : 'enter';
        const handled = handler(rawValue, action);

        if (handled && handled.done) {
          finishSession(resolve, handled.value);
        } else if (handled && handled.clearInput) {
          cmdInput.value = '';
        }
      };

      activeCleanup = () => {
        cmdInput.removeEventListener('keydown', handleKeyDown, true);
      };
      cmdInput.addEventListener('keydown', handleKeyDown, true);
    });
  }

  /**
   * Shows a confirmation dialog (Yes/No).
   */
  function showConfirm(message, options = {}) {
    const { defaultYes = false } = options;
    const defaultLabel = defaultYes ? 'Y' : 'N';
    return readBottomPrompt(message, `${UI_TEXT.YES}/N [${defaultLabel}] >>`, '', (value, action) => {
      if (action === 'escape') return { done: true, value: false };

      const normalized = value.trim().toUpperCase();
      appendEcho(`${UI_TEXT.YES}/N [${defaultLabel}] >>`, value);
      if (!normalized) return { done: true, value: defaultYes };
      return { done: true, value: normalized === 'Y' || normalized === 'YES' };
    });
  }

  /**
   * Shows an alert dialog.
   */
  function showAlert(message) {
    return readBottomPrompt(message, `${UI_TEXT.CONFIRM}(Enter) >>`, '', () => {
      return { done: true, value: true };
    });
  }

  /**
   * Shows a prompt dialog for text input.
   */
  function showPrompt(message, defaultValue = '') {
    return readBottomPrompt(message, '입력 >>', defaultValue, (value, action) => {
      if (action === 'escape') return { done: true, value: null };
      appendEcho('입력 >>', value);
      return { done: true, value };
    });
  }

  /**
   * Shows a multi-line editor dialog.
   * [LOG: 20260429_0200] Evolution Mode 24: Added showEditor for VFS scripting.
   */
  function showEditor(message, defaultValue = '') {
    const lines = defaultValue ? defaultValue.split('\n') : [];
    if (defaultValue) {
      appendTranscript('--- 현재 내용 ---');
      defaultValue.split('\n').forEach((line) => appendTranscript(line || ' '));
      appendTranscript('--- 편집 시작 ---');
    }
    appendTranscript(`${message} (${UI_TEXT.SAVE}: /s, ${UI_TEXT.CANCEL}: /q)`);

    return readBottomPrompt('', 'EDIT >>', '', (value, action) => {
      if (action === 'escape') return { done: true, value: null };

      const trimmed = value.trim();
      appendEcho('EDIT >>', value);
      if (trimmed === '/s') return { done: true, value: lines.join('\n') };
      if (trimmed === '/q') return { done: true, value: null };

      lines.push(value);
      return { done: false, clearInput: true };
    });
  }

  return { showConfirm, showAlert, showPrompt, showEditor };
}
