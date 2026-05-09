export function createSignupState(deps) {
  const { state } = deps;
  const AGREEMENT_KEY = '01410-signup-agreed';
  const METHOD_KEY = '01410-signup-pending-method';
  const SIGNUP_EMAIL_STAGES = new Set(['signup-userid', 'signup-password', 'signup-password-confirm', 'signup-nickname', 'signup-email', 'signup-confirm']);

  function hasSignupAgreement() {
    if (state._signupAgreementAccepted) return true;
    try { return window.sessionStorage.getItem(AGREEMENT_KEY) === 'y'; } catch (e) { return false; }
  }

  function setSignupAgreementAccepted(accepted) {
    state._signupAgreementAccepted = !!accepted;
    try {
      if (accepted) window.sessionStorage.setItem(AGREEMENT_KEY, 'y');
      else window.sessionStorage.removeItem(AGREEMENT_KEY);
    } catch (e) {}
  }

  function getPendingSignupMethod() {
    if (state._signupPendingMethod) return state._signupPendingMethod;
    try { return window.sessionStorage.getItem(METHOD_KEY) || ''; } catch (e) { return ''; }
  }

  function setPendingSignupMethod(methodKey) {
    state._signupPendingMethod = methodKey;
    try {
      if (methodKey) window.sessionStorage.setItem(METHOD_KEY, methodKey);
      else window.sessionStorage.removeItem(METHOD_KEY);
    } catch (e) {}
  }

  function getPendingSignupDraft() { return state._signupDraft || null; }
  function setPendingSignupDraft(values) { state._signupDraft = values ? { ...values } : null; }

  function getSignupEmailStage() {
    const stage = String(state._signupEmailStage || '').trim();
    return SIGNUP_EMAIL_STAGES.has(stage) ? stage : '';
  }

  function setSignupEmailStage(stage) {
    const normalized = String(stage || '').trim();
    state._signupEmailStage = SIGNUP_EMAIL_STAGES.has(normalized) ? normalized : '';
  }

  function clearSignupEmailStage() {
    state._signupEmailStage = '';
  }

  function getSignupEmailTranscript() {
    return Array.isArray(state._signupEmailTranscript) ? state._signupEmailTranscript : [];
  }

  function setSignupEmailTranscript(lines = []) {
    state._signupEmailTranscript = Array.isArray(lines)
      ? lines.map((line) => String(line ?? ''))
      : [];
  }

  function appendSignupEmailTranscript(line = '') {
    const text = String(line ?? '');
    state._signupEmailTranscript = [...getSignupEmailTranscript(), text];
  }

  function clearSignupEmailTranscript() {
    state._signupEmailTranscript = [];
  }

  // [LOG: 20260414_1000] OAuth 가입 시 아이디/닉네임 입력값을 localStorage에 임시 저장
  const OAUTH_PROFILE_KEY = '01410-oauth-pending-profile';

  function getPendingOAuthProfile() {
    try {
      const raw = window.localStorage.getItem(OAUTH_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setPendingOAuthProfile(profile) {
    try {
      if (profile) window.localStorage.setItem(OAUTH_PROFILE_KEY, JSON.stringify(profile));
      else window.localStorage.removeItem(OAUTH_PROFILE_KEY);
    } catch (e) {}
  }

  function clearPendingOAuthProfile() {
    try { window.localStorage.removeItem(OAUTH_PROFILE_KEY); } catch (e) {}
  }

  return {
    getPendingSignupDraft, getPendingSignupMethod, hasSignupAgreement,
    setPendingSignupDraft, setPendingSignupMethod, setSignupAgreementAccepted,
    getPendingOAuthProfile, setPendingOAuthProfile, clearPendingOAuthProfile,
    getSignupEmailStage, setSignupEmailStage, clearSignupEmailStage,
    getSignupEmailTranscript, setSignupEmailTranscript, appendSignupEmailTranscript, clearSignupEmailTranscript
  };
}
