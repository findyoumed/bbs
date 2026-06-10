export function createSignupFlowUi(deps) {
  const {
    SIGNUP_METHODS,
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    esc,
    hintEl,
    refs,
    screenEl,
    signupHeading,
    state
  } = deps;

  function cleanupSignupHandlers() {
    refs.runSignupChoice = null;
    refs.focusSignupConfirmInput = null;
    refs.focusSignupEmailField = null;
    state._signupEnterHandler = null;
  }

  function setSignupFooterHint() {
    if (!hintEl) {
      return;
    }

    hintEl.innerHTML =
      '신청확인 [<input id="signup-confirm-input" class="signup-confirm-input" maxlength="1" autocomplete="off" spellcheck="false">]'
      + ' (<span class="cmd-token cmd-clickable" data-tip="Y" data-signup-choice="y">신청</span>,'
      + '<span class="cmd-token cmd-clickable" data-tip="N" data-signup-choice="n">취소</span>,'
      + '<span class="cmd-token">1~5:수정</span>)';

    const confirmEl = hintEl.querySelector('#signup-confirm-input');
    if (confirmEl) {
      confirmEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = confirmEl.value.trim() || 'y';
          confirmEl.value = '';
          if (refs.runSignupChoice) {
            refs.runSignupChoice(value);
          }
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (typeof refs.focusSignupEmailField === 'function') {
            refs.focusSignupEmailField('signup-email');
          }
        }
      });
    }

    hintEl.querySelectorAll('[data-signup-choice]').forEach((element) => {
      element.addEventListener('click', () => {
        if (refs.runSignupChoice) {
          refs.runSignupChoice(element.dataset.signupChoice);
        }
      });
    });
  }

  function setSignupAgreeFooterHint() {
    if (!hintEl) {
      return;
    }

    hintEl.innerHTML = '동의확인 [<input id="signup-agree-input" class="signup-confirm-input" maxlength="1" autocomplete="off" spellcheck="false">]'
      + ' (<span class="cmd-token cmd-clickable" data-tip="Y" data-signup-choice="y">동의</span>,'
      + '<span class="cmd-token cmd-clickable" data-tip="N" data-signup-choice="n">취소</span>)';

    const agreeInput = hintEl.querySelector('#signup-agree-input');
    if (agreeInput) {
      agreeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = agreeInput.value.trim() || 'y';
          agreeInput.value = '';
          if (refs.runSignupChoice) {
            refs.runSignupChoice(value);
          }
        }
      });
    }

    hintEl.querySelectorAll('[data-signup-choice]').forEach((element) => {
      element.addEventListener('click', () => {
        if (refs.runSignupChoice) {
          refs.runSignupChoice(element.dataset.signupChoice);
        }
      });
    });
  }

  async function startSignupOAuth(provider) {
    if (!state.supabase) {
      throw new Error('소셜 가입 기능이 설정되지 않았습니다.');
    }

    const { error } = await state.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      throw new Error(error.message || '소셜 가입을 시작할 수 없습니다.');
    }
  }

  // [LOG: 20260610_1525] 회원가입 화면 로딩 상태 클래스 제거 도우미
  function clearLoadingState() {
    if (screenEl?.parentElement) {
      screenEl.parentElement.classList.remove('is-loading');
    }
    screenEl?.classList.remove('is-loading');
  }

  function showSignupMenu(options = {}) {
     const errorText = options.error ? `※ ${options.error}` : '';

     screenEl.innerHTML = (
       `<div class="entry-screen entry-screen--signup">`
       + `<div class="entry-signup-top">`
       + `<div class="entry-signup-brand">${signupHeading.brandHtml}</div>`
       + `<div class="entry-signup-headings">`
       + `<div class="entry-signup-title">${esc(signupHeading.title)}</div>`
       + `<div class="entry-signup-subtitle">${esc(signupHeading.subtitle)}</div>`
       + `</div>`
       + `<div class="entry-signup-brand entry-signup-brand--ghost">&nbsp;</div>`
       + `</div>`
       + `<div class="entry-signup-rule"></div>`
       + `<div class="entry-signup-method-list">`
       + SIGNUP_METHODS.map((method) => (
         `<button type="button" class="entry-signup-method" data-signup-method="${method.key}">`
         + `<span class="entry-signup-method-number">${method.key}.</span>`
         + `<span class="entry-signup-method-copy">`
         + `<span class="entry-signup-method-label">${esc(method.label)}</span>`
         + `<span class="entry-signup-method-desc">${esc(method.description)}</span>`
         + `</span>`
         + `</button>`
       )).join('')
       + `</div>`
       + `<div class="entry-signup-rule entry-signup-rule--tight"></div>`
       + `<div class="entry-error">${errorText}</div>`
       + `</div>`
     );
     clearLoadingState();
   }

  function showSignupAgreement(options = {}) {
    const errorText = options.error ? `※${options.error}` : '';

    screenEl.innerHTML = (
      `<div class="entry-screen entry-screen--signup">`
      + `<div class="entry-signup-top">`
      + `<div class="entry-signup-brand">${signupHeading.brandHtml}</div>`
      + `<div class="entry-signup-headings">`
      + `<div class="entry-signup-title">${esc(signupHeading.title)}</div>`
      + `<div class="entry-signup-subtitle">${esc(signupHeading.subtitle)}</div>`
      + `</div>`
      + `<div class="entry-signup-brand entry-signup-brand--ghost">&nbsp;</div>`
      + `</div>`
      + `<div class="entry-signup-rule"></div>`
      + `<div class="entry-signup-agreement">`
      + `<div class="entry-signup-agreement-title">회원가입약관 동의</div>`
      + `<textarea class="entry-signup-agreement-box" id="tos-box" rows="10" readonly spellcheck="false" aria-label="회원가입약관">`
      + SIGNUP_TOS_TEXT.map((line) => esc(line)).join('\n')
      + `</textarea>`
      + `<div class="entry-signup-agreement-title" style="margin-top:15px;">개인정보 수집 및 이용 동의</div>`
      + `<textarea class="entry-signup-agreement-box" id="privacy-box" rows="10" readonly spellcheck="false" aria-label="개인정보 수집 및 이용 동의">`
      + SIGNUP_PRIVACY_TEXT.map((line) => esc(line)).join('\n')
      + `</textarea>`
      + `</div>`
      + `<div class="entry-signup-rule entry-signup-rule--tight"></div>`
      + `<div class="entry-error">${errorText}</div>`
      + `</div>`
    );

    const tosBox = document.getElementById('tos-box');
    const privacyBox = document.getElementById('privacy-box');
    if (tosBox) {
      tosBox.scrollTop = 0;
    }
    if (privacyBox) {
      privacyBox.scrollTop = 0;
    }
    clearLoadingState();
  }

  function renderEmailScreen(options = {}) {
    const values = options.values || {};
    const errorText = options.error ? `※ ${options.error} ` : '';

    screenEl.innerHTML = (
      `<div class="entry-screen entry-screen--signup">`
      + `<div class="entry-signup-top">`
      + `<div class="entry-signup-brand">${signupHeading.brandHtml}</div>`
      + `<div class="entry-signup-headings">`
      + `<div class="entry-signup-title">${esc(signupHeading.title)}</div>`
      + `<div class="entry-signup-subtitle">${esc(signupHeading.subtitle)}</div>`
      + `</div>`
      + `<div class="entry-signup-brand entry-signup-brand--ghost">&nbsp;</div>`
      + `</div>`
      + `<div class="entry-signup-rule"></div>`
      + `<form id="signup-inline-form" class="entry-inline-form">`
      + `<div class="entry-inline-grid">`
      + `<label class="entry-inline-field entry-inline-field--dual">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">1.</span><span class="entry-inline-label">회원 ID</span><span class="entry-signup-colon">:</span></span>`
      + `<span class="entry-inline-input-wrap"><input id="signup-userid" class="entry-inline-input" type="text" maxlength="20" autocomplete="username" value="${esc(values.userId || '')}"></span>`
      + `</label>`
      + `<label class="entry-inline-field entry-inline-field--dual">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">2.</span><span class="entry-inline-label">비밀번호</span><span class="entry-signup-colon">:</span></span>`
      + `<span class="entry-inline-input-wrap"><input id="signup-password" class="entry-inline-input" type="password" maxlength="40" autocomplete="new-password" value=""></span>`
      + `</label>`
      + `<label class="entry-inline-field entry-inline-field--dual">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">3.</span><span class="entry-inline-label">비밀번호 확인</span><span class="entry-signup-colon">:</span></span>`
      + `<span class="entry-inline-input-wrap"><input id="signup-password-confirm" class="entry-inline-input" type="password" maxlength="40" autocomplete="new-password" value=""></span>`
      + `</label>`
      + `<label class="entry-inline-field entry-inline-field--dual">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">4.</span><span class="entry-inline-label">이용자명</span><span class="entry-signup-colon">:</span></span>`
      + `<span class="entry-inline-input-wrap"><input id="signup-nickname" class="entry-inline-input" type="text" maxlength="20" autocomplete="name" value="${esc(values.nickName || '')}"></span>`
      + `</label>`
      + `<label class="entry-inline-field">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">5.</span><span class="entry-inline-label">이메일</span><span class="entry-signup-colon">:</span></span>`
      + `<span class="entry-inline-input-wrap"><input id="signup-email" class="entry-inline-input" type="email" maxlength="254" autocomplete="email" value="${esc(values.email || '')}"></span>`
      + `</label>`
      + `</div>`
      + `<div class="entry-signup-rule entry-signup-rule--tight"></div>`
      + `<div class="entry-error">${errorText}</div>`
      + `<div id="signup-field-hint" class="entry-signup-field-hint">&nbsp;</div>`
      + `</form>`
      + `</div>`
    );
    clearLoadingState();
  }

  return {
    cleanupSignupHandlers,
    renderEmailScreen,
    setSignupAgreeFooterHint,
    setSignupFooterHint,
    showSignupAgreement,
    showSignupMenu,
    startSignupOAuth
  };
}
