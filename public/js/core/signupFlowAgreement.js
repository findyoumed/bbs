export function createSignupFlowAgreementHandler(deps) {
  const {
    SIGNUP_AGREE_HINT,
    SIGNUP_METHOD_LOOKUP,
    cleanupSignupHandlers,
    cmdInput,
    doSignup,
    getPendingSignupDraft,
    getPendingSignupMethod,
    promptRowEl,
    refs,
    renderEmailScreen,
    setHint,
    setPendingSignupDraft,
    setPendingSignupMethod,
    setSignupAgreeFooterHint,
    setSignupAgreementAccepted,
    setSignupFooterHint,
    showMain,
    showSignupMenu,
    startSignupOAuth,
    state,
    updateURL,
    attachEmailEvents,
    attachSignupMenuEvents
  } = deps;

  return function attachAgreementEvents() {
    const agreeScreenEl = document.querySelector('.entry-signup-agreement');
    const pendingMethodKey = getPendingSignupMethod();
    const pendingMethod = SIGNUP_METHOD_LOOKUP[pendingMethodKey];
    const draft = getPendingSignupDraft();

    cleanupSignupHandlers();
    state._signupFlow = 'agree';
    if (promptRowEl) {
      promptRowEl.style.display = 'none';
    }
    setSignupAgreeFooterHint();

    if (agreeScreenEl) {
      agreeScreenEl.addEventListener('click', (event) => {
        event.stopPropagation();
        document.getElementById('signup-agree-input')?.focus();
      });
    }

    refs.runSignupChoice = (rawChoice) => {
      let choice = String(rawChoice || '').trim().toLowerCase() || 'y';
      if (!choice) {
        setHint(SIGNUP_AGREE_HINT);
        document.getElementById('signup-agree-input')?.focus();
        return;
      }

      if (choice === 'y') {
        setSignupAgreementAccepted(true);

        if (!pendingMethod) {
          setSignupAgreementAccepted(false);
          setPendingSignupMethod('');
          setPendingSignupDraft(null);
          cleanupSignupHandlers();
          state._signupFlow = 'menu';
          void updateURL(true);
          if (promptRowEl) {
            promptRowEl.style.display = '';
          }
          showSignupMenu({ error: '가입 방식을 선택하여 주십시오.' });
          attachSignupMenuEvents();
          return;
        }

        if (pendingMethod.type === 'email') {
          if (!draft) {
            setSignupAgreementAccepted(false);
            cleanupSignupHandlers();
            state._signupFlow = 'email';
            void updateURL(true);
            renderEmailScreen({ error: '가입 정보를 다시 입력하여 주십시오.' });
            attachEmailEvents();
            return;
          }

          cleanupSignupHandlers();
          state._signupFlow = 'agree';
          if (promptRowEl) {
            promptRowEl.style.display = 'none';
          }
          renderEmailScreen({ values: draft });
          setSignupFooterHint();
          setHint('가입 신청 내용을 확인하고 있습니다. 잠시만 기다려 주십시오.');

          void (async () => {
            try {
              await doSignup(draft.userId, draft.nickName, draft.email, draft.password);
              setSignupAgreementAccepted(false);
              setPendingSignupMethod('');
              setPendingSignupDraft(null);
              cleanupSignupHandlers();
              if (promptRowEl) {
                promptRowEl.style.display = '';
              }
              showMain();
            } catch (error) {
              setSignupAgreementAccepted(false);
              state._signupFlow = 'email';
              void updateURL(true);
              renderEmailScreen({
                error: error.message,
                values: draft
              });
              attachEmailEvents('signup-userid');
            }
          })();
          return;
        }

        showSignupMenu();
        if (promptRowEl) {
          promptRowEl.style.display = 'none';
        }
        setHint(`${pendingMethod.label} 인증 페이지로 이동합니다.`);
        cleanupSignupHandlers();
        void (async () => {
          try {
            await startSignupOAuth(pendingMethod.provider);
          } catch (error) {
            setSignupAgreementAccepted(false);
            setPendingSignupMethod('');
            setPendingSignupDraft(null);
            state._signupFlow = 'menu';
            showSignupMenu({ error: error.message });
            attachSignupMenuEvents();
          }
        })();
        return;
      }

      if (choice === 'n' || choice === 'x' || choice === 'm' || choice === 'p' || choice === 't') {
        setSignupAgreementAccepted(false);
        setPendingSignupMethod('');
        setPendingSignupDraft(null);
        cleanupSignupHandlers();
        if (promptRowEl) {
          promptRowEl.style.display = '';
        }
        cmdInput.value = '';
        void showMain();
        return;
      }

      setHint('동의확인은 y 또는 n만 입력할 수 있습니다.');
      document.getElementById('signup-agree-input')?.focus();
    };

    state._signupEnterHandler = function handleSignupAgreeInput(raw) {
      if (state.screen !== 'signup' || state._signupFlow !== 'agree') {
        return false;
      }

      const value = String(raw || '').trim();
      cmdInput.value = '';
      if (refs.runSignupChoice) {
        refs.runSignupChoice(value);
      }
      return true;
    };

    document.getElementById('signup-agree-input')?.focus();
    setHint(SIGNUP_AGREE_HINT);
  };
}
