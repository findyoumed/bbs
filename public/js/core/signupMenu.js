import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createSignupMenuHandler(deps) {
  // [LOG: 20260610_1548] 중복 선언 방지를 위해 setHint, setPrompt 구조 분해 할당 제거
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
    // [LOG: 20260610_1521] 잘못된 명령 에러 표시 제거
    if (!choice) { showSignupMenu(); attachSignupMenuEvents(handlers); return; }
    // [LOG: 20260610_1532] P, T, M 입력 시 메인 화면으로 돌아가도록 수정
    if (choice === 'x' || choice === 'p' || choice === 't' || choice === 'm') {
      state._oauthSignupError = '';
      clearPendingOAuthProfile();
      setSignupAgreementAccepted(false); setPendingSignupMethod(''); setPendingSignupDraft(null);
      cleanupSignupHandlers(); if (promptRowEl) promptRowEl.style.display = '';
      showMain(); return;
    }

    const method = SIGNUP_METHOD_LOOKUP[choice];
    // [LOG: 20260610_1521] 잘못된 명령 에러 표시 제거
    if (!method) { showSignupMenu(); attachSignupMenuEvents(handlers); return; }

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
