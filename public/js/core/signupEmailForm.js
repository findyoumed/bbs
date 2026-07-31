import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { convertHangulToKeyboardText } from './hangulKeyboard.js';

const STEP_CONFIG = [
  {
    fieldId: 'signup-userid',
    key: 'userId',
    prompt: '>> ',
    masked: false,
    guideLines: [
      '1. 회원ID를 입력해주세요. (영문/숫자/_ 3~20자 가능)'
    ]
  },
  {
    fieldId: 'signup-password',
    key: 'password',
    prompt: '>> ',
    masked: true,
    guideLines: [
      '2. 비밀번호를 입력해주세요. (6자 이상, 특수문자 1자 이상 포함)'
    ]
  },
  {
    fieldId: 'signup-password-confirm',
    key: 'passwordConfirm',
    prompt: '>> ',
    masked: true,
    guideLines: [
      '3. 비밀번호 확인을 입력해주세요.'
    ]
  },
  {
    fieldId: 'signup-nickname',
    key: 'nickName',
    prompt: '>> ',
    masked: false,
    guideLines: [
      '4. 닉네임을 입력하세요. (2~20자 가능)'
    ]
  },
  {
    fieldId: 'signup-email',
    key: 'email',
    prompt: '>> ',
    masked: false,
    guideLines: [
      '5. 이메일 주소를 입력하세요.',
      '   비밀번호 분실시 사용되니 정확하게 입력하세요.'
    ]
  }
];

const FIELD_ID_BY_PRECHECK_FIELD = {
  userId: 'signup-userid',
  nickName: 'signup-nickname',
  email: 'signup-email'
};

const CONFIRM_STAGE_ID = 'signup-confirm';
const CONFIRM_PROMPT_TEXT = '수정 항목이 있습니까? (번호 1~5 / n)';
const CONFIRM_FIELD_IDS = {
  '1': 'signup-userid',
  '2': 'signup-password',
  '3': 'signup-password-confirm',
  '4': 'signup-nickname',
  '5': 'signup-email'
};
const SIGNUP_CANCEL_LINE = '입력란에 p 를 입력하면 가입을 중단합니다.'; // [LOG: 20260729_1645] /p → p 수정
const ENGLISH_KEYBOARD_STAGE_IDS = new Set(['signup-userid', 'signup-password', 'signup-password-confirm', 'signup-email']);

function getStepConfig(fieldId) {
  return STEP_CONFIG.find((step) => step.fieldId === fieldId) || STEP_CONFIG[0];
}

function maskValue(value) {
  const length = Math.max(1, String(value || '').length);
  return '*'.repeat(length);
}

function formatInputLine(fieldId, value) {
  const step = getStepConfig(fieldId);
  const text = step.masked ? maskValue(value) : String(value || '');
  // [LOG_ID: 20260623_1355] The active prompt trims its own trailing space and
  // uses CSS for one cell of separation; submitted text must use that same gap.
  return `${String(step.prompt || '').trimEnd()} ${text}`.trimEnd();
}

function isEnglishKeyboardStage(fieldId) {
  return ENGLISH_KEYBOARD_STAGE_IDS.has(String(fieldId || '').trim());
}

function sanitizeEnglishKeyboardInput(fieldId, value) {
  const converted = convertHangulToKeyboardText(value);
  if (fieldId === 'signup-userid') {
    // [LOG: 20260729_1616] 아이디는 소문자 영문/숫자/_만 허용. 대문자는 소문자로 자동 변환, 한글은 키보드 영문으로 변환 후 필터.
    return converted.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  }
  if (fieldId === 'signup-password' || fieldId === 'signup-password-confirm') {
    return converted.replace(/[^\x21-\x7E]/g, '');
  }
  if (fieldId === 'signup-email') {
    // [LOG_ID: 20260716_1709] 이메일도 다른 영문 단계(userid)와 동일하게 한글 자판 입력을
    // QWERTY로 되돌린 뒤(converted) 이메일 허용 문자만 남긴다. 종전엔 raw value를 바로
    // 필터링해, 한글 IME 모드로 이메일을 치면 눌린 영문키(예: "gmail"→"ㅎ마일")가 변환되지
    // 못하고 통째로 지워지거나 이상하게 남았다("한글 입력 시 이상하게 표기" 보고).
    return converted.replace(/[^A-Za-z0-9_@.-]/g, '');
  }
  return String(value || '');
}

