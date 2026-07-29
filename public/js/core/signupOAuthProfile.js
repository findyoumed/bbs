// [LOG: 20260414_1000] OAuth 가입 시 아이디/닉네임 입력 폼 이벤트 핸들러

export function createSignupOAuthProfileHandler(deps) {
  const {
    SIGNUP_OAUTH_HINTS,
    SIGNUP_OAUTH_CONFIRM_HINT,
    cleanupSignupHandlers,
    clearPendingOAuthProfile,
    cmdInput,
    renderOAuthProfileScreen,
    searchMember,
    setSignupAgreementAccepted,
    setPendingSignupMethod,
    setPendingOAuthProfile,
    showSignupMenu,
    startSignupOAuth,
    state,
    updateURL,
  } = deps;

  const EDIT_FIELD_IDS = { '1': 'signup-oauth-userid', '2': 'signup-oauth-nickname' };

  function attachOAuthProfileEvents(handlers, { provider, label } = {}) {
    const inputs = [
      document.getElementById('signup-oauth-userid'),
      document.getElementById('signup-oauth-nickname')
    ];
    if (!inputs[0] || !inputs[1]) return;

    cleanupSignupHandlers();
    const hintLineEl = document.getElementById('signup-oauth-field-hint');

    const focusField = (id) => {
      const el = document.getElementById(id) || inputs[0];
      el.focus();
      if (el.select) el.select();
      if (hintLineEl) hintLineEl.textContent = SIGNUP_OAUTH_HINTS[el.id] || '';
    };

    const focusConfirm = () => {
      const el = document.getElementById('signup-oauth-confirm-input');
      if (el) {
        if (hintLineEl) hintLineEl.textContent = SIGNUP_OAUTH_CONFIRM_HINT;
        el.focus();
        if (el.select) el.select();
      }
    };

    const runChoice = (raw) => {
      const choice = String(raw || '').trim().toLowerCase() || 'y';
      if (choice === 'x' || choice === 'n') { returnToMenu(handlers); return; }
      const editId = EDIT_FIELD_IDS[choice];
      if (editId) { focusField(editId); return; }
      if (choice === 'y') { void submitProfile(handlers, { provider, label }); return; }
      if (hintLineEl) hintLineEl.textContent = '확인은 y, n, 1~2 중 하나만 입력할 수 있습니다.';
      document.getElementById('signup-oauth-confirm-input')?.focus();
    };

    state._signupFlow = 'oauth-profile';
    const promptRow = document.getElementById('terminal-prompt-row');
    if (promptRow) promptRow.style.display = 'none';

    deps.setOAuthProfileFooterHint(runChoice, focusField);
    focusField('signup-oauth-userid');

    inputs.forEach((el, idx) => {
      el.addEventListener('focus', () => {
        if (hintLineEl) hintLineEl.textContent = SIGNUP_OAUTH_HINTS[el.id] || '';
      });
      // [LOG: 20260729_1616] 아이디 입력 필드는 실시간으로 소문자 영문/숫자/_만 허용.
      if (el.id === 'signup-oauth-userid') {
        el.addEventListener('input', () => {
          const before = el.value;
          const after = before.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
          if (after !== before) {
            const pos = Math.min(el.selectionStart || 0, after.length);
            el.value = after;
            try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
          }
        });
      }
      el.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = inputs[idx + 1];
          if (next) focusField(next.id); else focusConfirm();
        } else if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          focusField(inputs[idx - 1].id);
        }
      });
    });

    inputs[1].addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); focusConfirm(); }
      else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); focusField(inputs[0].id); }
    });

    state._signupEnterHandler = (raw) => {
      if (state.screen !== 'signup' || state._signupFlow !== 'oauth-profile') return false;
      cmdInput.value = ''; runChoice(raw); return true;
    };
  }

  async function submitProfile(handlers, { provider, label }) {
    // [LOG: 20260729_1616] 아이디는 소문자로 저장 (대문자 입력 시 자동 변환).
    const userId = (document.getElementById('signup-oauth-userid')?.value.trim() || '').toLowerCase();
    const nickName = document.getElementById('signup-oauth-nickname')?.value.trim() || '';
    state._oauthSignupError = '';

    let err = '', errId = 'signup-oauth-userid';
    if (!userId) err = 'ID를 입력하여 주십시오.';
    else if (!/^[a-z0-9_]{3,20}$/.test(userId)) err = 'ID는 소문자 영문/숫자/_ 3~20자여야 합니다.';
    else if (!nickName) { errId = 'signup-oauth-nickname'; err = '이용자명을 입력하여 주십시오.'; }

    if (err) {
      renderOAuthProfileScreen({ error: err, values: { userId, nickName }, provider, label });
      attachOAuthProfileEvents(handlers, { provider, label });
      document.getElementById(errId)?.focus(); // [LOG: 20260415_1530] errId로 오류 필드에 포커스
      return;
    }

    renderOAuthProfileScreen({ busy: true, values: { userId, nickName }, provider, label });

    try {
      if (await searchMember({ userId })) throw new Error('이미 사용 중인 ID입니다.');
      if (await searchMember({ nickName })) throw new Error('이미 사용 중인 닉네임입니다.');

      setPendingOAuthProfile({ userId, nickName, provider });
      await startSignupOAuth(provider); // 성공 시 리디렉트 → 이하 실행 안 됨
    } catch (e) {
      clearPendingOAuthProfile();
      renderOAuthProfileScreen({ error: e.message, values: { userId, nickName }, provider, label });
      attachOAuthProfileEvents(handlers, { provider, label });
    }
  }

  function returnToMenu(handlers) {
    cleanupSignupHandlers();
    state._oauthSignupError = '';
    clearPendingOAuthProfile();
    setSignupAgreementAccepted(false);
    setPendingSignupMethod('');
    state._signupFlow = 'menu';
    void updateURL(true);
    const promptRow = document.getElementById('terminal-prompt-row');
    if (promptRow) promptRow.style.display = '';
    showSignupMenu();
    handlers.attachSignupMenuEvents();
  }

  return { attachOAuthProfileEvents };
}
