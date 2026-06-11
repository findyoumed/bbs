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
  let selectedSuggestionIndex = -1;
  let cursorStateObserver = null;
  // [LOG: 20260610_1145] Enable custom blinking terminal block cursor
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

  // [LOG: 20260610_1145] Update cursor position in exact character width units (ch)
  function updateCursorPosition() {
    if (!cmdInput || !cursorEl) {
      return;
    }

    const textBeforeCaret = cmdInput.value.substring(0, cmdInput.selectionStart || 0);
    const chCount = displayWidth(textBeforeCaret);
    cursorEl.style.left = `${chCount}ch`;
  }

  function getTerminalContainer() {
    return document.getElementById('terminal-container');
  }

  function shouldShowCursor() {
    const container = getTerminalContainer();
    const hasLoadingScreen = Boolean(screenEl?.querySelector('.loading'));

    return Boolean(
      cmdInput
      && cursorEl
      && useCustomCursor
      && document.activeElement === cmdInput
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

    const visible = shouldShowCursor();
    cursorEl.style.setProperty('display', visible ? 'inline-block' : 'none', visible ? 'important' : '');

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
    cmdInput.addEventListener('click', syncCursorVisibility);
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
    cmdInput.addEventListener('bbs:mask-state-change', syncMaskedInputDisplay);

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

    // [LOG: 20260611_1145] Re-sync cursor layout on any font loading done event to handle SPA font changes robustly.
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', () => {
        syncMaskedInputDisplay();
        syncCursorVisibility();
      });
    }
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