function isValidUserId(value) {
  // [LOG: 20260729_1616] 아이디는 소문자 영문/숫자/_만 허용. 대문자는 입력 시 이미 소문자로 변환됨.
  // [LOG: 20260731_2400] {5,40} → {3,20}: 서버 register/precheck/oauthRegister 모두
  // /^[a-zA-Z0-9_]{3,20}$/ 를 쓰는데 여기서만 {5,40}이라 21~40자 아이디는 이 검사를
  // 통과하고, 40자 가이드를 보고 입력한 사용자가 서버 precheck에서 "형식 오류"로 거절당했다.
  return /^[a-z0-9_]{3,20}$/.test(value);
}

function isStrongPassword(value) {
  return value.length >= 6 && /[^A-Za-z0-9]/.test(value);
}

function isValidNickname(value) {
  // [LOG: 20260731_2400] 서버 세 엔드포인트(register/precheck/oauthRegister) 모두
  // nickName: { minLength: 2, maxLength: 20 } — ASCII/한글 구분 없는 단순 문자 수.
  // 종전 구현은 ASCII를 최대 40자, 한글을 최대 20자로 구분했고 최소값 검사가 없었다.
  // → 1자 닉네임이 클라이언트를 통과해 서버 precheck에서 거부되거나,
  //   ASCII 21~40자 닉네임이 "영문 40자 가능" 가이드를 믿고 입력한 사용자를 서버 400으로 놀라게 했다.
  // signupFlowSubmit.js(line 39)는 이미 length < 2 || length > 20 으로 올바르게 구현됨.
  if (!value) {
    return false;
  }
  return value.length >= 2 && value.length <= 20;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createSignupEmailHandler(deps) {
  const {
    cleanupSignupHandlers,
    cmdInput,
    hintEl,
    mountPromptRow,
    precheckSignup,
    renderEmailScreen,
    restorePromptRow,
    searchMember,
    setFooterVisibility,
    setPendingSignupDraft,
    setPendingSignupMethod,
    setPrompt,
    setSignupAgreementAccepted,
    showMain,
    state,
    updateURL,
    getPendingSignupDraft,
    getSignupEmailStage,
    setSignupEmailStage,
    clearSignupEmailStage,
    getSignupEmailTranscript,
    setSignupEmailTranscript,
    appendSignupEmailTranscript,
    clearSignupEmailTranscript
  } = deps;
  let englishInputGuardAttached = false;

  function ensureFooterReady() {
    if (typeof setFooterVisibility === 'function') {
      setFooterVisibility(true);
    }
    if (hintEl) {
      hintEl.innerHTML = '';
      hintEl.classList.remove('has-cmd-tokens', 'is-expanded');
    }
    const promptRowEl = document.getElementById('terminal-prompt-row');
    if (promptRowEl) {
      promptRowEl.style.display = '';
    }
  }

  function mountSignupEmailPromptRow() {
    // [LOG: 20260508_1615] Keep signup email prompts inline with the terminal transcript.
    const promptHost = document.querySelector('[data-signup-email-prompt-host]');
    if (promptHost && typeof mountPromptRow === 'function') {
      mountPromptRow(promptHost);
      return;
    }

    restorePromptRow?.();
  }

  function restoreSignupEmailPromptRow() {
    restorePromptRow?.();
    applyEnglishInputMode('');
  }

  function syncMaskedInputDisplay() {
    if (cmdInput && typeof CustomEvent === 'function') {
      cmdInput.dispatchEvent(new CustomEvent('bbs:mask-state-change'));
    }
  }

  // [LOG_ID: 20260717_1200] 한글 IME가 조합 중일 때 value를 건드리면 안 된다 — 조합의 기준이
  // 발밑에서 바뀌어 글자가 씹히거나 중복된다("아이디 칸에 입력이 잘 안 된다" 사용자 보고).
  // 종전엔 'input' 리스너가 조합 진행 중에도 매 글자 발동해 cmdInput.value를 통째로 갈아끼웠다.
  // (applyEnglishInputMode의 style.imeMode='inactive'는 크롬이 무시하는 비표준 속성이라
  //  IME가 꺼지지 않는다 — 조합은 실제로 일어난다.)
  // 조합 중에는 손대지 않고, 조합이 끝난 뒤(compositionend)에 한 번에 정리한다.
  function sanitizeCurrentCommandInput(event) {
    if (!cmdInput) {
      return;
    }

    // event.isComposing 은 조합 중인 input 이벤트에서 true. compositionend 에서는 false다.
    if (event && event.isComposing) {
      return;
    }

    const stage = getSignupEmailStage();
    if (!isEnglishKeyboardStage(stage)) {
      return;
    }

    const before = cmdInput.value || '';
    const after = sanitizeEnglishKeyboardInput(stage, before);
    if (after === before) {
      return;
    }

    const selectionStart = typeof cmdInput.selectionStart === 'number' ? cmdInput.selectionStart : after.length;
    cmdInput.value = after;
    if (typeof cmdInput.setSelectionRange === 'function') {
      const nextCaret = Math.max(0, Math.min(after.length, selectionStart + after.length - before.length));
      cmdInput.setSelectionRange(nextCaret, nextCaret);
    }
    syncMaskedInputDisplay();
  }

  function ensureEnglishInputGuard() {
    if (!cmdInput || englishInputGuardAttached) {
      return;
    }

    cmdInput.addEventListener('input', sanitizeCurrentCommandInput);
    // compositionend 는 브라우저가 value를 확정한 뒤에 온다. 다만 크롬은 compositionend 시점에
    // 아직 확정 문자를 value에 반영하기 전인 경우가 있어, 다음 틱에 한 번 더 정리한다.
    cmdInput.addEventListener('compositionend', (event) => {
      sanitizeCurrentCommandInput(event);
      window.setTimeout(() => sanitizeCurrentCommandInput(), 0);
    });
    englishInputGuardAttached = true;
  }

  function applyEnglishInputMode(fieldId) {
    if (!cmdInput) {
      return;
    }

    if (isEnglishKeyboardStage(fieldId)) {
      // [LOG: 20260508_1633] Signup ID/password fields stay on English keyboard text.
      ensureEnglishInputGuard();
      cmdInput.dataset.latinOnly = 'true';
      cmdInput.inputMode = 'latin';
      cmdInput.setAttribute('inputmode', 'latin');
      cmdInput.setAttribute('lang', 'en');
      cmdInput.setAttribute('autocapitalize', 'none');
      cmdInput.style.imeMode = 'inactive';
      sanitizeCurrentCommandInput();
      return;
    }

    delete cmdInput.dataset.latinOnly;
    cmdInput.inputMode = 'text';
    cmdInput.setAttribute('inputmode', 'text');
    cmdInput.removeAttribute('lang');
    cmdInput.removeAttribute('autocapitalize');
    cmdInput.style.imeMode = '';
  }

  function decorateConfirmPromptLabel() {
    const promptLabel = document.getElementById('cmd-prompt');
    if (!promptLabel) {
      return;
    }

    promptLabel.classList.add('signup-confirm-prompt-label');
    promptLabel.textContent = '';
    promptLabel.append(document.createTextNode('수정 항목이 있습니까? (번호 1~5 / '));

    const defaultChoice = document.createElement('span');
    defaultChoice.className = 'cmd-token cmd-clickable signup-confirm-default-choice';
    defaultChoice.dataset.signupChoice = 'n';
    defaultChoice.dataset.tip = 'n';
    defaultChoice.textContent = 'n';
    promptLabel.append(defaultChoice);
    promptLabel.append(document.createTextNode(')'));
  }

  function focusCommandInputAtEnd() {
    if (!cmdInput) {
      return;
    }

    if (shouldAutoFocusCommandInput()) cmdInput.focus();
    if (typeof cmdInput.setSelectionRange !== 'function') {
      return;
    }

    const caretPosition = cmdInput.value.length;
    cmdInput.setSelectionRange(caretPosition, caretPosition);
    window.setTimeout(() => {
      cmdInput.setSelectionRange(caretPosition, caretPosition);
    }, 0);
  }

  function renderSubmittedInput(fieldId, value) {
    // [LOG: 20260508_1726] During async checks, show only the submitted transcript line, not a fresh blank prompt.
    appendCurrentInput(fieldId, value);
    renderEmailScreen();
  }

  function setStagePrompt(fieldId) {
    const step = fieldId === CONFIRM_STAGE_ID
      ? { prompt: CONFIRM_PROMPT_TEXT, masked: false }
      : getStepConfig(fieldId);
    state._maskCommandInput = Boolean(step.masked);
    setPrompt(step.prompt);
    mountSignupEmailPromptRow();
    applyEnglishInputMode(fieldId);
    if (fieldId === CONFIRM_STAGE_ID) {
      // [LOG: 20260508_1648] Signup confirmation prompt keeps default "n" inline and clickable.
      decorateConfirmPromptLabel();
    } else {
      document.getElementById('cmd-prompt')?.classList.remove('signup-confirm-prompt-label');
    }
    if (cmdInput) {
      cmdInput.value = fieldId === CONFIRM_STAGE_ID ? 'n' : '';
      focusCommandInputAtEnd();
    }
  }

  function getTranscript() {
    return getSignupEmailTranscript();
  }

  function getLastTranscriptText() {
    const transcript = getTranscript();
    for (let index = transcript.length - 1; index >= 0; index -= 1) {
      const text = String(transcript[index] ?? '').trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  function appendLines(lines = []) {
    lines.forEach((line) => appendSignupEmailTranscript(line));
  }

  function appendGuideLines(lines = []) {
    lines.forEach((line) => {
      const text = String(line ?? '');
      if (!text.trim() || getLastTranscriptText() === text.trim()) {
        return;
      }
      appendSignupEmailTranscript(text);
    });
  }

  function appendGuideForStage(fieldId, messageLines = []) {
    if (fieldId === CONFIRM_STAGE_ID) {
      appendLines(messageLines);
    } else {
      appendGuideLines(getStepConfig(fieldId).guideLines);
      appendLines(messageLines);
    }
  }

  function initializeTranscript(fieldId) {
    setSignupEmailTranscript([SIGNUP_CANCEL_LINE]);
    appendGuideForStage(fieldId);
  }

  function appendCurrentInput(fieldId, value) {
    appendSignupEmailTranscript(formatInputLine(fieldId, value));
  }

  function moveToStage(fieldId, draft = {}, messageLines = []) {
    setPendingSignupDraft(draft);
    setSignupEmailStage(fieldId);
    appendGuideForStage(fieldId, messageLines);
    renderEmailScreen();
    setStagePrompt(fieldId);
  }

  function deriveStageFromDraft(draft = {}) {
    if (!String(draft.userId || '').trim()) {
      return 'signup-userid';
    }
    if (!String(draft.password || '').trim()) {
      return 'signup-password';
    }
    if (draft.passwordConfirmed !== true) {
      return 'signup-password-confirm';
    }
    if (!String(draft.nickName || '').trim()) {
      return 'signup-nickname';
    }
    if (!String(draft.email || '').trim()) {
      return 'signup-email';
    }
    return CONFIRM_STAGE_ID;
  }

  function pruneDraftForField(fieldId, draft = {}) {
    if (fieldId === 'signup-userid') {
      return {};
    }
    if (fieldId === 'signup-password') {
      return { userId: draft.userId || '' };
    }
    if (fieldId === 'signup-password-confirm') {
      return {
        userId: draft.userId || '',
        password: draft.password || ''
      };
    }
    if (fieldId === 'signup-nickname') {
      return {
        userId: draft.userId || '',
        password: draft.password || '',
        passwordConfirmed: draft.passwordConfirmed === true
      };
    }
    if (fieldId === 'signup-email') {
      return {
        userId: draft.userId || '',
        password: draft.password || '',
        passwordConfirmed: draft.passwordConfirmed === true,
        nickName: draft.nickName || ''
      };
    }
    return { ...draft };
  }

  async function runDuplicateCheck(values) {
    if (typeof precheckSignup === 'function') {
      await precheckSignup(values.userId, values.nickName, values.email);
      return;
    }

    let member = await searchMember({ userId: values.userId });
    if (member) {
      const error = new Error('이미 사용 중인 ID입니다.');
      error.fieldId = 'signup-userid';
      throw error;
    }

    member = await searchMember({ nickName: values.nickName });
    if (member) {
      const error = new Error('이미 사용 중인 닉네임입니다.');
      error.fieldId = 'signup-nickname';
      throw error;
    }

    member = await searchMember({ email: values.email });
    if (member) {
      const error = new Error('이미 가입한 이메일입니다. 로그인 또는 비밀번호 찾기를 이용해 주십시오.');
      error.fieldId = 'signup-email';
      throw error;
    }
  }

  async function runFieldAvailabilityCheck(fieldId, values = {}) {
    const userId = String(values.userId || '').trim();
    const nickName = String(values.nickName || '').trim();
    const email = String(values.email || '').trim();

    if (typeof precheckSignup === 'function') {
      await precheckSignup(
        fieldId === 'signup-userid' || fieldId === 'signup-nickname' || fieldId === 'signup-email' ? userId : '',
        fieldId === 'signup-nickname' || fieldId === 'signup-email' ? nickName : '',
        fieldId === 'signup-email' ? email : ''
      );
      return;
    }

    if (fieldId === 'signup-userid' && userId && typeof searchMember === 'function') {
      const member = await searchMember({ userId });
      if (member) {
        const error = new Error('이미 사용 중인 ID입니다.');
        error.fieldId = 'signup-userid';
        throw error;
      }
    }

    if (fieldId === 'signup-nickname' && nickName && typeof searchMember === 'function') {
      const member = await searchMember({ nickName });
      if (member) {
        const error = new Error('이미 사용 중인 닉네임입니다.');
        error.fieldId = 'signup-nickname';
        throw error;
      }
    }

    if (fieldId === 'signup-email' && email && typeof searchMember === 'function') {
      const member = await searchMember({ email });
      if (member) {
        const error = new Error('이미 가입된 이메일입니다. 로그인 또는 비밀번호 찾기를 이용해 주십시오.');
        error.fieldId = 'signup-email';
        throw error;
      }
    }
  }

  function handleAvailabilityError(error, currentFieldId, values = {}) {
    const fieldId = error.fieldId || FIELD_ID_BY_PRECHECK_FIELD[error.field] || currentFieldId;
    const message = error.message || '가입 정보를 확인하지 못했습니다.';

    if (fieldId !== currentFieldId) {
      moveToStage(fieldId, pruneDraftForField(fieldId, values), [message]);
      return;
    }

    appendSignupEmailTranscript(message);
    renderEmailScreen();
    setStagePrompt(currentFieldId);
  }

  async function completeDraft(handlers, values) {
    appendGuideForStage(CONFIRM_STAGE_ID, ['가입 정보를 확인하고 있습니다.']);

    const promptRow = document.getElementById('terminal-prompt-row');
    if (promptRow) promptRow.style.display = 'none';

    renderEmailScreen();

    try {
      await runDuplicateCheck(values);
      if (promptRow) promptRow.style.display = '';

      setSignupAgreementAccepted(false);
      setPendingSignupMethod('1');
      setPendingSignupDraft(values);
      clearSignupEmailStage();
      clearSignupEmailTranscript();
      cleanupSignupHandlers();
      state._signupFlow = 'agree';
      state._maskCommandInput = false;
      void updateURL();
      restoreSignupEmailPromptRow();
      deps.showSignupAgreement();
      handlers.attachAgreementEvents();
    } catch (error) {
      if (promptRow) promptRow.style.display = '';

      const fieldId = error.fieldId || FIELD_ID_BY_PRECHECK_FIELD[error.field] || 'signup-userid';
      const nextDraft = pruneDraftForField(fieldId, values);
      moveToStage(fieldId, nextDraft, [error.message || '가입 정보를 확인하지 못했습니다.']);
    }
  }

  function leaveSignupToMenu(handlers) {
    cleanupSignupHandlers();
    setSignupAgreementAccepted(false);
    setPendingSignupMethod('');
    setPendingSignupDraft(null);
    clearSignupEmailStage();
    clearSignupEmailTranscript();
    state._signupFlow = 'menu';
    state._maskCommandInput = false;
    void updateURL(true);
    restoreSignupEmailPromptRow();
    deps.showSignupMenu();
    handlers.attachSignupMenuEvents();
  }

  async function handleStageInput(rawValue, handlers) {
    if (state._commandInFlight) {
      return;
    }
    state._commandInFlight = true;
    try {
      let rawText = String(rawValue || '').trim();
      let trimmedValue = rawText.trim();
      let upperCommand = trimmedValue.toUpperCase();
      let lowerCommand = trimmedValue.toLowerCase();

      if (lowerCommand === '/x' || ['P', 'M', 'B', 'X'].includes(upperCommand)) {
        leaveSignupToMenu(handlers);
        return;
      }

      if (upperCommand === 'T') {
        cleanupSignupHandlers();
        setSignupAgreementAccepted(false);
        setPendingSignupMethod('');
        setPendingSignupDraft(null);
        clearSignupEmailStage();
        clearSignupEmailTranscript();
        state._signupFlow = '';
        state._maskCommandInput = false;
        restoreSignupEmailPromptRow();
        await showMain();
        return;
      }

      const stageFieldId = getSignupEmailStage() || deriveStageFromDraft(getPendingSignupDraft() || {});
      const draft = { ...(getPendingSignupDraft() || {}) };
      if (isEnglishKeyboardStage(stageFieldId)) {
        rawText = sanitizeEnglishKeyboardInput(stageFieldId, rawText);
        trimmedValue = rawText.trim();
        upperCommand = trimmedValue.toUpperCase();
        lowerCommand = trimmedValue.toLowerCase();
      }

      // [LOG: 20260508_1625] Empty Enter keeps the current signup prompt without adding transcript lines.
      if (!trimmedValue) {
        setStagePrompt(stageFieldId);
        return;
      }

      if (stageFieldId === CONFIRM_STAGE_ID) {
        if (upperCommand === 'N') {
          appendSignupEmailTranscript(`수정 항목이 있습니까? (번호 1~5 / n) ${trimmedValue || 'n'}`);
          await completeDraft(handlers, draft);
          return;
        }

        if (Object.prototype.hasOwnProperty.call(CONFIRM_FIELD_IDS, trimmedValue)) {
          const targetFieldId = CONFIRM_FIELD_IDS[trimmedValue];
          appendSignupEmailTranscript(`수정 항목이 있습니까? (번호 1~5 / n) ${trimmedValue}`);
          moveToStage(targetFieldId, pruneDraftForField(targetFieldId, draft));
          return;
        }

        appendSignupEmailTranscript(`수정 항목이 있습니까? (번호 1~5 / n) ${trimmedValue}`);
        appendGuideForStage(CONFIRM_STAGE_ID, [
          '번호를 입력하거나 n으로 진행할 수 있습니다.'
        ]);
        renderEmailScreen();
        setStagePrompt(CONFIRM_STAGE_ID);
        return;
      }

      if (stageFieldId === 'signup-userid') {
        renderSubmittedInput(stageFieldId, trimmedValue);
        if (!isValidUserId(trimmedValue)) {
          appendSignupEmailTranscript('회원ID는 영문/숫자/_ 3~20자만 가능합니다.');
          renderEmailScreen();
          setStagePrompt(stageFieldId);
          return;
        }
        try {
          await runFieldAvailabilityCheck(stageFieldId, { userId: trimmedValue });
        } catch (error) {
          handleAvailabilityError(error, stageFieldId, { userId: trimmedValue });
          return;
        }
        // [LOG: 20260729_1616] 아이디는 항상 소문자로 저장.
        draft.userId = trimmedValue.toLowerCase();
        moveToStage('signup-password', draft);
        return;
      }

      if (stageFieldId === 'signup-password') {
        appendCurrentInput(stageFieldId, rawText);
        if (!isStrongPassword(rawText)) {
          appendSignupEmailTranscript('비밀번호는 6자 이상이며 특수문자를 1자 이상 포함해야 합니다.');
          renderEmailScreen();
          setStagePrompt(stageFieldId);
          return;
        }
        draft.password = rawText;
        draft.passwordConfirmed = false;
        moveToStage('signup-password-confirm', draft);
        return;
      }

      // [LOG: 20260508_1621] Signup password requires a matching second no-echo entry.
      if (stageFieldId === 'signup-password-confirm') {
        appendCurrentInput(stageFieldId, rawText);
        if (rawText !== String(draft.password || '')) {
          appendSignupEmailTranscript('비밀번호 확인이 일치하지 않습니다.');
          renderEmailScreen();
          setStagePrompt(stageFieldId);
          return;
        }
        draft.passwordConfirmed = true;
        moveToStage('signup-nickname', draft);
        return;
      }

      if (stageFieldId === 'signup-nickname') {
        renderSubmittedInput(stageFieldId, trimmedValue);
        if (!isValidNickname(trimmedValue)) {
          appendSignupEmailTranscript('닉네임은 2~20자여야 합니다.');
          renderEmailScreen();
          setStagePrompt(stageFieldId);
          return;
        }
        try {
          await runFieldAvailabilityCheck(stageFieldId, {
            userId: draft.userId || '',
            nickName: trimmedValue
          });
        } catch (error) {
          handleAvailabilityError(error, stageFieldId, { ...draft, nickName: trimmedValue });
          return;
        }
        draft.nickName = trimmedValue;
        moveToStage('signup-email', draft);
        return;
      }

      renderSubmittedInput(stageFieldId, trimmedValue);
      if (!isValidEmail(trimmedValue)) {
        appendSignupEmailTranscript('이메일 형식이 올바르지 않습니다.');
        renderEmailScreen();
        setStagePrompt(stageFieldId);
        return;
      }

      draft.email = trimmedValue;
      try {
        await runFieldAvailabilityCheck(stageFieldId, draft);
      } catch (error) {
        handleAvailabilityError(error, stageFieldId, draft);
        return;
      }
      moveToStage(CONFIRM_STAGE_ID, draft);
    } finally {
      state._commandInFlight = false;
    }
  }

  return function attachEmailEvents(handlers, focusFieldId = '') {
    cleanupSignupHandlers();
    ensureFooterReady();
    setPendingSignupMethod('1');
    state._signupFlow = 'email';

    const draft = getPendingSignupDraft() || {};
    const stage = String(focusFieldId || '').trim() || getSignupEmailStage() || deriveStageFromDraft(draft);

    if (!getTranscript().length) {
      initializeTranscript(stage);
    } else if (focusFieldId) {
      appendGuideForStage(stage);
    }

    setPendingSignupDraft(stage === CONFIRM_STAGE_ID ? draft : pruneDraftForField(stage, draft));
    setSignupEmailStage(stage);
    renderEmailScreen();
    setStagePrompt(stage);

    state._signupEnterHandler = function handleSignupEmailInput(raw) {
      if (state.screen !== 'signup' || state._signupFlow !== 'email') {
        return false;
      }
      if (cmdInput) {
        cmdInput.value = '';
      }
      void handleStageInput(raw, handlers);
      return true;
    };
  };
}
