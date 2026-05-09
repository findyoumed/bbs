export function createSignupAgreementHandler(deps) {
  const {
    SIGNUP_AGREE_FOOTER_HINT,
    SIGNUP_METHOD_LOOKUP,
    cleanupSignupHandlers,
    cmdInput,
    doSignup,
    renderEmailScreen,
    renderOAuthProfileScreen,
    screenEl,
    setSignupAgreementAccepted,
    setPendingSignupMethod,
    setPendingSignupDraft,
    showMain,
    showSignupMenu,
    startSignupOAuth,
    state,
    updateURL
  } = deps;

  function attachAgreementEvents(handlers) {
    const { attachSignupMenuEvents, attachEmailEvents } = handlers;
    const agreeScreenEl = screenEl.querySelector('.entry-signup-agreement');
    const agreeHintEl = document.getElementById('signup-agree-hint');
    const promptRowEl = document.getElementById('terminal-prompt-row');

    cleanupSignupHandlers();
    state._signupFlow = 'agree';
    if (promptRowEl) promptRowEl.style.display = 'none';

    if (agreeScreenEl) {
      agreeScreenEl.addEventListener('click', () => document.getElementById('signup-agree-input')?.focus());
    }

    const runSignupChoice = (rawChoice) => {
      const choice = String(rawChoice !== undefined ? rawChoice : '').trim().toLowerCase();
      if (choice === 'y' || choice === '') {
        handleAgreeYes(handlers);
      } else if (choice === 'n' || choice === 'x') {
        handleAgreeNo();
      } else {
        if (agreeHintEl) agreeHintEl.textContent = '동의확인은 y 또는 n만 입력할 수 있습니다.';
        const inp = document.getElementById('signup-agree-input');
        if (inp) {
          inp.value = '';
          inp.focus();
        }
      }
    };

    state._signupEnterHandler = (raw) => {
      if (state.screen !== 'signup' || state._signupFlow !== 'agree') return false;
      cmdInput.value = ''; runSignupChoice(raw); return true;
    };
    setSignupAgreeFooterHint(runSignupChoice); // [LOG: 20260415_1530] runSignupChoice 정의 이후 호출
    document.getElementById('signup-agree-input')?.focus();
  }

  async function handleAgreeYes(handlers) {
    const { attachSignupMenuEvents, attachEmailEvents } = handlers;
    const method = SIGNUP_METHOD_LOOKUP[deps.getPendingSignupMethod()];
    const draft = deps.getPendingSignupDraft();
    const promptRowEl = document.getElementById('terminal-prompt-row');

    setSignupAgreementAccepted(true);
    if (!method) {
      resetAndGoMenu(handlers); return;
    }

    if (method.type === 'email') {
      if (!draft) {
        setSignupAgreementAccepted(false); state._signupFlow = 'email'; void updateURL(true);
        renderEmailScreen({ error: '가입 정보를 다시 입력하여 주십시오.' }); attachEmailEvents();
        return;
      }
      cleanupSignupHandlers();
      if (typeof deps.setHint === 'function') {
        deps.setHint('가입 신청 내용을 확인하고 있습니다. 잠시만 기다려 주십시오.');
      }
      try {
        await doSignup(draft.userId, draft.nickName, draft.email, draft.password);
        setSignupAgreementAccepted(false); setPendingSignupMethod(''); setPendingSignupDraft(null);
        cleanupSignupHandlers(); if (promptRowEl) promptRowEl.style.display = '';
        state._signupFlow = '';
        showMain();
      } catch (err) {
        setSignupAgreementAccepted(false); state._signupFlow = 'email'; void updateURL(true);
        renderEmailScreen({ error: err.message, values: draft });
        attachEmailEvents(err.fieldId || 'signup-userid');
      }
    } else {
      await handleOAuth(method, handlers);
    }
  }

  function handleAgreeNo() {
    const promptRowEl = document.getElementById('terminal-prompt-row');
    setSignupAgreementAccepted(false); setPendingSignupMethod(''); setPendingSignupDraft(null);
    cleanupSignupHandlers(); if (promptRowEl) promptRowEl.style.display = '';
    showMain();
  }

  // [LOG: 20260414_1000] OAuth 가입 시 아이디/닉네임 폼으로 전환
  function handleOAuth(method, handlers) {
    cleanupSignupHandlers();
    state._signupFlow = 'oauth-profile';
    void updateURL(true);
    renderOAuthProfileScreen({ provider: method.provider, label: method.label });
    handlers.attachOAuthProfileEvents({ provider: method.provider, label: method.label });
  }

  function resetAndGoMenu(handlers) {
    setSignupAgreementAccepted(false); setPendingSignupMethod(''); setPendingSignupDraft(null);
    cleanupSignupHandlers(); state._signupFlow = 'menu'; void updateURL(true);
    const promptRowEl = document.getElementById('terminal-prompt-row');
    if (promptRowEl) promptRowEl.style.display = '';
    showSignupMenu({ error: '가입 방식을 먼저 선택하여 주십시오.' }); handlers.attachSignupMenuEvents();
  }

  function setSignupAgreeFooterHint(runChoice) { if (deps.setSignupAgreeFooterHint) deps.setSignupAgreeFooterHint(runChoice); }

  return { attachAgreementEvents };
}
