import { buildTopbarHtml } from './ansiTopbarScreen.js';

export function createSignupScreens(deps) {
  const {
    SIGNUP_METHODS,
    SIGNUP_TOS_TEXT,
    SIGNUP_PRIVACY_TEXT,
    esc,
    getSignupEmailTranscript,
    screenEl
  } = deps;

  function makeSignupTopbar(centerLabel) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `1993-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return buildTopbarHtml({
      siteLabel: 'PC통신 동호회 01410',
      timestamp,
      leftLabel: 'SIGNUP',
      centerLabel: centerLabel || '회원가입',
      rightLabel: ''
    });
  }

  function showSignupMenu(options = {}) {
    const errorText = options.error ? `※ ${options.error}` : '';

    screenEl.innerHTML = (
      `<div class="ansi-screen">`
      + makeSignupTopbar('회원가입')
      + `<div class="ansi-screen-body entry-screen--signup">`
      + `<div class="entry-signup-method-list">`
      + SIGNUP_METHODS.map((method) => (
        `<button type="button" class="entry-signup-method" data-signup-method="${method.key}">`
        + `<span class="entry-signup-method-number">${method.key}.</span>`
        + `<span class="entry-signup-method-copy">`
        + `<span class="entry-signup-method-label">${esc(method.label)}</span>`
        + `<span class="entry-signup-method-desc">${esc(method.description || '')}</span>`
        + `</span>`
        + `</button>`
      )).join('')
      + `</div>`
      + `<div class="entry-error">${errorText}</div>`
      + `</div>`
      + `</div>`
    );
  }

  function showSignupAgreement(options = {}) {
    const errorText = options.error ? `※ ${options.error}` : '';

    screenEl.innerHTML = (
      `<div class="ansi-screen">`
      + makeSignupTopbar('약관동의')
      + `<div class="ansi-screen-body entry-screen--signup">`
      + `<div class="entry-signup-agreement">`
      + `<section class="entry-signup-agreement-section">`
      + `<div class="entry-signup-agreement-title">회원가입약관 동의</div>`
      + `<textarea class="entry-signup-agreement-box" id="tos-box" rows="10" readonly spellcheck="false" aria-label="회원가입약관">`
      + SIGNUP_TOS_TEXT.map((line) => esc(line)).join('\n')
      + `</textarea>`
      + `</section>`
      + `<section class="entry-signup-agreement-section">`
      + `<div class="entry-signup-agreement-title">개인정보 수집 및 이용 동의</div>`
      + `<textarea class="entry-signup-agreement-box" id="privacy-box" rows="10" readonly spellcheck="false" aria-label="개인정보 수집 및 이용 동의">`
      + SIGNUP_PRIVACY_TEXT.map((line) => esc(line)).join('\n')
      + `</textarea>`
      + `</section>`
      + `</div>`
      + `<div class="entry-error">${errorText}</div>`
      + `</div>`
      + `</div>`
    );

    const tosBox = document.getElementById('tos-box');
    const privacyBox = document.getElementById('privacy-box');
    if (tosBox) tosBox.scrollTop = 0;
    if (privacyBox) privacyBox.scrollTop = 0;
  }

  function renderEmailScreen(options = {}) {
    const transcript = typeof getSignupEmailTranscript === 'function'
      ? getSignupEmailTranscript()
      : [];
    const errorText = String(options.error || '').trim();
    const transcriptHtml = transcript
      .map((line) => String(line ?? ''))
      .filter((line) => line.trim())
      .map((line) => `<div class="signup-terminal-line">${esc(line)}</div>`)
      .join('');
    const errorHtml = errorText
      ? `<div class="signup-terminal-line signup-terminal-line--error">${esc(errorText)}</div>`
      : '';

    screenEl.innerHTML = (
      `<div class="ansi-screen">`
      + makeSignupTopbar('이메일 가입')
      + `<div class="ansi-screen-body entry-screen--signup signup-terminal-screen">`
      + `<div class="signup-terminal-block">`
      + transcriptHtml
      + errorHtml
      + `<div class="signup-terminal-prompt-host" data-signup-email-prompt-host></div>`
      + `</div>`
      + `</div>`
      + `</div>`
    );
  }

  function renderOAuthProfileScreen(options = {}) {
    const values = options.values || {};
    const errorText = options.error ? `※ ${options.error} ` : '';

    screenEl.innerHTML = (
      `<div class="ansi-screen">`
      + makeSignupTopbar('소셜 가입')
      + `<div class="ansi-screen-body entry-screen--signup">`
      + `<form id="signup-oauth-profile-form" class="entry-inline-form">`
      + `<div class="entry-inline-grid">`
      + `<label class="entry-inline-field entry-inline-field--dual">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">1.</span><span class="entry-inline-label">회원 ID</span></span>`
      + `<span class="entry-inline-input-wrap"> : <input id="signup-oauth-userid" class="entry-inline-input" type="text" maxlength="20" autocomplete="username" value="${esc(values.userId || '')}"></span>`
      + `</label>`
      + `<label class="entry-inline-field">`
      + `<span class="entry-inline-meta"><span class="entry-signup-number">2.</span><span class="entry-inline-label">이용자명</span></span>`
      + `<span class="entry-inline-input-wrap"> : <input id="signup-oauth-nickname" class="entry-inline-input" type="text" maxlength="20" autocomplete="name" value="${esc(values.nickName || '')}"></span>`
      + `</label>`
      + `</div>`
      + `<div class="entry-signup-rule entry-signup-rule--tight"></div>`
      + `<div class="entry-error">${errorText}</div>`
      + `<div id="signup-oauth-field-hint" class="entry-signup-field-hint">&nbsp;</div>`
      + `</form>`
      + `</div>`
      + `</div>`
    );
  }

  return {
    showSignupMenu,
    showSignupAgreement,
    renderEmailScreen,
    renderOAuthProfileScreen
  };
}
