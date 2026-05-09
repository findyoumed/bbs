import { createSignupState } from './signupState.js';
import { createSignupMenuHandler } from './signupMenu.js';
import { createSignupAgreementHandler } from './signupAgreement.js';
import { createSignupEmailHandler } from './signupEmailForm.js';
import { createSignupOAuthProfileHandler } from './signupOAuthProfile.js';

export function createSignupModule(deps) {
  const {
    SIGNUP_PRIVACY_TEXT, SIGNUP_TOS_TEXT, cmdInput, createSignupScreens,
    doSignup, esc, getCommandFooterText, getMenuNodeByKey, getMenuNodeLabel,
    getMenuParentNode, hintEl, mountPromptRow, precheckSignup, restorePromptRow, screenEl, searchMember, setFooterVisibility, setHint, setPrompt,
    showMain, state, updateURL
  } = deps;

  const SIGNUP_HINTS = {
    'signup-userid': 'ID를 입력하여 주십시오. (영문/숫자/_ 3~20자)',
    'signup-password': '비밀번호를 입력하여 주십시오. (6자 이상)',
    'signup-password-confirm': '비밀번호 확인을 입력하여 주십시오.',
    'signup-nickname': '이용자명을 입력하여 주십시오. (2~20자)',
    'signup-email': '이메일 주소를 입력하여 주십시오.',
  };
  // [LOG: 20260414_1000] OAuth 프로필 입력 폼 힌트 상수
  const SIGNUP_OAUTH_HINTS = {
    'signup-oauth-userid': 'ID를 입력하여 주십시오. (영문/숫자/_ 3~20자)',
    'signup-oauth-nickname': '이용자명을 입력하여 주십시오.',
  };
  const SIGNUP_OAUTH_CONFIRM_HINT = '확인에 y / n / 번호(1~2)를 입력하여 주십시오.';
  const SIGNUP_METHODS = [
    { key: '1', type: 'email', label: '이메일로 가입' },
    { key: '2', type: 'oauth', provider: 'google', label: '구글로 가입' },
    { key: '3', type: 'oauth', provider: 'kakao', label: '카카오로 가입' },
  ];
  const SIGNUP_METHOD_LOOKUP = SIGNUP_METHODS.reduce((acc, m) => ({ ...acc, [m.key]: m }), {});
  const SIGNUP_AGREE_FOOTER_HINT = '동의확인(<span class="signup-footer-choice" data-signup-choice="y">동의:y</span>,<span class="signup-footer-choice" data-signup-choice="n">취소:n</span>) : <input id="signup-agree-input" class="signup-confirm-input" maxlength="1" autocomplete="off" value="y">';
  const SIGNUP_CONFIRM_HINT = '신청확인에 y / n / 번호(1~5)를 입력하여 주십시오.';
  const SIGNUP_EDIT_FIELD_IDS = { '1': 'signup-userid', '2': 'signup-password', '3': 'signup-password-confirm', '4': 'signup-nickname', '5': 'signup-email' };

  const {
    getPendingSignupDraft,
    getPendingSignupMethod,
    hasSignupAgreement,
    setPendingSignupDraft,
    setPendingSignupMethod,
    setSignupAgreementAccepted,
    getPendingOAuthProfile,
    setPendingOAuthProfile,
    clearPendingOAuthProfile,
    getSignupEmailStage,
    setSignupEmailStage,
    clearSignupEmailStage,
    getSignupEmailTranscript,
    setSignupEmailTranscript,
    appendSignupEmailTranscript,
    clearSignupEmailTranscript
  } = createSignupState({ state });
  const resolvePendingSignupMethod = () => {
    const methodKey = getPendingSignupMethod();
    if (SIGNUP_METHOD_LOOKUP[methodKey]) {
      return SIGNUP_METHOD_LOOKUP[methodKey];
    }

    const pendingOAuth = getPendingOAuthProfile();
    if (pendingOAuth?.provider) {
      return SIGNUP_METHODS.find((method) => method.provider === pendingOAuth.provider) || null;
    }
    return null;
  };

  const getSignupHeading = () => {
    const node = getMenuNodeByKey('signup'), parent = node ? getMenuParentNode(node) : null;
    return { brandHtml: `01410<br>${esc(node ? getMenuNodeLabel(node) : '회원가입')}`, title: parent ? getMenuNodeLabel(parent) : '회원가입 / 로그인', subtitle: node ? getMenuNodeLabel(node) : '회원가입' };
  };

  const { showSignupMenu, showSignupAgreement, renderEmailScreen, renderOAuthProfileScreen } = createSignupScreens({
    SIGNUP_METHODS,
    SIGNUP_TOS_TEXT,
    SIGNUP_PRIVACY_TEXT,
    esc,
    getSignupEmailTranscript,
    screenEl,
    signupHeading: getSignupHeading()
  });

  const cleanupSignupHandlers = () => { state._signupEnterHandler = null; };
  const focusInputAtEnd = (inputEl) => {
    if (!inputEl) return;
    inputEl.focus();
    if (typeof inputEl.setSelectionRange !== 'function') return;
    const caretPosition = String(inputEl.value || '').length;
    inputEl.setSelectionRange(caretPosition, caretPosition);
    window.setTimeout(() => inputEl.setSelectionRange(caretPosition, caretPosition), 0);
  };
  // [LOG: 20260429_0657] Direct signup sub-routes bypass applyCommandFooter(),
  // so inline/footer-driven signup screens must reopen the shared footer
  // themselves or their confirm inputs remain hidden on fresh loads.
  const ensureSignupFooterVisible = () => {
    if (typeof setFooterVisibility === 'function') {
      setFooterVisibility(true);
    }
  };
  const setSignupFooterHint = (runChoice, focusField) => {
    if (!hintEl) return;
    hintEl.classList.remove('has-cmd-tokens');
    hintEl.innerHTML = '신청확인(<span class="signup-footer-choice" data-signup-choice="y">신청:y</span>,<span class="signup-footer-choice" data-signup-choice="n">취소:n</span>,수정:번호) : <input id="signup-confirm-input" class="signup-confirm-input" maxlength="1" autocomplete="off" value="y">';
    ensureSignupFooterVisible();
    const inp = hintEl.querySelector('#signup-confirm-input');
    focusInputAtEnd(inp);
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runChoice(inp.value.trim() || 'y'); inp.value = ''; } else if (e.key === 'ArrowUp') { e.preventDefault(); focusField('signup-email'); } });
    hintEl.querySelectorAll('.signup-footer-choice').forEach(el => el.addEventListener('click', () => runChoice(el.dataset.signupChoice)));
  };

  // [LOG: 20260415_1530] 동의 화면 footer hint - 직접 클릭 리스너 없음 (appEvents.js 위임으로 이중 호출 방지)
  const setSignupAgreeFooterHint = (runChoice) => {
    if (!hintEl) return;
    hintEl.classList.remove('has-cmd-tokens');
    hintEl.innerHTML = SIGNUP_AGREE_FOOTER_HINT;
    ensureSignupFooterVisible();
    const inp = hintEl.querySelector('#signup-agree-input');
    // [LOG: 20260508_1718] Put the caret after the default y/n character in signup choice inputs.
    focusInputAtEnd(inp);
    if (inp) inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runChoice(inp.value.trim() || 'y'); inp.value = ''; }
    });
    // .signup-footer-choice 클릭: appEvents.js의 전역 [data-signup-choice] 핸들러가 처리
  };

  // [LOG: 20260414_1000] OAuth 프로필 폼 footer hint 설정
  // [LOG: 20260415_1530] 직접 클릭 리스너 제거 (appEvents.js 위임으로 이중 호출 방지)
  const setOAuthProfileFooterHint = (runChoice, focusField) => {
    if (!hintEl) return;
    hintEl.classList.remove('has-cmd-tokens');
    hintEl.innerHTML = '신청확인(<span class="signup-footer-choice" data-signup-choice="y">신청:y</span>,<span class="signup-footer-choice" data-signup-choice="n">취소:n</span>,수정:번호) : <input id="signup-oauth-confirm-input" class="signup-confirm-input" maxlength="1" autocomplete="off" value="y">';
    ensureSignupFooterVisible();
    const inp = hintEl.querySelector('#signup-oauth-confirm-input');
    focusInputAtEnd(inp);
    if (inp) inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runChoice(inp.value.trim() || 'y'); inp.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusField('signup-oauth-nickname'); }
    });
    // .signup-footer-choice 클릭: appEvents.js의 전역 [data-signup-choice] 핸들러가 처리
  };

  const startSignupOAuth = async (p) => {
    if (!state.supabase) throw new Error('소셜 가입 기능이 설정되지 않았습니다.');
    const { error } = await state.supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: `${window.location.origin}/` } });
    if (error) throw new Error(error.message);
  };

  const commonDeps = {
    SIGNUP_METHOD_LOOKUP,
    cleanupSignupHandlers,
    cmdInput,
    getCommandFooterText,
    renderEmailScreen,
    setSignupAgreementAccepted,
    setPendingSignupMethod,
    setPendingSignupDraft,
    showMain,
    showSignupAgreement,
    showSignupMenu,
    state,
    updateURL,
    setHint,
    setPrompt,
    getPendingSignupDraft,
    getPendingSignupMethod,
    hasSignupAgreement,
    doSignup,
    precheckSignup,
    screenEl,
    startSignupOAuth,
    SIGNUP_AGREE_FOOTER_HINT,
    setSignupAgreeFooterHint,
    setSignupFooterHint,
    SIGNUP_OAUTH_HINTS,
    SIGNUP_OAUTH_CONFIRM_HINT,
    clearPendingOAuthProfile,
    getPendingOAuthProfile,
    setPendingOAuthProfile,
    renderOAuthProfileScreen,
    setOAuthProfileFooterHint,
    hintEl,
    mountPromptRow,
    restorePromptRow,
    setFooterVisibility,
    getSignupEmailStage,
    setSignupEmailStage,
    clearSignupEmailStage,
    getSignupEmailTranscript,
    setSignupEmailTranscript,
    appendSignupEmailTranscript,
    clearSignupEmailTranscript
  };
  const { attachSignupMenuEvents } = createSignupMenuHandler(commonDeps);
  const { attachAgreementEvents } = createSignupAgreementHandler(commonDeps);
  const attachEmailEvents = createSignupEmailHandler({ ...commonDeps, SIGNUP_HINTS, SIGNUP_EDIT_FIELD_IDS, SIGNUP_CONFIRM_HINT, searchMember });
  // [LOG: 20260414_1000] OAuth 프로필 핸들러 초기화
  const { attachOAuthProfileEvents } = createSignupOAuthProfileHandler({ ...commonDeps, searchMember });

  const handlers = { attachSignupMenuEvents: () => attachSignupMenuEvents(handlers), attachAgreementEvents: () => attachAgreementEvents(handlers), attachEmailEvents: (...args) => attachEmailEvents(handlers, ...args), attachOAuthProfileEvents: (options) => attachOAuthProfileEvents(handlers, options) };

  function showSignup(fromHistory = false, initialFlow = 'menu') {
    state.screen = 'signup'; cmdInput.type = 'text'; cmdInput.value = '';
    const requested = ['email', 'agree', 'oauth-profile'].includes(initialFlow) ? initialFlow : 'menu';
    const method = resolvePendingSignupMethod();
    const draft = getPendingSignupDraft();
    const pendingOAuth = getPendingOAuthProfile();

    if (requested === 'agree' && !method) state._signupFlow = 'menu';
    else if (requested === 'agree' && method?.key === '1' && !draft) state._signupFlow = 'email';
    else if (requested === 'oauth-profile' && method?.type !== 'oauth') state._signupFlow = 'menu';
    else state._signupFlow = requested;
    void updateURL(fromHistory);
    if (state._signupFlow === 'email') {
      if (!draft) {
        clearSignupEmailStage();
        clearSignupEmailTranscript();
      }
      renderEmailScreen({ values: draft || {} });
      handlers.attachEmailEvents();
    } else if (state._signupFlow === 'menu') {
      clearSignupEmailStage();
      clearSignupEmailTranscript();
      state._maskCommandInput = false;
      showSignupMenu();
      handlers.attachSignupMenuEvents();
    } else if (state._signupFlow === 'oauth-profile') {
      state._maskCommandInput = false;
      renderOAuthProfileScreen({
        error: state._oauthSignupError || '',
        values: {
          userId: pendingOAuth?.userId || '',
          nickName: pendingOAuth?.nickName || ''
        },
        provider: method?.provider || pendingOAuth?.provider || '',
        label: method?.label || ''
      });
      handlers.attachOAuthProfileEvents({
        provider: method?.provider || pendingOAuth?.provider || '',
        label: method?.label || ''
      });
    } else {
      clearSignupEmailStage();
      clearSignupEmailTranscript();
      state._maskCommandInput = false;
      showSignupAgreement();
      handlers.attachAgreementEvents();
    }
  }

  return { showSignup };
}
