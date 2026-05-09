export async function submitSignupDraft(deps) {
  const {
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
  } = deps;

  let errorMessage = '';
  let errorFieldId = 'signup-userid';

  if (!values.userId) {
    errorMessage = 'ID를 입력하여 주십시오.';
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(values.userId)) {
    errorMessage = 'ID는 영문/숫자/_ 3~20자여야 합니다.';
  } else if (!values.password) {
    errorFieldId = 'signup-password';
    errorMessage = '비밀번호를 입력하여 주십시오.';
  } else if (values.password.length < 6) {
    errorFieldId = 'signup-password';
    errorMessage = '비밀번호는 6자 이상이어야 합니다.';
  } else if (!values.passwordConfirm) {
    errorFieldId = 'signup-password-confirm';
    errorMessage = '비밀번호 확인을 입력하여 주십시오.';
  } else if (values.password !== values.passwordConfirm) {
    errorFieldId = 'signup-password-confirm';
    errorMessage = '비밀번호와 비밀번호 확인이 서로 일치하지 않습니다.';
  } else if (!values.nickName) {
    errorFieldId = 'signup-nickname';
    errorMessage = '이용자명을 입력하여 주십시오.';
  } else if (values.nickName.length < 2 || values.nickName.length > 20) {
    errorFieldId = 'signup-nickname';
    errorMessage = '이용자명은 2~20자여야 합니다.';
  } else if (!values.email) {
    errorFieldId = 'signup-email';
    errorMessage = '이메일을 입력하여 주십시오.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errorFieldId = 'signup-email';
    errorMessage = '이메일 형식이 올바르지 않습니다.';
  }

  if (errorMessage) {
    return { errorFieldId, errorMessage };
  }

  renderEmailScreen({ values });
  setHint('가입 정보를 확인하고 있습니다. 잠시만 기다려 주십시오.');

  try {
    let member = await searchMember({ userId: values.userId });
    if (member) {
      throw new Error('이미 사용 중인 ID입니다.');
    }

    member = await searchMember({ nickName: values.nickName });
    if (member) {
      throw new Error('이미 사용 중인 닉네임입니다.');
    }

    member = await searchMember({ email: values.email });
    if (member) {
      throw new Error('이미 사용 중인 이메일입니다.');
    }

    setSignupAgreementAccepted(false);
    setPendingSignupMethod('1');
    setPendingSignupDraft(values);
    cleanupSignupHandlers();
    state._signupFlow = 'agree';
    void updateURL();
    showSignupAgreement();
    attachAgreementEvents();
    return { errorFieldId: '', errorMessage: '' };
  } catch (error) {
    renderEmailScreen({
      error: error.message,
      values
    });
    setHint(`가입 정보 오류: ${error.message}`);
    return { errorFieldId: 'signup-userid', errorMessage: error.message };
  }
}
