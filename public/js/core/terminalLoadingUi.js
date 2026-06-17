import { esc } from './uiUtils.js';

// [LOG: 20260617_1005] Loading markup helpers split from terminalUiCore.js.
export function buildLoadingScreenMarkup(message) {
  return message ? `<div class="loading"><span class="bbs-loading-text">${esc(message)}</span></div>` : '';
}

export function normalizeLoadingMessage(message) {
  return String(message || '연결하는 중입니다')
    .trim()
    .replace(/[.]+$/u, '');
}
