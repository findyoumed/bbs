export function createSignupMenuHandler(deps) {
  const {
    SIGNUP_METHOD_LOOKUP,
    cleanupSignupHandlers,
    cmdInput,
    getCommandFooterText,
    clearPendingOAuthProfile,
    renderEmailScreen,
    setSignupAgreementAccepted,
    setPendingSignupMethod,
    setPendingSignupDraft,
    showMain,
    showSignupAgreement,
    showSignupMenu,
    state,
    updateURL
  } = deps;

  function shouldAutoFocusCommandInput() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function attachSignupMenuEvents(handlers) {
    const { attachAgreementEvents, attachEmailEvents } = handlers;
    const promptRowEl = document.getElementById('terminal-prompt-row');
    document.querySelectorAll('[data-signup-method]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        void handleSignupMethodChoice(btn.dataset.signupMethod || '', handlers);
      });
    });

    if (promptRowEl) promptRowEl.style.display = '';
    setHint(getCommandFooterText('authMenu').split('\n')[0]);
    setPrompt('>>');
    cleanupSignupHandlers();
    state._signupEnterHandler = (raw) => {
      if (state.screen !== 'signup' || state._signupFlow !== 'menu') return false;
      cmdInput.value = '';
      void handleSignupMethodChoice(raw, handlers);
      return true;
    };
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function handleSignupMethodChoice(rawChoice, handlers) {
    const { attachAgreementEvents, attachEmailEvents } = handlers;
    const choice = String(rawChoice || '').trim().toLowerCase();
    const promptRowEl = document.getElementById('terminal-prompt-row');
    if (!choice) { showSignupMenu({ error: '잘못된 명령입니다.' }); attachSignupMenuEvents(handlers); return; }
    if (choice === 'x') {
      state._oauthSignupError = '';
      clearPendingOAuthProfile();
      setSignupAgreementAccepted(false); setPendingSignupMethod(''); setPendingSignupDraft(null);
      cleanupSignupHandlers(); if (promptRowEl) promptRowEl.style.display = '';
      showMain(); return;
    }

    const method = SIGNUP_METHOD_LOOKUP[choice];
    if (!method) { showSignupMenu({ error: '잘못된 명령입니다.' }); attachSignupMenuEvents(handlers); return; }

    state._oauthSignupError = '';
    clearPendingOAuthProfile();
    setSignupAgreementAccepted(false);
    setPendingSignupMethod(method.key);
    setPendingSignupDraft(null);
    cleanupSignupHandlers();

    if (method.type === 'email') {
      state._signupFlow = 'email'; void updateURL();
      renderEmailScreen(); attachEmailEvents();
    } else {
      state._signupFlow = 'agree'; void updateURL();
      showSignupAgreement(); attachAgreementEvents();
    }
  }

  function setHint(text) { if (deps.setHint) deps.setHint(text); }
  function setPrompt(text) { if (deps.setPrompt) deps.setPrompt(text); }

  return { attachSignupMenuEvents };
}
