/**
 * commandPalette.js
 * [LOG: 20260427_1000] Command Palette (Evolution Mode): Advanced command search and navigation.
 * [LOG: 20260427_1105] Evolve: Categorized view, fuzzy ranking, and highlighting.
 * [LOG: 20260429_1010] Evolution Mode 20/500: Added History Search Mode.
 */
import { esc } from './uiUtils.js';

export function createCommandPalette(deps) {
  const { terminalUiCore, soundService } = deps;

  function appendTranscript(message) {
    const screenEl = document.getElementById('terminal-container');
    if (!screenEl) return false;

    const line = document.createElement('div');
    line.className = 'ansi-line command-palette-inline-help';
    line.innerHTML = esc(message);
    screenEl.appendChild(line);
    line.scrollIntoView({ behavior: 'auto', block: 'end' });
    return true;
  }

  function focusCommandInput() {
    const cmdInput = document.getElementById('cmd-input');
    if (!cmdInput) return;

    cmdInput.disabled = false;
    cmdInput.focus();
  }

  // [LOG: 20260509_1115] Central palette overlay is replaced by inline help/no-op behavior.
  function open(mode = 'command') {
    const message = mode === 'history'
      ? '최근 명령은 ↑/↓ 키로 탐색할 수 있습니다.'
      : '명령어는 하단 입력줄에 직접 입력해 주세요. 도움말은 HELP 또는 ? 를 입력하세요.';

    soundService?.playTransition?.();
    if (typeof terminalUiCore?.setHint === 'function') {
      terminalUiCore.setHint(message);
    } else {
      appendTranscript(message);
    }
    focusCommandInput();
  }

  function close() {
    focusCommandInput();
  }

  return { open, close };
}
