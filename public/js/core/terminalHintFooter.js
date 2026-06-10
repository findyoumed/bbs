import { createTerminalHintLayout } from './terminalHintLayout.js';
import { createTerminalHintMarkup } from './terminalHintMarkup.js';

export function createTerminalHintFooter(deps) {
  const {
    hintEl,
    cmdPromptEl,
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    getOutputListener,
    esc
  } = deps;

  let hintTrimFrame = 0;
  let footerLoadPending = false;
  const DEFAULT_COMMAND_PROMPT = '선택 >> ';
  const terminalFooter = document.getElementById('terminal-footer');
  const promptRowEl = document.getElementById('terminal-prompt-row');
  const promptRowHome = promptRowEl?.parentElement || null;
  let promptRowPlaceholder = null;
  const { resetHintExpansion, toggleHintExpansion, trimHintEntriesToFit } = createTerminalHintLayout({
    hintEl
  });
  const { renderHintMarkup } = createTerminalHintMarkup({
    state,
    esc
  });

  function scheduleHintTrim(attempt = 0) {
    if (!hintEl || typeof window === 'undefined') {
      return;
    }

    if (hintTrimFrame && attempt === 0) {
      window.cancelAnimationFrame(hintTrimFrame);
    }

    hintTrimFrame = window.requestAnimationFrame(() => {
      hintTrimFrame = 0;
      trimHintEntriesToFit();

      if (
        attempt < 2
        && hintEl.classList.contains('has-cmd-tokens')
        && hintEl.clientWidth <= 0
        && terminalFooter?.dataset.footerState !== 'hidden'
      ) {
        scheduleHintTrim(attempt + 1);
      }
    });
  }

  function setFooterVisibility(isVisible) {
    if (!terminalFooter) {
      return;
    }

    const visible = Boolean(isVisible);
    terminalFooter.dataset.footerState = visible ? 'visible' : 'hidden';
    terminalFooter.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!cmdInput) {
      return;
    }

    cmdInput.disabled = !visible;
    if (!visible && document.activeElement === cmdInput) {
      cmdInput.blur();
      return;
    }

    if (visible) {
      scheduleHintTrim();
    }
  }

  function syncScreenContext() {
    const screenName = String(state.screen || '').trim();
    if (typeof document === 'undefined') {
      return;
    }

    // [LOG: 20260507_1757] Keep /myinfo edit prompts in the footer so the active input stays at the bottom.
    restorePromptRow();

    if (document.body) {
      if (screenName) {
        document.body.dataset.screen = screenName;
      } else {
        delete document.body.dataset.screen;
      }
    }

    const container = document.getElementById('terminal-container');
    if (container) {
      if (screenName) {
        container.dataset.screen = screenName;
      } else {
        delete container.dataset.screen;
      }
    }
  }

  function ensurePromptRowPlaceholder() {
    if (!promptRowEl || !promptRowHome || promptRowPlaceholder) {
      return;
    }

    promptRowPlaceholder = document.createComment('terminal-prompt-row-home');
    promptRowHome.insertBefore(promptRowPlaceholder, promptRowEl);
  }

  function mountPromptRow(targetEl) {
    if (!promptRowEl || !targetEl) {
      return;
    }

    ensurePromptRowPlaceholder();
    targetEl.appendChild(promptRowEl);
    promptRowEl.classList.add('terminal-prompt-row--inline');
    terminalFooter?.classList.add('terminal-footer--prompt-detached');

    if (cmdInput) {
      cmdInput.disabled = false;
      window.setTimeout(() => {
        if (document.activeElement !== cmdInput) {
          cmdInput.focus();
        }
      }, 0);
    }
  }

  function restorePromptRow() {
    if (!promptRowEl || !promptRowHome) {
      return;
    }

    if (promptRowEl.parentElement !== promptRowHome) {
      if (promptRowPlaceholder?.parentNode === promptRowHome) {
        promptRowHome.insertBefore(promptRowEl, promptRowPlaceholder);
      } else {
        promptRowHome.appendChild(promptRowEl);
      }
    }

    promptRowEl.classList.remove('terminal-prompt-row--inline');
    terminalFooter?.classList.remove('terminal-footer--prompt-detached');

    if (cmdInput && !cmdInput.disabled) {
      window.setTimeout(() => {
        if (document.activeElement !== cmdInput) {
          cmdInput.focus();
        }
      }, 0);
    }
  }

  function setHint(text) {
    syncScreenContext();

    const outputListener = typeof getOutputListener === 'function' ? getOutputListener() : null;
    if (outputListener) {
      outputListener(text);
    }

    if (hintEl) {
      resetHintExpansion();
      const markup = renderHintMarkup(text);
      hintEl.innerHTML = markup;
      hintEl.classList.toggle('has-cmd-tokens', markup.includes('cmd-token'));
      trimHintEntriesToFit();
      scheduleHintTrim();

      if (text && terminalFooter?.dataset.footerState === 'hidden' && !footerLoadPending) {
        setFooterVisibility(true);
      }
    }

    if (!text && screenEl) {
      const myInfoMode = String(state._myInfoMode || '').trim().toLowerCase();
      const isMyInfoPassword = String(state.screen || '').trim() === 'myinfo'
        && ['email', 'password', 'delete'].includes(myInfoMode);

      if (isMyInfoPassword) {
        screenEl.parentElement?.classList.remove('is-loading');
        screenEl.classList.remove('is-loading');
      } else {
        screenEl.parentElement?.classList.add('is-loading');
        screenEl.classList.add('is-loading');
      }
    }
  }

  function setPrompt(text) {
    const promptText = (text === undefined || text === null || text === '>>')
      ? (state.envVars?.PROMPT || DEFAULT_COMMAND_PROMPT)
      : String(text);

    if (cmdInput) {
      const useMaskedInput = Boolean(state._maskCommandInput);
      // [LOG: 20260507_1738] Use a real password field as a fallback if no-echo CSS is stale.
      cmdInput.type = useMaskedInput ? 'password' : 'text';
      cmdInput.dataset.masked = useMaskedInput ? 'true' : 'false';
      cmdInput.autocomplete = useMaskedInput ? 'off' : 'on';
      cmdInput.spellcheck = false;
      if (typeof CustomEvent === 'function') {
        cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
      }
    }

    if (cmdPromptEl) {
      // [LOG: 20260610_2025] CSS gap을 제거하고 white-space: pre를 적용했으므로 
      // 일반 공백(' ')을 사용하여 터미널의 정직한 1칸 간격을 구현함.
      const trimmed = promptText.trimEnd();
      cmdPromptEl.textContent = trimmed ? (trimmed + ' ') : '';
    }
  }

  async function applyCommandFooter(assetPath, fallbackText = '', fallbackAssetPath = '') {
    syncScreenContext();
    footerLoadPending = true;
    setFooterVisibility(false);
    if (screenEl?.parentElement) {
      screenEl.parentElement.classList.add('is-loading');
    }

    try {
      const supportedHint = getSupportedFooterText(state);
      if (supportedHint) {
        const parsedSupported = parseCommandFooter(supportedHint, supportedHint);
        setHint(parsedSupported.hint);
        setPrompt(parsedSupported.prompt);
      }

      let rawText = '';
      try {
        rawText = assetPath ? await loadAssetText(assetPath) : '';
      } catch (error) {
        console.warn(`[Terminal] Failed to load footer asset: ${assetPath}`, error);
      }

      if (!looksLikeCommandFooter(rawText) && fallbackAssetPath) {
        try {
          rawText = await loadAssetText(fallbackAssetPath);
        } catch (error) {
          console.warn(`[Terminal] Failed to load fallback footer asset: ${fallbackAssetPath}`, error);
        }
      }

      const parsed = parseCommandFooter(rawText, supportedHint || fallbackText);
      const supportedParsed = supportedHint ? parseCommandFooter(supportedHint, supportedHint) : null;
      setHint(supportedParsed?.hint || parsed.hint);
      setPrompt(supportedParsed?.prompt || parsed.prompt);
    } catch (error) {
      console.error('[Terminal] Error applying command footer:', error);
      setHint(fallbackText);
      setPrompt(DEFAULT_COMMAND_PROMPT);
    } finally {
      if (screenEl?.parentElement) {
        screenEl.parentElement.classList.remove('is-loading');
      }
      setFooterVisibility(true);
      footerLoadPending = false;
    }
  }

  return {
    applyCommandFooter,
    mountPromptRow,
    restorePromptRow,
    scheduleHintTrim,
    setFooterVisibility,
    setHint,
    setPrompt,
    syncScreenContext,
    toggleHintExpansion,
    trimHintEntriesToFit
  };
}
