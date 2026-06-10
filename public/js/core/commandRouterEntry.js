export function createEntryCommandHandler(deps) {
  const {
    state,
    showMain,
    handleLoginSubmit,
    handlePasswordResetSubmit,
    handlePasswordResetCancel,
    handleWriteSubmit,
    cancelPostWrite,
  } = deps;

  function isBackCommand(cmd) {
    return cmd === 'P' || cmd === 'M' || cmd === 'B';
  }

  return async function handleEntryCommand({ s, cmd, context }) {
    if (s === 'signup') {
      // [LOG: 20260610_1601] 회원가입 화면에서 상위(P) 또는 초기화면(T) 클릭 시 메인으로 이동 및 상태 초기화
      if (cmd === 'T' || isBackCommand(cmd)) {
        state._oauthSignupError = '';
        state._signupAgreementAccepted = false;
        state._signupPendingMethod = '';
        state._signupDraft = null;
        state._signupEnterHandler = null;
        state._signupFlow = '';

        try {
          window.localStorage.removeItem('01410-oauth-pending-profile');
        } catch (e) {}
        try {
          window.sessionStorage.removeItem('01410-signup-agreed');
        } catch (e) {}
        try {
          window.sessionStorage.removeItem('01410-signup-pending-method');
        } catch (e) {}

        const promptRowEl = document.getElementById('terminal-prompt-row');
        if (promptRowEl) {
          promptRowEl.style.display = '';
        }

        if (typeof showMain === 'function') {
          await showMain();
          return true;
        }
      }
      return true;
    }

    if (s === 'login') {
      if (cmd === 'LOGIN') {
        await handleLoginSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        await showMain();
        return true;
      }
      return true;
    }

    if (s === 'password-reset') {
      if (cmd === 'SEND' || cmd === 'CHANGE') {
        await handlePasswordResetSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        await handlePasswordResetCancel();
        return true;
      }
      return true;
    }

    if (s === 'post-write') {
      if (cmd === 'S' || cmd === 'SAVE') {
        await handleWriteSubmit();
        return true;
      }
      if (isBackCommand(cmd)) {
        cancelPostWrite();
        return true;
      }
      return true;
    }

    return false;
  };
}
