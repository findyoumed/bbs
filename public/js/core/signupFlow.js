import { createSignupFlowAgreementHandler } from './signupFlowAgreement.js';
import { createSignupFlowConfig } from './signupFlowConfig.js';
import { createSignupFlowEmailHandler } from './signupFlowEmail.js';
import { createSignupFlowState } from './signupFlowState.js';
import { createSignupFlowUi } from './signupFlowUi.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createSignupFlow(deps) {
  const {
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    cmdInput,
    doSignup,
    esc,
    getCommandFooterText,
    getMenuNodeByKey,
    getMenuNodeLabel,
    getMenuParentNode,
    hintEl,
    screenEl,
    searchMember,
    setHint,
    setPrompt,
    showMain,
    state,
    updateURL
  } = deps;

  return function showSignup(fromHistory = false, initialFlow = 'menu') {
    state.screen = 'signup';
    const requestedSignupFlow = initialFlow === 'email'
      ? 'email'
      : initialFlow === 'agree'
        ? 'agree'
        : 'menu';

    cmdInput.type = 'text';
    cmdInput.value = '';

    const {
      SIGNUP_AGREE_HINT,
      SIGNUP_CONFIRM_HINT,
      SIGNUP_EDIT_FIELD_IDS,
      SIGNUP_HINTS,
      SIGNUP_METHODS,
      SIGNUP_METHOD_FOOTER_HINT,
      SIGNUP_METHOD_LOOKUP,
      TYPO_MAP
    } = createSignupFlowConfig(getCommandFooterText);
    const promptRowEl = document.getElementById('terminal-prompt-row');
    const refs = {
      runSignupChoice: null,
      focusSignupConfirmInput: null,
      focusSignupEmailField: null
    };

    const signupState = createSignupFlowState({
      esc,
      getMenuNodeByKey,
      getMenuNodeLabel,
      getMenuParentNode,
      state
    });
    const {
      getPendingSignupDraft,
      getPendingSignupMethod,
      getSignupHeading,
      resolveInitialSignupFlow,
      setPendingSignupDraft,
      setPendingSignupMethod,
      setSignupAgreementAccepted
    } = signupState;

    const signupUi = createSignupFlowUi({
      SIGNUP_METHODS,
      SIGNUP_PRIVACY_TEXT,
      SIGNUP_TOS_TEXT,
      esc,
      hintEl,
      refs,
      screenEl,
      signupHeading: getSignupHeading(),
      state
    });
    const {
      cleanupSignupHandlers,
      renderEmailScreen,
      setSignupAgreeFooterHint,
      setSignupFooterHint,
      showSignupAgreement,
      showSignupMenu,
      startSignupOAuth
    } = signupUi;

    resolveInitialSignupFlow(requestedSignupFlow);
    void updateURL(fromHistory);

    let attachSignupMenuEvents = () => {};
    let attachAgreementEvents = () => {};
    let attachEmailEvents = () => {};

    attachAgreementEvents = createSignupFlowAgreementHandler({
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
      attachEmailEvents: (...args) => attachEmailEvents(...args),
      attachSignupMenuEvents: (...args) => attachSignupMenuEvents(...args)
    });

    attachEmailEvents = createSignupFlowEmailHandler({
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
      attachAgreementEvents: (...args) => attachAgreementEvents(...args),
      attachSignupMenuEvents: (...args) => attachSignupMenuEvents(...args)
    });

    async function handleSignupMethodChoice(rawChoice) {
      const choice = String(rawChoice || '').trim().toLowerCase();
      if (!choice) {
        // [LOG: 20260610_1521] 잘못된 명령 에러 표시 제거
        showSignupMenu();
        attachSignupMenuEvents();
        return;
      }
      if (choice === 'x' || choice === 'm' || choice === 'p' || choice === 't') {
        setSignupAgreementAccepted(false);
        setPendingSignupMethod('');
        setPendingSignupDraft(null);
        cleanupSignupHandlers();
        if (promptRowEl) {
          promptRowEl.style.display = '';
        }
        await showMain();
        return;
      }

      const method = SIGNUP_METHOD_LOOKUP[choice];
      if (!method) {
        // [LOG: 20260610_1521] 잘못된 명령 에러 표시 제거
        showSignupMenu();
        attachSignupMenuEvents();
        return;
      }
      if (method.type === 'email') {
        setSignupAgreementAccepted(false);
        setPendingSignupMethod(method.key);
        setPendingSignupDraft(null);
        cleanupSignupHandlers();
        state._signupFlow = 'email';
        void updateURL();
        renderEmailScreen();
        attachEmailEvents();
        return;
      }

      setSignupAgreementAccepted(false);
      setPendingSignupMethod(method.key);
      setPendingSignupDraft(null);
      cleanupSignupHandlers();
      state._signupFlow = 'agree';
      void updateURL();
      showSignupAgreement();
      attachAgreementEvents();
    }

    attachSignupMenuEvents = function attachSignupMenu() {
      document.querySelectorAll('[data-signup-method]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleSignupMethodChoice(button.dataset.signupMethod || '');
        });
      });

      if (promptRowEl) {
        promptRowEl.style.display = '';
      }
      setHint(SIGNUP_METHOD_FOOTER_HINT);
      setPrompt('>>');
      cleanupSignupHandlers();
      state._signupEnterHandler = function handleSignupMenuInput(raw) {
        if (state.screen !== 'signup' || state._signupFlow !== 'menu') {
          return false;
        }
        const choice = String(raw || '').trim();
        cmdInput.value = '';
        void handleSignupMethodChoice(choice);
        return true;
      };
      if (shouldAutoFocusCommandInput()) cmdInput.focus();
    };

    if (state._signupFlow === 'email') {
      renderEmailScreen({ values: getPendingSignupDraft() || {} });
      attachEmailEvents();
      return;
    }
    if (state._signupFlow === 'menu') {
      showSignupMenu();
      attachSignupMenuEvents();
      return;
    }

    showSignupAgreement();
    attachAgreementEvents();
  };
}
