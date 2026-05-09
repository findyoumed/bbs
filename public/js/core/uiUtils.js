/**
 * uiUtils.js - Shared UI utilities
 * [LOG: 20260426_0505] Evolve Mode: Added debounce and visual feedback helpers.
 */
'use strict';

/**
 * Escapes HTML special characters.
 * @param {string} str 
 * @returns {string}
 */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Checks if the device is likely a mobile device with a touch screen.
 * @returns {boolean}
 */
export function isMobileDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}

/**
 * Throttles a function call.
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

/**
 * Debounces a function call.
 */
export function debounce(func, delay) {
  let timeoutId;
  return function() {
    const args = arguments;
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  }
}

/**
 * Triggers a visual feedback animation on an element.
 * @param {HTMLElement} el 
 * @param {string} type 'shake' | 'error' | 'flash-terminal'
 */
export function triggerVisualFeedback(el, type = 'error') {
  if (!el) return;
  
  if (type === 'shake') {
    el.classList.remove('is-shaking');
    void el.offsetWidth; // force reflow
    el.classList.add('is-shaking');
    setTimeout(() => el.classList.remove('is-shaking'), 400);
  } else if (type === 'error') {
    el.classList.add('is-flashing-error');
    setTimeout(() => el.classList.remove('is-flashing-error'), 200);
  } else if (type === 'flash-terminal') {
    const wrapper = document.getElementById('terminal-wrapper');
    if (wrapper) {
      wrapper.classList.remove('terminal-flash');
      void wrapper.offsetWidth;
      wrapper.classList.add('terminal-flash');
      setTimeout(() => wrapper.classList.remove('terminal-flash'), 150);
    }
  }
}



/**
 * Applies or removes scanline and shimmer effects.
 */
/**
 * [LOG: 20260426_1340] CRT 레트로 효과 제거 (사용자 요청)
 * - 스캔라인, 쉬머 등의 오버레이를 더 이상 적용하지 않음.
 */
export function applyTerminalEffects(container, active = true) {
  // 효과 제거됨
}

/**
 * [LOG: 20260426_1155] Levenshtein distance for intelligent command suggestions. (UX Evolution)
 */
export function getLevenshteinDistance(s1, s2) {
  if (!s1 || !s2) return Math.max(s1?.length || 0, s2?.length || 0);
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return track[s2.length][s1.length];
}

/**
 * Highlights text for HTML output.
 * [LOG: 20260427_1100] Evolution Mode: Added for Command Palette highlighting.
 */
export function highlightHTML(text, term) {
  const source = String(text || '');
  const search = String(term || '').trim();
  if (!search || !source) return esc(source);

  try {
    const escapedTerm = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = source.split(new RegExp(`(${escapedTerm})`, 'gi'));
    return parts.map(part => {
      if (part.toLowerCase() === search.toLowerCase()) {
        return `<span class="palette-highlight">${esc(part)}</span>`;
      }
      return esc(part);
    }).join('');
  } catch (e) {
    return esc(source);
  }
}
