import { buildTopbarHtml } from './ansiTopbarScreen.js';

export function createAuthScreens(deps) {
  const {
    esc,
    getAuthLeafRoutePath,
    getBoardSelectTitle,
    getCommandFooterText,
    getSupportedFooterText,
    handleLoginIdSubmit,
    handleLoginSubmit,
    handlePasswordResetCancel,
    handlePasswordResetSubmit,
    mountPromptRow,
    restorePromptRow,
    screenEl,
    setFooterVisibility,
    setHint,
    setPrompt,
    setReady,
    showBoardSelect,
    showToast,
    state,
    updateURL
  } = deps;

  const LOGIN_FAILURE_LIMIT = 5;

  // [LOG: 20260425_1923] 로그인/비밀번호 찾기 화면을 ANSI topbar 기반 인증 셸로 통일
  function buildAuthTopbar(leftLabel, centerLabel) {
    const now = new Date();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const pad = (value) => String(value).padStart(2, '0');

    // [LOG: 20260427_1210] Adaptive timestamp for mobile
    const timestamp = isMobile
      ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return buildTopbarHtml({
      siteLabel: 'PC통신동호회 01410',
      timestamp,
      leftLabel,
      centerLabel,
      rightLabel: ''
    });
  }

  function renderAuthShell(options = {}) {
    const bodyClasses = [
      'entry-screen',
      'entry-screen--authlog',
      options.bodyClass || ''
    ].filter(Boolean).join(' ');

    screenEl.innerHTML = (
      `<div class="ansi-screen">` +
      buildAuthTopbar(options.leftLabel || '', options.centerLabel || '') +
      `<div class="ansi-screen-body ${bodyClasses}">` +
      (options.content || '') +
      `</div>` +
      `</div>`
    );
    // [LOG: 20260617_1005] Auth entry screens render directly and must clear loading state.
    setReady?.(true);
  }

  function renderAuthField() {
    return '';
  }

  function renderPasswordResetPromptField() {
    return '';
  }

  function renderPasswordResetTranscript(options = {}) {
    const lines = [];
    const openingLine = String(options.openingLine || '').trim();
    const notice = String(options.notice || '').trim();
    const committedLabel = String(options.committedLabel || '').trim();
    const committedValue = String(options.committedValue || '').trim();
    const followUpLine = String(options.followUpLine || '').trim();
    const duplicateUpdateNotices = ['새 비밀번호를 입력해 주십시오.', '새 비밀번호를 입력하여 주십시오.'];

    if (openingLine) {
      lines.push(openingLine);
    }
    if (committedLabel && committedValue) {
      lines.push(`${committedLabel} >> ${committedValue}`);
    }
    if (notice && !(options.isUpdateMode && duplicateUpdateNotices.includes(notice))) {
      lines.push(notice);
    }
    if (followUpLine) {
      lines.push(followUpLine);
    }

    return (
      `<div id="password-reset-transcript" class="entry-password-transcript">` +
      lines.map((line) => `<div class="entry-password-line">${esc(line)}</div>`).join('') +
      `<div class="entry-password-prompt-host" data-password-reset-prompt-host></div>` +
      `</div>`
    );
  }

  function scrollPasswordResetLineIntoView(lineEl) {
    if (!lineEl || typeof lineEl.scrollIntoView !== 'function') return;
    window.requestAnimationFrame(() => {
      lineEl.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }

  function setAuthTerminalHandler(handler) {
    state._terminalInputHandler = handler;
  }

  function clearAuthTerminalHandler(handler) {
    if (state._terminalInputHandler === handler) {
      state._terminalInputHandler = null;
    }
  }

  async function withHiddenAuthInputs(values, callback) {
    const bridge = document.createElement('div');
    bridge.hidden = true;
    bridge.setAttribute('aria-hidden', 'true');
    Object.entries(values || {}).forEach(([id, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.id = id;
      input.value = String(value || '');
      bridge.appendChild(input);
    });
    document.body.appendChild(bridge);
    try {
      return await callback();
    } finally {
      bridge.remove();
    }
  }

  function showLogin(fromHistory = false) {
    state.screen = 'login';
    const notice = String(state._loginNotice || '');
    state._loginNotice = '';
    if (!fromHistory) updateURL();
    else void updateURL(true);

    // [LOG: 20260503_2235] Login keeps only one blank terminal line before errors and disables browser autofill.
    renderAuthShell({
      leftLabel: 'LOGIN',
      centerLabel: 'ID 로그인',
      bodyClass: 'entry-screen--login',
      content:
        `<div class="entry-auth-head">'PC통신동호회 01410'에 오신 것을 환영합니다!!<br>ID가 없는 분은 '손님' 혹은 'GUEST'를 입력하십시오.</div>` +
        // [LOG: 20260622_1600] 풋터(terminal-footer)가 이미 프롬프트 위 가로 구분선을 그리므로, 본문 entry-divider는
        // 빈 transcript 위에서 풋터 선과 겹쳐 "가로줄 2개"로 보였다. 중복 제거 — 비밀번호 재설정 화면과 동일하게 풋터 선만 사용.
        `<div id="login-transcript" class="entry-login-transcript"></div>` +
        `<div id="login-prompt-host" class="entry-login-prompt-host" data-login-prompt-host></div>` +
        renderAuthField({
          id: 'l-id',
          label: '회원 ID',
          autocomplete: 'off',
          placeholder: ''
        }) +
        renderAuthField({
          id: 'l-pw',
          label: '비밀번호',
          type: 'password',
          autocomplete: 'new-password',
          rowClass: 'is-login-step-hidden'
        }) +
        `<div id="l-error" class="login-error entry-error entry-login-error-buffer">${esc(notice)}</div>` +
        ``
    });

    const loginIdEl = document.getElementById('l-id');
    if (loginIdEl) loginIdEl.focus();
    const loginIdRow = loginIdEl?.closest('.entry-auth-row') || null;
    const loginPasswordEl = document.getElementById('l-pw');
    const loginPasswordRow = loginPasswordEl?.closest('.entry-auth-row') || null;
    const loginTranscriptEl = document.getElementById('login-transcript');
    const loginPromptHost = document.getElementById('login-prompt-host');
    const setLoginPromptVisible = (isVisible) => {
      const promptRow = document.getElementById('terminal-prompt-row');
      if (!promptRow) return;
      // [LOG_ID: 20260623_1525] Keep the prompt row in layout while async login
      // validation runs. display:none removes the row height and makes the next
      // prompt jump vertically when ID validation switches to password input.
      promptRow.style.display = '';
      promptRow.style.visibility = isVisible ? '' : 'hidden';
    };
    const loginSession = {
      step: 'id',
      userId: '',
      password: ''
    };
    const resetLoginFailures = () => {
      state._loginFailureCount = 0;
    };
    const recordLoginFailure = () => {
      const count = (Number(state._loginFailureCount) || 0) + 1;
      state._loginFailureCount = count;
      return {
        count,
        reachedLimit: count >= LOGIN_FAILURE_LIMIT,
        remaining: Math.max(0, LOGIN_FAILURE_LIMIT - count)
      };
    };
    const isLoginCancelCommand = (value) => ['P', 'M', 'B'].includes(String(value || '').trim().toUpperCase());
    const leaveLoginToAuthMenu = async (message = '') => {
      resetLoginFailures();
      state._maskCommandInput = false;
      clearAuthTerminalHandler(loginInputHandler);
      restorePromptRow?.();
      // [LOG_ID: 20260623_1707] Five-failure exit can happen while the inline login
      // prompt is hidden during async validation; clear that inline visibility state
      // after returning the shared prompt row to the footer.
      setLoginPromptVisible(true);
      if (typeof setFooterVisibility === 'function') {
        setFooterVisibility(true);
      }
      if (typeof showBoardSelect === 'function') {
        await showBoardSelect('log', getBoardSelectTitle('log'));
      }
      // [LOG_ID: 20260624_0921] 메시지가 있을 때 기존에는 hint/prompt를 덮어씌워 힌트바가
      // 잘리는 문제가 있었음. 메시지는 토스트로 띄우고 메뉴의 기본 힌트바를 보존.
      if (message && typeof showToast === 'function') {
        showToast(message, 3000, 'info');
      }
    };
    const clearLoginError = () => {
      const errEl = document.getElementById('l-error');
      if (errEl) errEl.textContent = '';
    };
    const showLoginIdPrompt = () => {
      loginSession.step = 'id';
      loginSession.password = '';
      state._maskCommandInput = false;
      mountPromptRow?.(loginPromptHost);
      setLoginPromptVisible(true);
      setPrompt('회원 ID >>');
    };
    const showLoginPasswordPrompt = () => {
      loginSession.step = 'password';
      loginSession.password = '';
      state._maskCommandInput = true;
      mountPromptRow?.(loginPromptHost);
      setLoginPromptVisible(true);
      setPrompt('비밀번호 >>');
    };
    const resetPasswordStep = () => {
      if (loginPasswordEl) loginPasswordEl.value = '';
      if (loginPasswordRow) loginPasswordRow.classList.add('is-login-step-hidden');
      if (loginIdEl) loginIdEl.readOnly = false;
    };
    const revealPasswordStep = () => {
      if (loginIdRow) loginIdRow.classList.add('is-login-step-hidden');
      if (loginPasswordRow) loginPasswordRow.classList.remove('is-login-step-hidden');
      if (loginIdEl) loginIdEl.readOnly = true;
      if (loginPasswordEl) loginPasswordEl.focus();
    };
    // [LOG: 20260503_2213] Terminal-style login appends output above the next active prompt.
    const appendLoginMessage = (message) => {
      const text = String(message || '').trim();
      if (!text || !loginTranscriptEl) return;
      const line = document.createElement('div');
      line.className = 'entry-login-message';
      line.textContent = text;
      loginTranscriptEl.appendChild(line);
    };
    const appendCommittedIdLine = (userId) => {
      const text = String(userId || '').trim();
      if (!text || !loginTranscriptEl) return;
      const line = document.createElement('div');
      line.className = 'entry-login-message entry-login-committed-row';
      // [LOG_ID: 20260624_0946] Live prompt와 동일한 <input> + wrapper 구조를 사용하여 서브픽셀 렌더링 오차 완벽 해결
      line.style.display = 'flex';
      line.style.alignItems = 'baseline';
      line.style.minHeight = '1.65em';
      
      line.innerHTML = `
        <input readonly tabindex="-1" class="retro-cmd-input" style="background:transparent; border:none; outline:none; padding:0; margin:0 1ch 0 0; color:inherit; -webkit-text-fill-color:inherit; opacity:1; font:inherit; height:1.65em; width:10ch;" value="회원 ID &gt;&gt;">
        <div style="position:relative; display:flex; align-items:baseline; min-height:1.65em; flex:1; column-gap:0;">
          <input readonly tabindex="-1" class="retro-cmd-input" style="background:transparent; border:none; outline:none; padding:0; margin:0; color:inherit; -webkit-text-fill-color:inherit; opacity:1; font:inherit; height:1.65em; flex:1; transform:none;" value="${esc(text)}">
        </div>
      `;
      loginTranscriptEl.appendChild(line);
    };
    const appendCommittedPasswordLine = (password) => {
      const text = String(password || '');
      if (!text || !loginTranscriptEl) return;
      const line = document.createElement('div');
      line.className = 'entry-login-message entry-login-committed-row';
      line.style.display = 'flex';
      line.style.alignItems = 'baseline';
      line.style.minHeight = '1.65em';
      
      const stars = '*'.repeat(Array.from(text).length);
      line.innerHTML = `
        <input readonly tabindex="-1" class="retro-cmd-input" style="background:transparent; border:none; outline:none; padding:0; margin:0 1ch 0 0; color:inherit; -webkit-text-fill-color:inherit; opacity:1; font:inherit; height:1.65em; width:11ch;" value="비밀번호 &gt;&gt;">
        <div style="position:relative; display:flex; align-items:baseline; min-height:1.65em; flex:1; column-gap:0;">
          <input readonly tabindex="-1" class="retro-cmd-input" style="background:transparent; border:none; outline:none; padding:0; margin:0; color:transparent; -webkit-text-fill-color:transparent; opacity:0; text-shadow:none; font:inherit; height:1.65em; flex:1; transform:none;" value="${esc(text)}">
          <div class="retro-cmd-mask" style="position:absolute; inset:0; color:inherit; -webkit-text-fill-color:inherit; opacity:1; transform:translateY(0.2em); pointer-events:none; white-space:pre;">${stars}</div>
        </div>
      `;
      loginTranscriptEl.appendChild(line);
    };
    const appendLoginBlankLine = () => {
      // [LOG: 20260509] 로그인 실패 시 추가되는 빈 줄 제거 요청
    };
    const consumeLoginError = () => {
      const errEl = document.getElementById('l-error');
      const message = String(errEl?.textContent || '').trim();
      if (errEl) errEl.textContent = '';
      return message;
    };
    const submitLogin = async () => {
      if (loginSession.password) {
        appendCommittedPasswordLine(loginSession.password);
      }
      setLoginPromptVisible(false);
      try {
        clearLoginError();
        await withHiddenAuthInputs({
          'l-id': loginSession.userId,
          'l-pw': loginSession.password
        }, () => handleLoginSubmit());
      } catch (err) {
        appendLoginMessage(err.message);
      } finally {
        const message = consumeLoginError();
        if (message) {
          const failure = recordLoginFailure();
          if (failure.reachedLimit) {
            await leaveLoginToAuthMenu('로그인 실패가 5회 누적되어 회원가입 / 로그인 메뉴로 돌아갑니다.');
            return;
          }
          appendLoginMessage(message);
          if (loginPasswordEl) loginPasswordEl.value = '';
          if (loginPasswordRow) loginPasswordRow.classList.remove('is-login-step-hidden');
          if (loginPasswordEl) loginPasswordEl.focus();
          showLoginPasswordPrompt();
        } else {
          // [LOG_ID: 20260623_1500] Login success has already rendered main;
          // return the detached inline prompt to the shared footer.
          resetLoginFailures();
          state._maskCommandInput = false;
          clearAuthTerminalHandler(loginInputHandler);
          restorePromptRow?.();
          setLoginPromptVisible(true);
          if (typeof setFooterVisibility === 'function') {
            setFooterVisibility(true);
          }
          setPrompt('>>');
        }
      }
    };

    if (loginIdEl) {
      // [LOG: 20260503_2135] Login uses a PC통신-style ID -> password Enter flow with no action buttons.
      loginIdEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        resetPasswordStep();
        const currentId = loginIdEl.value.trim();
        if (isLoginCancelCommand(currentId)) {
          await leaveLoginToAuthMenu();
          return;
        }
        const normalizedId = currentId.toLowerCase();
        if (normalizedId === 'guest' || currentId === '손님') {
          await submitLogin();
          return;
        }
        if (!currentId) {
          clearLoginError();
          loginIdEl.focus();
          return;
        }
        const idAccepted = typeof handleLoginIdSubmit === 'function'
          ? await handleLoginIdSubmit(currentId)
          : true;
        if (idAccepted) {
          appendCommittedIdLine(currentId);
          revealPasswordStep();
          return;
        }
        const message = consumeLoginError();
        if (message) {
          const failure = recordLoginFailure();
          if (failure.reachedLimit) {
            await leaveLoginToAuthMenu('로그인 실패가 5회 누적되어 회원가입 / 로그인 메뉴로 돌아갑니다.');
            return;
          }
          appendCommittedIdLine(currentId);
          appendLoginBlankLine();
          appendLoginMessage(message);
        }
        loginIdEl.value = '';
        loginIdEl.focus();
      });
    }

    if (loginPasswordEl) {
      loginPasswordEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (isLoginCancelCommand(loginPasswordEl.value)) {
          await leaveLoginToAuthMenu();
          return;
        }
        await submitLogin();
      });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitLogin();
      });
    }

    // [LOG: 20260509_1115] Login consumes the shared bottom #cmd-input through a screen-guarded state machine.
    async function loginInputHandler(raw) {
      if (state.screen !== 'login') return false;
      if (loginSession.step === 'password') {
        const password = String(raw || '');
        if (isLoginCancelCommand(password)) {
          await leaveLoginToAuthMenu();
          return true;
        }
        if (!password) {
          showLoginPasswordPrompt();
          return true;
        }
        loginSession.password = password;
        await submitLogin();
        return true;
      }

      const currentId = String(raw || '').trim();
      loginSession.password = '';
      if (isLoginCancelCommand(currentId)) {
        await leaveLoginToAuthMenu();
        return true;
      }
      const normalizedId = currentId.toLowerCase();
      loginSession.userId = currentId;
      if (normalizedId === 'guest' || currentId === '손님') {
        await submitLogin();
        return true;
      }
      if (!currentId) {
        clearLoginError();
        showLoginIdPrompt();
        return true;
      }
      // [LOG_ID: 20260623_1440] Freeze the submitted line synchronously before
      // async validation so the text never disappears then reappears.
      appendCommittedIdLine(currentId);
      setLoginPromptVisible(false);
      const idAccepted = typeof handleLoginIdSubmit === 'function'
        ? await withHiddenAuthInputs({ 'l-id': currentId }, () => handleLoginIdSubmit(currentId))
        : true;
      if (idAccepted) {
        showLoginPasswordPrompt();
        return true;
      }
      const message = consumeLoginError();
      if (message) {
        const failure = recordLoginFailure();
        if (failure.reachedLimit) {
          await leaveLoginToAuthMenu('로그인 실패가 5회 누적되어 회원가입 / 로그인 메뉴로 돌아갑니다.');
          return true;
        }
        appendLoginBlankLine();
        appendLoginMessage(message);
      }
      loginSession.userId = '';
      showLoginIdPrompt();
      return true;
    }

    setAuthTerminalHandler(loginInputHandler);
    if (typeof setFooterVisibility === 'function') {
      setFooterVisibility(true);
    }
    // [LOG: 20260622_1720] 로그인 화면은 명령 힌트바를 띄우지 않는다. showLogin은 applyCommandFooter/setHint를
    // 호출하지 않아, 직전 화면(예: /log 인증메뉴 'P,T,GO,H')의 힌트가 그대로 남는 누수가 있었다. 명시적으로 비운다.
    if (typeof setHint === 'function') {
      // [LOG_ID: 20260623_1330] A blank hint sets the terminal back to loading;
      // use one spacer so the completed login prompt can show its block cursor.
      setHint(' ');
    }
    showLoginIdPrompt();
  }

  function showPasswordReset(fromHistory = false, mode = state._passwordRecoveryActive ? 'update' : 'request', options = {}) {
    state.screen = 'password-reset';
    state._passwordResetMode = mode === 'update' ? 'update' : 'request';
    if (Object.prototype.hasOwnProperty.call(options, 'value')) {
      state._passwordResetValue = String(options.value || '');
    }
    if (Object.prototype.hasOwnProperty.call(options, 'notice')) {
      state._passwordResetNotice = String(options.notice || '');
    }
    if (!fromHistory) updateURL();
    else void updateURL(true);

    const isUpdateMode = state._passwordResetMode === 'update';
    const notice = String(state._passwordResetNotice || '').trim();
    const requestSubmittedValue = !isUpdateMode && notice
      ? String(state._passwordResetValue || '').trim()
      : '';
    const isPasswordResetSentNotice = notice === '재설정 안내 메일을 전송했습니다.';

    renderAuthShell({
      leftLabel: 'PASSWORD',
      centerLabel: isUpdateMode ? '새 비밀번호 설정' : '비밀번호 찾기',
      bodyClass: 'entry-screen--password-reset',
      content: isUpdateMode
        ? (
          renderPasswordResetTranscript({
            openingLine: '새 비밀번호를 입력하여 주십시오.',
            notice,
            isUpdateMode
          }) +
          renderPasswordResetPromptField({
            id: 'pw-reset-pw',
            label: '새 비밀번호',
            type: 'password',
            autocomplete: 'new-password'
          }) +
          renderPasswordResetPromptField({
            id: 'pw-reset-pw-confirm',
            label: '비밀번호 확인',
            type: 'password',
            autocomplete: 'new-password',
            hidden: true
          }) +
          `<div id="pw-reset-message" class="login-error entry-error entry-password-hidden-message"></div>` +
          ``
        )
        : (
          renderPasswordResetTranscript({
            openingLine: '등록한 이메일 또는 아이디를 입력하여 주십시오.',
            notice,
            committedLabel: requestSubmittedValue ? '이메일/아이디' : '',
            committedValue: requestSubmittedValue,
            followUpLine: isPasswordResetSentNotice ? '메일의 비밀번호 재설정 링크를 열어 새 비밀번호를 설정해 주십시오.' : ''
          }) +
          (isPasswordResetSentNotice ? '' : renderPasswordResetPromptField({
            id: 'pw-reset-id',
            label: '이메일/아이디',
            autocomplete: 'username',
            value: requestSubmittedValue ? '' : state._passwordResetValue || ''
          })) + // [LOG: 20260509_1108] 메일 발송 성공 후에는 같은 이메일/아이디 프롬프트를 다시 열지 않는다.
          `<div id="pw-reset-message" class="login-error entry-error entry-password-hidden-message"></div>` +
          ``
        )
    });

    if (typeof setHint === 'function') {
      // [LOG: 20260509_1154] 비밀번호 찾기는 입력 프롬프트만 사용하므로 직전 메뉴의 명령 힌트를 지운다.
      setHint(' ');
    }

    const resetForm = document.getElementById('password-reset-form');
    const resetTranscriptEl = document.getElementById('password-reset-transcript');
    const passwordResetMessageEl = document.getElementById('pw-reset-message');
    const requestInputEl = document.getElementById('pw-reset-id');
    const passwordInputEl = document.getElementById('pw-reset-pw');
    const confirmInputEl = document.getElementById('pw-reset-pw-confirm');
    const requestRow = requestInputEl?.closest('.entry-password-prompt-row') || null;
    const passwordRow = passwordInputEl?.closest('.entry-password-prompt-row') || null;
    const confirmRow = confirmInputEl?.closest('.entry-password-prompt-row') || null;
    let passwordResetSubmitting = false;
    const passwordResetSession = {
      step: isUpdateMode ? 'new-password' : 'request-id',
      requestValue: requestSubmittedValue || String(state._passwordResetValue || ''),
      password: '',
      confirmPassword: ''
    };

    const isPasswordResetCancelCommand = (value) => ['P', 'M', 'B'].includes(String(value || '').trim().toUpperCase());
    const isPasswordResetSuccessMessage = (message) => String(message || '').trim() === '재설정 안내 메일을 전송했습니다.';
    const resetScreenStillMounted = () => state.screen === 'password-reset' && Boolean(resetTranscriptEl) && screenEl.contains(resetTranscriptEl);
    const getPasswordResetPromptHost = () => resetTranscriptEl?.querySelector?.('[data-password-reset-prompt-host]') || null;
    const mountPasswordResetPromptRow = () => {
      const promptHost = getPasswordResetPromptHost();
      if (promptHost && typeof mountPromptRow === 'function') {
        mountPromptRow(promptHost);
        setPasswordResetPromptVisible(true);
        return;
      }
      restorePromptRow?.();
    };
    const setPasswordResetPromptVisible = (isVisible) => {
      const promptRow = document.getElementById('terminal-prompt-row');
      if (promptRow) {
        promptRow.style.display = isVisible ? '' : 'none';
      }
    };
    const setPasswordResetRowVisible = (row, isVisible) => {
      if (row) row.hidden = !isVisible;
    };
    const appendPasswordResetTranscriptNode = (line) => {
      const promptHost = getPasswordResetPromptHost();
      if (promptHost?.parentElement === resetTranscriptEl) {
        resetTranscriptEl.insertBefore(line, promptHost);
      } else {
        resetTranscriptEl.appendChild(line);
      }
      scrollPasswordResetLineIntoView(line);
    };
    const appendPasswordResetLine = (message) => {
      const text = String(message || '').trim();
      if (!text || !resetTranscriptEl || !resetScreenStillMounted()) return;
      const line = document.createElement('div');
      line.className = 'entry-password-line';
      line.textContent = text;
      appendPasswordResetTranscriptNode(line);
    };
    const appendCommittedPasswordResetLine = (label, value, shouldMask = false) => {
      const text = String(value || '');
      if (!text || !resetTranscriptEl || !resetScreenStillMounted()) return;
      const displayValue = shouldMask ? '*'.repeat(Array.from(text).length) : text;
      const line = document.createElement('div');
      line.className = 'entry-password-line entry-password-committed-line';
      line.textContent = `${label} >> ${displayValue}`;
      appendPasswordResetTranscriptNode(line);
    };
    const setPasswordResetPromptForStep = () => {
      mountPasswordResetPromptRow();
      setPasswordResetPromptVisible(true);
      if (passwordResetSession.step === 'new-password') {
        state._maskCommandInput = true;
        setPrompt('새 비밀번호 >>');
        return;
      }
      if (passwordResetSession.step === 'confirm-password') {
        state._maskCommandInput = true;
        setPrompt('비밀번호 확인 >>');
        return;
      }
      state._maskCommandInput = false;
      setPrompt('이메일/아이디 >>');
    };
    const clearPasswordResetMessage = () => {
      const messageEl = document.getElementById('pw-reset-message') || passwordResetMessageEl;
      if (messageEl) messageEl.textContent = '';
    };
    const consumePasswordResetMessage = () => {
      const messageEl = document.getElementById('pw-reset-message') || passwordResetMessageEl;
      const message = String(messageEl?.textContent || '').trim();
      if (messageEl) messageEl.textContent = '';
      return message;
    };
    const leavePasswordReset = async () => {
      state._maskCommandInput = false;
      clearAuthTerminalHandler(passwordResetInputHandler);
      restorePromptRow?.();
      if (typeof setFooterVisibility === 'function') {
        setFooterVisibility(true);
      }
      await handlePasswordResetCancel();
      setPrompt('>>');
    };
    const submitPasswordResetThroughRuntime = async () => {
      if (passwordResetSubmitting) return '';
      passwordResetSubmitting = true;
      try {
        clearPasswordResetMessage();
        await withHiddenAuthInputs({
          'pw-reset-id': passwordResetSession.requestValue,
          'pw-reset-pw': passwordResetSession.password,
          'pw-reset-pw-confirm': passwordResetSession.confirmPassword
        }, () => handlePasswordResetSubmit());
        return consumePasswordResetMessage();
      } finally {
        passwordResetSubmitting = false;
      }
    };
    const hidePasswordResetPrompt = () => {
      state._maskCommandInput = false;
      clearAuthTerminalHandler(passwordResetInputHandler);
      setPasswordResetPromptVisible(false);
      if (typeof setFooterVisibility === 'function') {
        setFooterVisibility(false);
      }
      setPrompt('');
    };
    const handleRequestPasswordReset = async (rawValue = null) => {
      if (passwordResetSubmitting) return;
      const value = rawValue === null
        ? requestInputEl?.value.trim()
        : String(rawValue || '').trim();
      if (isPasswordResetCancelCommand(value)) {
        await leavePasswordReset();
        return;
      }
      if (!value) {
        passwordResetSession.step = 'request-id';
        setPasswordResetPromptForStep();
        if (requestInputEl) requestInputEl.focus();
        return;
      }

      passwordResetSession.requestValue = value;
      appendCommittedPasswordResetLine('이메일/아이디', value);
      setPasswordResetRowVisible(requestRow, false);
      setPasswordResetPromptVisible(false); // [LOG: 20260509_1304] 제출된 입력 줄 아래에 빈 프롬프트가 겹치지 않게 처리 중에는 숨긴다.
      const message = await submitPasswordResetThroughRuntime();
      if (message && resetScreenStillMounted()) {
        appendPasswordResetLine(message);
        if (isPasswordResetSuccessMessage(message)) {
          appendPasswordResetLine('메일의 비밀번호 재설정 링크를 열어 새 비밀번호를 설정해 주십시오.'); // [LOG: 20260509_1251] 성공 안내는 현재 transcript 아래에 이어 출력하고 영문 링크명을 노출하지 않는다.
          hidePasswordResetPrompt();
          return;
        }
        passwordResetSession.requestValue = '';
        if (requestInputEl) requestInputEl.value = '';
        setPasswordResetRowVisible(requestRow, true);
        passwordResetSession.step = 'request-id';
        setPasswordResetPromptVisible(true);
        setPasswordResetPromptForStep();
        if (requestInputEl) requestInputEl.focus();
      }
    };
    const handleNewPasswordEntry = async (rawValue = null) => {
      if (passwordResetSubmitting) return;
      const password = rawValue === null
        ? passwordInputEl?.value
        : String(rawValue || '');
      if (isPasswordResetCancelCommand(password)) {
        await leavePasswordReset();
        return;
      }
      if (!password) {
        passwordResetSession.step = 'new-password';
        setPasswordResetPromptForStep();
        if (passwordInputEl) passwordInputEl.focus();
        return;
      }

      passwordResetSession.password = password;
      appendCommittedPasswordResetLine('새 비밀번호', password, true);
      setPasswordResetPromptVisible(false);
      if (Array.from(password).length < 6) {
        appendPasswordResetLine('비밀번호는 6자 이상이어야 합니다.');
        passwordResetSession.password = '';
        if (passwordInputEl) passwordInputEl.value = '';
        setPasswordResetRowVisible(passwordRow, true);
        passwordResetSession.step = 'new-password';
        setPasswordResetPromptVisible(true);
        setPasswordResetPromptForStep();
        if (passwordInputEl) passwordInputEl.focus();
        return;
      }

      setPasswordResetRowVisible(passwordRow, false);
      setPasswordResetRowVisible(confirmRow, true);
      passwordResetSession.step = 'confirm-password';
      setPasswordResetPromptVisible(true);
      setPasswordResetPromptForStep();
      if (confirmInputEl) {
        confirmInputEl.value = '';
        confirmInputEl.focus();
      }
    };
    const handleConfirmPasswordEntry = async (rawValue = null) => {
      if (passwordResetSubmitting) return;
      const confirmPassword = rawValue === null
        ? confirmInputEl?.value
        : String(rawValue || '');
      if (isPasswordResetCancelCommand(confirmPassword)) {
        await leavePasswordReset();
        return;
      }
      if (!confirmPassword) {
        passwordResetSession.step = 'confirm-password';
        setPasswordResetPromptForStep();
        if (confirmInputEl) confirmInputEl.focus();
        return;
      }

      passwordResetSession.confirmPassword = confirmPassword;
      appendCommittedPasswordResetLine('비밀번호 확인', confirmPassword, true);
      setPasswordResetPromptVisible(false);
      if (passwordResetSession.password !== confirmPassword) {
        appendPasswordResetLine('비밀번호 확인이 일치하지 않습니다.');
        passwordResetSession.confirmPassword = '';
        if (confirmInputEl) confirmInputEl.value = '';
        setPasswordResetRowVisible(confirmRow, true);
        passwordResetSession.step = 'confirm-password';
        setPasswordResetPromptVisible(true);
        setPasswordResetPromptForStep();
        if (confirmInputEl) confirmInputEl.focus();
        return;
      }

      setPasswordResetRowVisible(confirmRow, false);
      const message = await submitPasswordResetThroughRuntime();
      if (message && resetScreenStillMounted()) {
        appendPasswordResetLine(message);
        passwordResetSession.password = '';
        passwordResetSession.confirmPassword = '';
        if (passwordInputEl) passwordInputEl.value = '';
        if (confirmInputEl) confirmInputEl.value = '';
        setPasswordResetRowVisible(passwordRow, true);
        setPasswordResetRowVisible(confirmRow, false);
        passwordResetSession.step = 'new-password';
        setPasswordResetPromptVisible(true);
        setPasswordResetPromptForStep();
        if (passwordInputEl) passwordInputEl.focus();
      }
    };
    async function passwordResetInputHandler(raw) {
      if (state.screen !== 'password-reset') return false;
      if (passwordResetSession.step === 'new-password') {
        await handleNewPasswordEntry(raw);
        return true;
      }
      if (passwordResetSession.step === 'confirm-password') {
        await handleConfirmPasswordEntry(raw);
        return true;
      }
      await handleRequestPasswordReset(raw);
      return true;
    }

    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isUpdateMode) {
          if (confirmRow && !confirmRow.hidden) {
            await handleConfirmPasswordEntry();
            return;
          }
          await handleNewPasswordEntry();
          return;
        }
        await handleRequestPasswordReset();
      });
    }

    if (requestInputEl) {
      requestInputEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await handleRequestPasswordReset();
      });
    }

    if (passwordInputEl) {
      passwordInputEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await handleNewPasswordEntry();
      });
    }

    if (confirmInputEl) {
      confirmInputEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        await handleConfirmPasswordEntry();
      });
    }

    if (isPasswordResetSentNotice) {
      hidePasswordResetPrompt();
      return;
    }

    setAuthTerminalHandler(passwordResetInputHandler);
    if (typeof setFooterVisibility === 'function') {
      setFooterVisibility(true);
    }
    mountPasswordResetPromptRow();
    setPasswordResetPromptForStep();
    const focusTarget = isUpdateMode ? passwordInputEl : requestInputEl;
    if (focusTarget) focusTarget.focus();
  }

  return {
    showLogin,
    showPasswordReset
  };
}
