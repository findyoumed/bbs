import { shouldAutoFocusCommandInput } from './uiUtils.js';

const STEP_CONFIG = [
  {
    fieldId: 'signup-userid',
    key: 'userId',
    prompt: '>> ',
    masked: false,
    guideLines: [
      '1. 회원ID를 입력해주세요. (최소 영문 5자~40자 가능)'
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
    prompt: '>>',
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
      '4. 닉네임을 입력하세요. (영문 40자, 한글 20자 가능)'
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
const SIGNUP_CANCEL_LINE = '입력란에 /x 를 입력하면 가입을 중단합니다.';
const ENGLISH_KEYBOARD_STAGE_IDS = new Set(['signup-userid', 'signup-password', 'signup-password-confirm']);
const HANGUL_INITIAL_KEYS = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g'];
const HANGUL_MEDIAL_KEYS = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l'];
const HANGUL_FINAL_KEYS = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g'];
const HANGUL_COMPAT_KEYS = {
  '\u3131': 'r', '\u3132': 'R', '\u3133': 'rt', '\u3134': 's', '\u3135': 'sw', '\u3136': 'sg', '\u3137': 'e', '\u3138': 'E',
  '\u3139': 'f', '\u313A': 'fr', '\u313B': 'fa', '\u313C': 'fq', '\u313D': 'ft', '\u313E': 'fx', '\u313F': 'fv', '\u3140': 'fg',
  '\u3141': 'a', '\u3142': 'q', '\u3143': 'Q', '\u3144': 'qt', '\u3145': 't', '\u3146': 'T', '\u3147': 'd', '\u3148': 'w',
  '\u3149': 'W', '\u314A': 'c', '\u314B': 'z', '\u314C': 'x', '\u314D': 'v', '\u314E': 'g',
  '\u314F': 'k', '\u3150': 'o', '\u3151': 'i', '\u3152': 'O', '\u3153': 'j', '\u3154': 'p', '\u3155': 'u', '\u3156': 'P',
  '\u3157': 'h', '\u3158': 'hk', '\u3159': 'ho', '\u315A': 'hl', '\u315B': 'y', '\u315C': 'n', '\u315D': 'nj', '\u315E': 'np',
  '\u315F': 'nl', '\u3160': 'b', '\u3161': 'm', '\u3162': 'ml', '\u3163': 'l'
};

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

function convertHangulToKeyboardText(value) {
  return Array.from(String(value || '')).map((char) => {
    if (Object.prototype.hasOwnProperty.call(HANGUL_COMPAT_KEYS, char)) {
      return HANGUL_COMPAT_KEYS[char];
    }

    const code = char.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) {
      return char.normalize('NFKC');
    }

    const syllableIndex = code - 0xAC00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const medialIndex = Math.floor((syllableIndex % 588) / 28);
    const finalIndex = syllableIndex % 28;
    return `${HANGUL_INITIAL_KEYS[initialIndex] || ''}${HANGUL_MEDIAL_KEYS[medialIndex] || ''}${HANGUL_FINAL_KEYS[finalIndex] || ''}`;
  }).join('');
}

function sanitizeEnglishKeyboardInput(fieldId, value) {
  const converted = convertHangulToKeyboardText(value);
  if (fieldId === 'signup-userid') {
    return converted.replace(/[^A-Za-z0-9_]/g, '');
  }
  if (fieldId === 'signup-password' || fieldId === 'signup-password-confirm') {
    return converted.replace(/[^\x21-\x7E]/g, '');
  }
  return String(value || '');
}

function isAsciiNickname(value) {
  return /^[\x00-\x7F]+$/.test(value);
}

function isValidUserId(value) {
  return /^[A-Za-z0-9_]{5,40}$/.test(value);
}

function isStrongPassword(value) {
  return value.length >= 6 && /[^A-Za-z0-9]/.test(value);
}

function isValidNickname(value) {
  if (!value) {
    return false;
  }
  if (isAsciiNickname(value)) {
    return value.length <= 40;
  }
  return value.length <= 20;
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

  function sanitizeCurrentCommandInput() {
    if (!cmdInput) {
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
    cmdInput.addEventListener('compositionend', sanitizeCurrentCommandInput);
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
    let rawText = String(rawValue || '');
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
        appendSignupEmailTranscript('회원ID는 영문/숫자/_ 조합 5~40자만 가능합니다.');
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
      draft.userId = trimmedValue;
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
        appendSignupEmailTranscript('닉네임은 영문 40자, 한글 20자까지 가능합니다.');
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
