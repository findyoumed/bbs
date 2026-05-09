export function createSignupFlowConfig(getCommandFooterText) {
  const SIGNUP_HINTS = {
    'signup-userid': 'ID를 입력하여 주십시오. (영문/숫자/_ 3~20자)',
    'signup-password': '비밀번호를 입력하여 주십시오. (6자 이상)',
    'signup-password-confirm': '비밀번호 확인을 입력하여 주십시오.',
    'signup-nickname': '이용자명을 입력하여 주십시오. (2~20자)',
    'signup-email': '이메일 주소를 입력하여 주십시오.'
  };
  const SIGNUP_METHODS = [
    { key: '1', type: 'email', label: '이메일로 가입', description: '' },
    { key: '2', type: 'oauth', provider: 'google', label: '구글로 가입', description: '' },
    { key: '3', type: 'oauth', provider: 'kakao', label: '카카오로 가입', description: '' }
  ];
  const SIGNUP_METHOD_LOOKUP = SIGNUP_METHODS.reduce((acc, method) => {
    acc[method.key] = method;
    return acc;
  }, {});
  const SIGNUP_AGREE_HINT = '동의확인 [ ] (동의:y  취소:n)';
  const SIGNUP_METHOD_FOOTER_HINT = getCommandFooterText('authMenu').split('\n')[0];
  const SIGNUP_CONFIRM_HINT = '신청확인에 y / n / 번호(1~5)를 입력하여 주십시오.';
  const SIGNUP_EDIT_FIELD_IDS = {
    '1': 'signup-userid',
    '2': 'signup-password',
    '3': 'signup-password-confirm',
    '4': 'signup-nickname',
    '5': 'signup-email'
  };
  const TYPO_MAP = {
    'ㅔ': 'p', 'ㅡ': 'm', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅁ': 'a', 'ㄹ': 'f', 'ㅣ': 'l', 'ㅅ': 't',
    'ㅈ': 'w', 'ㄱ': 'r', 'ㄷ': 'e', 'ㅇ': 'd', 'ㄴ': 's', 'ㅍ': 'v', 'ㅊ': 'c', 'ㅐ': 'o',
    'ㅗ': 'h', 'ㅂ': 'q', 'ㅌ': 'x', 'ㅛ': 'y'
  };

  return {
    SIGNUP_AGREE_HINT,
    SIGNUP_CONFIRM_HINT,
    SIGNUP_EDIT_FIELD_IDS,
    SIGNUP_HINTS,
    SIGNUP_METHODS,
    SIGNUP_METHOD_FOOTER_HINT,
    SIGNUP_METHOD_LOOKUP,
    TYPO_MAP
  };
}
