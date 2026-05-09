import { submitSignupDraft } from './signupFlowSubmit.js';

export function createSignupFlowEmailHandler(deps) {
  const {
    SIGNUP_CONFIRM_HINT,
    SIGNUP_EDIT_FIELD_IDS,
    SIGNUP_HINTS,
    TYPO_MAP,
    cleanupSignupHandlers,
    cmdInput,
    promptRowEl,
    refs,
    renderEmailScreen,
    searchMember,
    setHint,
    setPendingSignupDraft,
    setPendingSignupMethod,
    setPrompt,
    setSignupAgreementAccepted,
    setSignupFooterHint,
    showSignupAgreement,
    showSignupMenu,
    state,
    updateURL,
    attachAgreementEvents,
    attachSignupMenuEvents
  } = deps;

  return function attachEmailEvents(focusFieldId = 'signup-userid') {
    const formEl = document.getElementById('signup-inline-form');
    const userIdInput = document.getElementById('signup-userid');
    const passwordInput = document.getElementById('signup-password');
    const passwordConfirmInput = document.getElementById('signup-password-confirm');
    const nickInput = document.getElementById('signup-nickname');
    const emailInput = document.getElementById('signup-email');

    if (!formEl || !userIdInput || !passwordInput || !passwordConfirmInput || !nickInput || !emailInput) {
      return;
    }

    cleanupSignupHandlers();
    const hintLineEl = document.getElementById('signup-field-hint');
    const fieldInputs = {
      'signup-userid': userIdInput,
      'signup-password': passwordInput,
      'signup-password-confirm': passwordConfirmInput,
      'signup-nickname': nickInput,
      'signup-email': emailInput
    };

    const focusField = (fieldId) => {
      const target = fieldInputs[fieldId] || userIdInput;
      target.focus();
      if (typeof target.select === 'function' && target.value) {
        target.select();
      }
      if (hintLineEl) {
        hintLineEl.textContent = SIGNUP_HINTS[target.id] || SIGNUP_HINTS['signup-userid'];
      }
    };

    refs.focusSignupEmailField = focusField;
    refs.focusSignupConfirmInput = () => {
      const confirmEl = document.getElementById('signup-confirm-input');
      if (!confirmEl) {
        return;
      }
      if (hintLineEl) {
        hintLineEl.textContent = SIGNUP_CONFIRM_HINT;
      }
      confirmEl.focus();
      if (typeof confirmEl.select === 'function' && confirmEl.value) {
        confirmEl.select();
      }
    };

    const returnToSignupMenu = () => {
      cleanupSignupHandlers();
      setSignupAgreementAccepted(false);
      setPendingSignupMethod('');
      setPendingSignupDraft(null);
      state._signupFlow = 'menu';
      void updateURL(true);
      if (promptRowEl) {
        promptRowEl.style.display = '';
      }
      showSignupMenu();
      attachSignupMenuEvents();
    };

    formEl.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    setPendingSignupMethod('1');
    focusField(focusFieldId);
    state._signupFlow = 'email';
    if (promptRowEl) {
      promptRowEl.style.display = 'none';
    }
    setSignupFooterHint();
    setPrompt('>>');

    [userIdInput, passwordInput, passwordConfirmInput, nickInput, emailInput].forEach((element) => {
      element.addEventListener('focus', () => {
        if (hintLineEl) {
          hintLineEl.textContent = SIGNUP_HINTS[element.id] || '';
        }
      });
    });

    const signupFieldOrder = [userIdInput, passwordInput, passwordConfirmInput, nickInput, emailInput];
    signupFieldOrder.forEach((input, index) => {
      input.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }
        if (event.key === 'Enter' || event.key === 'ArrowDown') {
          event.preventDefault();
          const nextInput = signupFieldOrder[index + 1];
          if (nextInput) {
            focusField(nextInput.id);
          } else if (typeof refs.focusSignupConfirmInput === 'function') {
            refs.focusSignupConfirmInput();
          }
          return;
        }
        if (event.key === 'ArrowUp' && index > 0) {
          event.preventDefault();
          focusField(signupFieldOrder[index - 1].id);
        }
      });
    });

    emailInput.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey && typeof refs.focusSignupConfirmInput === 'function') {
        event.preventDefault();
        refs.focusSignupConfirmInput();
      } else if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        focusField('signup-nickname');
      }
    });

    const submitSignup = async () => {
      const values = {
        userId: userIdInput.value.trim(),
        password: passwordInput.value,
        passwordConfirm: passwordConfirmInput.value,
        nickName: nickInput.value.trim(),
        email: emailInput.value.trim()
      };
      const result = await submitSignupDraft({
        attachAgreementEvents,
        cleanupSignupHandlers,
        renderEmailScreen,
        searchMember,
        setHint,
        setPendingSignupDraft,
        setPendingSignupMethod,
        setSignupAgreementAccepted,
        showSignupAgreement,
        state,
        updateURL,
        values
      });
      setSignupFooterHint();
      if (result.errorFieldId) {
        attachEmailEvents(result.errorFieldId);
      }
    };

    refs.runSignupChoice = (rawChoice) => {
      let choice = String(rawChoice || '').trim().toLowerCase() || 'y';
      if (TYPO_MAP[choice]) {
        choice = TYPO_MAP[choice].toLowerCase();
      }
      if (!choice) {
        if (hintLineEl) {
          hintLineEl.textContent = SIGNUP_CONFIRM_HINT;
        }
        document.getElementById('signup-confirm-input')?.focus();
        return;
      }
      if (choice === 'x' || choice === 'n' || choice === 'p' || choice === 'm' || choice === 't') {
        returnToSignupMenu();
        return;
      }

      const editFieldId = SIGNUP_EDIT_FIELD_IDS[choice];
      if (editFieldId) {
        focusField(editFieldId);
        return;
      }
      if (choice === 'y') {
        void submitSignup();
        return;
      }
      if (hintLineEl) {
        hintLineEl.textContent = '????? y, n, 1~5 ? ??? ??? ? ????.';
      }
      document.getElementById('signup-confirm-input')?.focus();
    };

    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      document.getElementById('signup-confirm-input')?.focus();
    });

    state._signupEnterHandler = function suppressFooterSignupInput(raw) {
      if (state.screen !== 'signup' || state._signupFlow !== 'email') {
        return false;
      }
      cmdInput.value = '';
      if (refs.runSignupChoice) {
        refs.runSignupChoice(String(raw || '').trim());
      }
      return true;
    };
  };
}
