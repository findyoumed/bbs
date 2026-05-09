const SIGNUP_AGREEMENT_STORAGE_KEY = '01410-signup-agreed';
const SIGNUP_PENDING_METHOD_STORAGE_KEY = '01410-signup-pending-method';

export function createSignupFlowState(deps) {
  const {
    esc,
    getMenuNodeByKey,
    getMenuNodeLabel,
    getMenuParentNode,
    state
  } = deps;

  function getSignupHeading() {
    const signupNode = getMenuNodeByKey('signup');
    const parentNode = signupNode ? getMenuParentNode(signupNode) : null;
    const signupLabel = signupNode ? getMenuNodeLabel(signupNode) : '회원가입';
    const groupLabel = parentNode ? getMenuNodeLabel(parentNode) : '회원가입 / 로그인';
    return {
      brandHtml: `01410<br>${esc(signupLabel)}`,
      title: groupLabel,
      subtitle: signupLabel
    };
  }

  function setSignupAgreementAccepted(accepted) {
    state._signupAgreementAccepted = Boolean(accepted);
    try {
      if (accepted) {
        window.sessionStorage.setItem(SIGNUP_AGREEMENT_STORAGE_KEY, 'y');
      } else {
        window.sessionStorage.removeItem(SIGNUP_AGREEMENT_STORAGE_KEY);
      }
    } catch (error) {
      console.error('회원가입 동의 상태 저장 실패:', error.message);
    }
  }

  function getPendingSignupMethod() {
    if (state._signupPendingMethod) {
      return state._signupPendingMethod;
    }
    try {
      return window.sessionStorage.getItem(SIGNUP_PENDING_METHOD_STORAGE_KEY) || '';
    } catch (error) {
      console.error('회원가입 방식 상태 확인 실패:', error.message);
      return '';
    }
  }

  function setPendingSignupMethod(methodKey) {
    const normalized = String(methodKey || '').trim();
    state._signupPendingMethod = normalized;
    try {
      if (normalized) {
        window.sessionStorage.setItem(SIGNUP_PENDING_METHOD_STORAGE_KEY, normalized);
      } else {
        window.sessionStorage.removeItem(SIGNUP_PENDING_METHOD_STORAGE_KEY);
      }
    } catch (error) {
      console.error('회원가입 방식 상태 저장 실패:', error.message);
    }
  }

  function getPendingSignupDraft() {
    if (state._signupDraft && typeof state._signupDraft === 'object') {
      return state._signupDraft;
    }
    return null;
  }

  function setPendingSignupDraft(values) {
    if (!values || typeof values !== 'object') {
      state._signupDraft = null;
      return;
    }

    state._signupDraft = {
      userId: String(values.userId || ''),
      password: String(values.password || ''),
      passwordConfirm: String(values.passwordConfirm || ''),
      nickName: String(values.nickName || ''),
      email: String(values.email || '')
    };
  }

  function resolveInitialSignupFlow(requestedSignupFlow) {
    const pendingSignupMethod = getPendingSignupMethod();
    const pendingSignupDraft = getPendingSignupDraft();

    if (requestedSignupFlow === 'agree' && !pendingSignupMethod) {
      state._signupFlow = 'menu';
    } else if (requestedSignupFlow === 'agree' && pendingSignupMethod === '1' && !pendingSignupDraft) {
      state._signupFlow = 'email';
    } else {
      state._signupFlow = requestedSignupFlow;
    }

    return {
      pendingSignupMethod,
      pendingSignupDraft
    };
  }

  return {
    getPendingSignupDraft,
    getPendingSignupMethod,
    getSignupHeading,
    resolveInitialSignupFlow,
    setPendingSignupDraft,
    setPendingSignupMethod,
    setSignupAgreementAccepted
  };
}
