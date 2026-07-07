import { UI_TEXT } from './i18n.js';
import { CMD_META } from './commandService.js';
import { esc } from './uiUtils.js';
import { displayWidth } from './ansiRenderUtils.js';

export function createTerminalInputUi(deps) {
  const {
    cmdInput,
    screenEl,
    state,
    setScale,
    isManualScale,
    syncVisualViewportMetrics
  } = deps;

  let ghostTextEl = null;
  let maskTextEl = null;
  let cursorMeasureContext = null;
  let selectedSuggestionIndex = -1;
  let cursorStateObserver = null;
  let fontCursorSyncRegistered = false;
  // [LOG_ID: 20260623_1330] Normal input uses the PC-communication block cursor.
  // Loading and command-pending states keep their own dot/underscore indicators.
  const useCustomCursor = true;
  // [LOG: 20260506_1315] Command suggestion UI disabled due to frequent misfires.
  // const suggestionBoxEl = document.getElementById('cmd-suggestion-box');
  const suggestionBoxEl = null;

  const cursorEl = (() => {
    const el = document.createElement('span');
    el.className = 'terminal-cursor';
    return el;
  })();

  const cmdTooltipEl = (() => {
    let el = document.getElementById('cmd-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cmd-tooltip';
      document.body.appendChild(el);
    }
    return el;
  })();

  function initTooltips() {
    const updateTooltipPos = (event) => {
      cmdTooltipEl.style.left = `${event.clientX + 10}px`;
      cmdTooltipEl.style.top = `${event.clientY - 24}px`;
    };

    document.addEventListener('mouseover', (event) => {
      const token = event.target.closest?.('.cmd-token');
      if (!token) {
        cmdTooltipEl.style.display = 'none';
        return;
      }
      cmdTooltipEl.textContent = token.dataset.tip || '';
      cmdTooltipEl.style.display = 'block';
      updateTooltipPos(event);
    });

    document.addEventListener('mousemove', (event) => {
      if (cmdTooltipEl.style.display === 'none') {
        return;
      }
      updateTooltipPos(event);
    });

    document.addEventListener('mouseout', (event) => {
      if (event.target.closest?.('.cmd-token')) {
        cmdTooltipEl.style.display = 'none';
      }
    });
  }

  // [LOG_ID: 20260623_1345] The terminal input and password-star overlay use fixed cells.
  // Position the block cursor in the same cell unit, not canvas glyph pixels.
  function updateCursorPosition() {
    if (!cmdInput || !cursorEl) {
      return;
    }

    const textBeforeCaret = cmdInput.value.substring(0, cmdInput.selectionStart || 0);
    cursorEl.style.left = `${displayWidth(textBeforeCaret)}ch`;
  }

  function getCursorMeasureContext() {
    if (cursorMeasureContext) {
      return cursorMeasureContext;
    }

    const canvas = document.createElement('canvas');
    cursorMeasureContext = canvas.getContext('2d');
    return cursorMeasureContext;
  }

  function measureInputTextWidth(text) {
    const normalizedText = String(text || '');
    if (!normalizedText) {
      return 0;
    }

    const measureContext = getCursorMeasureContext();
    if (!cmdInput || !measureContext) {
      return displayWidth(text);
    }

    const inputStyle = window.getComputedStyle(cmdInput);
    measureContext.font = inputStyle.font;

    const baseWidth = measureContext.measureText(normalizedText).width;
    const letterSpacing = Number.parseFloat(inputStyle.letterSpacing);
    if (!Number.isFinite(letterSpacing) || letterSpacing === 0) {
      return baseWidth;
    }

    return baseWidth + (Math.max(0, Array.from(normalizedText).length - 1) * letterSpacing);
  }

  // [LOG: 20260611_1413] Re-run cursor sync after web fonts and layout frames settle.
  function scheduleCursorLayoutSync() {
    syncMaskedInputDisplay();
    syncCursorVisibility();

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();

      window.setTimeout(() => {
        syncMaskedInputDisplay();
        syncCursorVisibility();
      }, 50);
    });
  }

  // [LOG: 20260611_1413] document.fonts.ready covers the initial font-load race that can skew cursor width.
  function registerFontCursorSync() {
    if (fontCursorSyncRegistered || typeof document === 'undefined' || !document.fonts) {
      return;
    }

    fontCursorSyncRegistered = true;

    document.fonts.ready
      .then(scheduleCursorLayoutSync)
      .catch(() => {});

    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', scheduleCursorLayoutSync);
    }
  }

  function getTerminalContainer() {
    return document.getElementById('terminal-container');
  }

  function shouldRenderCursor() {
    const container = getTerminalContainer();
    const hasLoadingScreen = Boolean(screenEl?.querySelector('.loading'));

    return Boolean(
      cmdInput
      && cursorEl
      && useCustomCursor
      && !cmdInput.disabled
      && !hasLoadingScreen
      && !container?.classList.contains('is-loading')
      && !container?.classList.contains('is-busy')
      && !container?.classList.contains('is-data-busy')
    );
  }

  function syncCursorVisibility() {
    if (!cursorEl) {
      return;
    }

    const visible = shouldRenderCursor();
    const active = visible && document.activeElement === cmdInput;
    // [LOG: 20260707_1700] Keep the cursor cell reserved even when the input is not focused.
    // Hiding it with display:none made the prompt appear to gain/lose one terminal cell on click.
    cursorEl.style.setProperty('display', visible ? 'inline-block' : 'none');
    cursorEl.style.setProperty('opacity', active ? '1' : '0.35');
    cursorEl.style.setProperty('animation', visible && active ? '' : 'none');

    if (visible) {
      updateCursorPosition();
    }
  }

  function syncMaskedInputDisplay() {
    if (!cmdInput || !maskTextEl) {
      return;
    }

    const isMasked = cmdInput.dataset.masked === 'true';
    const maskLength = isMasked ? Array.from(cmdInput.value || '').length : 0;
    maskTextEl.textContent = maskLength > 0 ? '*'.repeat(maskLength) : '';
    maskTextEl.hidden = !isMasked || maskLength <= 0;
    maskTextEl.parentElement?.classList.toggle('has-masked-input', isMasked);
  }

  function initBlinkingCursor() {
    if (!cmdInput) {
      return;
    }

    let wrapper = document.getElementById('cmd-input-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'cmd-input-wrapper';
      cmdInput.parentNode.insertBefore(wrapper, cmdInput);

      const ghost = document.createElement('div');
      ghost.id = 'cmd-ghost-text';
      wrapper.appendChild(ghost);
      ghostTextEl = ghost;

      // [LOG: 20260507_1757] Draw password masks ourselves so browser password glyph rendering cannot appear blank.
      const maskText = document.createElement('div');
      maskText.id = 'cmd-mask-text';
      maskText.setAttribute('aria-hidden', 'true');
      maskText.hidden = true;
      wrapper.appendChild(maskText);
      maskTextEl = maskText;

      wrapper.appendChild(cmdInput);
      wrapper.appendChild(cursorEl);
    } else if (!ghostTextEl) {
      ghostTextEl = document.getElementById('cmd-ghost-text');
    }
    if (!maskTextEl) {
      maskTextEl = document.getElementById('cmd-mask-text');
    }
    if (!maskTextEl) {
      const maskText = document.createElement('div');
      maskText.id = 'cmd-mask-text';
      maskText.setAttribute('aria-hidden', 'true');
      maskText.hidden = true;
      wrapper.insertBefore(maskText, cmdInput);
      maskTextEl = maskText;
    }

    cmdInput.addEventListener('input', () => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });
    cmdInput.addEventListener('beforeinput', () => window.requestAnimationFrame(syncCursorVisibility));
    cmdInput.addEventListener('click', syncCursorVisibility);
    cmdInput.addEventListener('keyup', syncCursorVisibility);
    cmdInput.addEventListener('mouseup', syncCursorVisibility);
    cmdInput.addEventListener('select', syncCursorVisibility);
    cmdInput.addEventListener('compositionupdate', syncCursorVisibility);
    cmdInput.addEventListener('compositionend', syncCursorVisibility);
    cmdInput.addEventListener('focus', () => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
      window.setTimeout(syncVisualViewportMetrics, 0);
    });
    cmdInput.addEventListener('blur', () => {
      syncCursorVisibility();
      window.setTimeout(syncVisualViewportMetrics, 120);
    });
    cmdInput.addEventListener('keydown', () => window.setTimeout(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    }, 0));
    cmdInput.addEventListener('bbs:mask-state-change', () => {
      // [LOG: 20260707_1735] 값 클리어/프롬프트 교체 시 커서 위치도 재계산한다.
      // 커서가 비포커스에도 항상 표시되도록 바뀐 뒤(20260707_1700), 명령 제출 직후 화면 전환에서
      // 이전 명령 길이만큼 오른쪽으로 밀린 커서 잔상이 남아 news/weather 간 캐럿 왼쪽 공백이
      // 다르게 보이던 문제(포커스를 줘야만 정상 복귀)의 원인이었다.
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === cmdInput) {
        syncCursorVisibility();
      }
    });

    cursorStateObserver?.disconnect();
    cursorStateObserver = new MutationObserver(() => {
      syncMaskedInputDisplay();
      syncCursorVisibility();
    });

    const container = getTerminalContainer();
    if (container) {
      cursorStateObserver.observe(container, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    if (screenEl) {
      // [LOG: 20260429_0955] Hide the prompt cursor while loading text is rendered on screen.
      cursorStateObserver.observe(screenEl, {
        childList: true,
        subtree: false
      });
    }

    cursorStateObserver.observe(cmdInput, {
      attributes: true,
      attributeFilter: ['data-masked', 'disabled', 'type']
    });

    syncMaskedInputDisplay();
    syncCursorVisibility();
    registerFontCursorSync();
  }

  function setSuggestions(matches, selectedIndex = -1) {
    /*
    [LOG: 20260506_1315] Command suggestion UI disabled.
    if (!suggestionBoxEl) {
      return;
    }

    selectedSuggestionIndex = selectedIndex;

    if (!matches || matches.length === 0) {
      suggestionBoxEl.classList.remove('has-suggestions');
      suggestionBoxEl.innerHTML = '';
      return;
    }

    if (matches.length === 1 && selectedIndex === -1) {
      const cmd = matches[0];
      const meta = CMD_META[cmd] || {};
      const label = meta.label || cmd;
      const tip = meta.tip || cmd;
      const desc = meta.desc || '';

      suggestionBoxEl.innerHTML = `
        <div class="suggestion-quick-hint">
          <span class="hint-label">${esc(label)}</span>
          <span class="hint-sep">|</span>
          <span class="hint-tip">${esc(tip)}</span>
          <span class="hint-desc">${esc(desc)}</span>
        </div>
      `;
      suggestionBoxEl.classList.add('has-suggestions');
      return;
    }

    const html = matches.map((cmd, index) => {
      const meta = CMD_META[cmd] || {};
      const label = meta.label || cmd;
      const isSelected = index === selectedSuggestionIndex;
      return `<span class="cmd-token cmd-clickable suggestion-token ${isSelected ? 'is-selected' : ''}" data-cmd="${cmd}" data-tip="${meta.tip || cmd}">${label}[${cmd}]</span>`;
    }).join(' ');

    suggestionBoxEl.innerHTML = `<span class="suggestion-label">${UI_TEXT.SEARCH}:</span> ${html}`;
    suggestionBoxEl.classList.add('has-suggestions');
    */
    void matches;
    void selectedIndex;
  }

  function setZoom(scale) {
    const clampedScale = Math.min(Math.max(0.5, scale), 3.0);
    const container = document.getElementById('terminal-container');
    if (container) {
      container.style.setProperty('--terminal-scale', clampedScale);
      state.terminalScale = clampedScale;
    }
  }

  function adjustZoom(delta) {
    const currentScale = state.terminalScale || 1.0;
    const nextScale = currentScale + delta;
    setZoom(nextScale);
    setScale(nextScale, true);
  }

  function setGhostText(text) {
    if (!ghostTextEl) {
      return;
    }
    ghostTextEl.textContent = text || '';
  }

  function autoAdjustZoom() {
    const cssScale = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--terminal-scale')) || 1.0;
    setZoom(cssScale);
    setScale(cssScale, false);
  }

  function initZoom() {
    if (isManualScale()) {
      if (state.terminalScale) {
        setZoom(state.terminalScale);
      }
    } else {
      autoAdjustZoom();
    }

    window.addEventListener('keydown', (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        adjustZoom(0.1);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        adjustZoom(-0.1);
      } else if (event.key === '0') {
        event.preventDefault();
        setScale(1.0, false);
        setZoom(1.0);
        autoAdjustZoom();
      }
    });
  }

  return {
    adjustZoom,
    autoAdjustZoom,
    initBlinkingCursor,
    initTooltips,
    initZoom,
    setGhostText,
    setSuggestions,
    setZoom,
    syncCursorVisibility,
    updateCursorPosition
  };
}
