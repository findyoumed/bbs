import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
import { convertKoreanToEnglish } from './commandNormalizer.js';

/**
 * contactSysopScreen.js
 * [LOG_ID: 20260806_1741] notice/write(postWriteView.js 게시판 글쓰기)의 renderBbsEditor 구조와
 * HTML, CSS 스타일, 폰트 색상(#ffffff), 폰트 크기(inherit), 구분선, 키 이동(Tab/Shift+Tab/Arrow/Ctrl+S/Esc)
 * 및 하단 풋터까지 100% 완벽히 동일하게 일치시킴.
 */
export function createContactSysopScreen(deps) {
  const {
    apiFetch,
    cmdInput,
    esc,
    screenEl,
    setHint,
    setPrompt,
    setReady,
    showBoardSelect,
    showMain,
    state,
    updateURL
  } = deps;

  function toCommandToken(value) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value) ? convertKoreanToEnglish(value).toUpperCase() : '';
  }

  function focusCommandInput() {
    if (shouldAutoFocusCommandInput() && cmdInput) {
      cmdInput.focus();
    }
  }

  function clearContactSysopFlow() {
    if (typeof state._contactSysopFlow?._editorCleanup === 'function') {
      state._contactSysopFlow._editorCleanup();
    }
    if (typeof document !== 'undefined') {
      const footerEl = document.getElementById('terminal-footer');
      if (footerEl) {
        footerEl.style.display = '';
        footerEl.removeAttribute('data-footer-state');
      }
      if (cmdInput) {
        cmdInput.disabled = false;
        cmdInput.style.display = '';
        cmdInput.value = '';
      }
    }
    if (state._terminalInputHandler === handleContactSysopRawInput) {
      state._terminalInputHandler = null;
    }
    state._contactSysopFlow = null;
  }

  // [LOG_ID: 20260811_1546] 입력 검증 문구는 PC통신식 편집 화면의 본문 안에
  // 표시하고, 하단 힌트바의 전송·취소 안내를 덮어쓰지 않는다.
  function clearInlineValidationError() {
    if (typeof document === 'undefined') return;
    document.querySelector('.tosysop-ed-validation')?.remove();
  }

  function showInlineValidationError(message, rowId) {
    if (typeof document === 'undefined') return;
    clearInlineValidationError();
    const row = document.getElementById(rowId);
    if (!row?.parentNode) return;
    const errorEl = document.createElement('div');
    errorEl.className = 'tosysop-ed-validation';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = String(message || '입력값을 확인해주세요.');
    row.parentNode.insertBefore(errorEl, row);
  }

  async function cancelContactSysop() {
    clearContactSysopFlow();
    await showBoardSelect('guide', '서비스 안내');
    return true;
  }

  async function submitContactSysop() {
    const flow = state._contactSysopFlow;
    if (!flow) return false;

    const titleEl = typeof document !== 'undefined' ? document.getElementById('tosysop-ed-title') : null;
    const bodyEl = typeof document !== 'undefined' ? document.getElementById('tosysop-ed-body') : null;

    const subject = String(titleEl ? titleEl.value : flow.subject || '').trim();
    const content = String(bodyEl ? bodyEl.value : (Array.isArray(flow.bodyLines) ? flow.bodyLines.join('\n') : '')).trim();

    if (!subject) {
      showInlineValidationError('제목을 입력해주세요.', 'tosysop-ed-subject-row');
      if (titleEl) titleEl.focus();
      return false;
    }
    if (!content) {
      showInlineValidationError('내용을 입력해주세요.', 'tosysop-ed-body-row');
      if (bodyEl) bodyEl.focus();
      return false;
    }

    try {
      flow.sending = true;
      if (titleEl) titleEl.disabled = true;
      if (bodyEl) bodyEl.disabled = true;

      await apiFetch('/api/contact-sysop', {
        method: 'POST',
        body: JSON.stringify({ subject, content })
      });
      flow.sending = false;
      deps.showToast?.('건의글이 시삽에게 전달되었습니다.', 2000, 'success');
      await cancelContactSysop();
      return true;
    } catch (error) {
      flow.sending = false;
      if (titleEl) titleEl.disabled = false;
      if (bodyEl) bodyEl.disabled = false;
      setHint(`발송 실패: ${String(error?.message || '알 수 없는 오류입니다.')}`);
      return false;
    }
  }

  function renderContactSysopScreen() {
    const flow = state._contactSysopFlow;
    if (!flow) return;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetId  = 'tosysop-ed-target';
    const subjectId = 'tosysop-ed-subject';
    const bodyId    = 'tosysop-ed-body';
    const sep = '─'.repeat(isMobile ? 40 : 76);

    const inputStyle = `
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff !important;
      caret-color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      letter-spacing: inherit !important;
      outline: none;
      padding: 0;
      margin: 0;
      min-width: 0;
    `;

    const textareaStyle = `
      width: 100%;
      height: 100%;
      min-height: 0;
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff !important;
      caret-color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      letter-spacing: inherit !important;
      outline: none;
      padding: 0;
      margin: 0;
      resize: none;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      overscroll-behavior: none !important;
    `;

    const bodyHtml = `
<style>
  #${targetId}, #${subjectId} {
    color: #ffffff !important;
    caret-color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    cursor: text !important;
    overflow: hidden !important;
  }
  #${bodyId} {
    color: #ffffff !important;
    caret-color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    cursor: text !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
  .tosysop-ed-label {
    white-space: nowrap;
    user-select: none;
    color: #ffffff !important;
    font-family: inherit;
    cursor: pointer !important;
  }
  .tosysop-ed-row {
    display: flex;
    align-items: center;
    padding: 2px 0;
    gap: 0;
    flex-shrink: 0;
    cursor: pointer;
  }
  .tosysop-ed-body-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin-top: 4px;
    min-height: 4.4em;
    cursor: pointer;
    overflow: hidden !important;
  }
  .tosysop-ed-validation {
    color: #ffff55 !important;
    font-family: inherit;
    white-space: pre-wrap;
    padding: 2px 0;
    margin: 0;
    flex-shrink: 0;
  }
</style>
<div onwheel="event.preventDefault();" style="display:flex;flex-direction:column;height:100%;overflow:hidden !important;overscroll-behavior:none !important;min-height:0;font-family:inherit;font-size:inherit;line-height:inherit;color:#ffffff !important;background:transparent;box-sizing:border-box;">
  <div id="tosysop-ed-target-row" class="tosysop-ed-row">
    <label for="${targetId}" class="tosysop-ed-label">받는 사람 :&nbsp;</label>
    <input id="${targetId}" type="text" autocomplete="off" spellcheck="false" value="sysop" readonly style="${inputStyle}"/>
  </div>
  <div id="tosysop-ed-subject-row" class="tosysop-ed-row">
    <label for="${subjectId}" class="tosysop-ed-label">제    목 :&nbsp;</label>
    <input id="${subjectId}" type="text" autocomplete="off" spellcheck="false" maxlength="60" placeholder="" style="${inputStyle}" autofocus />
  </div>
  <div style="color:#555;font-size:inherit;line-height:inherit;letter-spacing:0;white-space:pre;user-select:none;margin:2px 0;flex-shrink:0;">${sep}</div>
  <div id="tosysop-ed-body-row" class="tosysop-ed-body-wrapper">
    <label for="${bodyId}" class="tosysop-ed-label" style="padding-bottom:4px;">내    용 :</label>
    <textarea id="${bodyId}" spellcheck="false" autocomplete="off" style="${textareaStyle}"></textarea>
  </div>
</div>`;

    renderRawHtmlScreenWithTopbar({
      leftLabel: 'WMAIL',
      centerLabel: '편지 쓰기',
      bodyHtml,
      screenEl,
      isMobile
    });

    const targetEl = document.getElementById(targetId);
    const subjectEl = document.getElementById(subjectId);
    const bodyEl = document.getElementById(bodyId);
    const targetRowEl = document.getElementById('tosysop-ed-target-row');
    const subjectRowEl = document.getElementById('tosysop-ed-subject-row');
    const bodyRowEl = document.getElementById('tosysop-ed-body-row');
    if (!subjectEl || !bodyEl) return;

    subjectEl.value = String(flow.subject || '').slice(0, 60);
    bodyEl.value = Array.isArray(flow.bodyLines) ? flow.bodyLines.join('\n') : '';

    const promptRow = typeof document !== 'undefined' ? document.getElementById('terminal-prompt-row') : null;
    if (promptRow) promptRow.style.display = '';
    if (cmdInput) {
      cmdInput.style.display = '';
      cmdInput.disabled = false;
    }

    setHint('전송: Ctrl+S 또는 마지막 줄에 . 후 Enter  |  취소: Escape  |  이동: Tab/화살표');
    setPrompt('선택 >>');
    setReady?.(true);
    // [LOG_ID: 20260811_1130] WMAIL 편지쓰기와 동일한 일반 힌트바를 유지한다.
    // 공용 SEND/P/H footer를 덧씌우면 수신자만 다른 편지쓰기 화면이라는 기준에서 벗어난다.
    // [LOG_ID: 20260810_1510] 행에는 hover 커서만 있었고 클릭 시 포커스를 옮기는
    // 동작이 없어 라벨·빈 행을 눌러도 입력할 수 없었다. 쪽지 작성 화면과 동일하게
    // 안전한 포커스 함수와 행별 클릭 위임을 제공한다.
    function safeFocus(el) {
      if (!el || typeof el.focus !== 'function') return;
      try {
        el.focus({ preventScroll: true });
      } catch (_) {
        el.focus();
      }
    }

    const onTargetRowClick = (event) => {
      if (event.target !== targetEl) safeFocus(subjectEl);
    };
    const onSubjectRowClick = (event) => {
      if (event.target !== subjectEl) safeFocus(subjectEl);
    };
    const onBodyRowClick = (event) => {
      if (event.target !== bodyEl) safeFocus(bodyEl);
    };

    targetRowEl?.addEventListener('click', onTargetRowClick);
    subjectRowEl?.addEventListener('click', onSubjectRowClick);
    bodyRowEl?.addEventListener('click', onBodyRowClick);

    const editorCleanup = () => {
      targetRowEl?.removeEventListener('click', onTargetRowClick);
      subjectRowEl?.removeEventListener('click', onSubjectRowClick);
      bodyRowEl?.removeEventListener('click', onBodyRowClick);
      subjectEl.removeEventListener('keydown', onSubjectKey);
      bodyEl.removeEventListener('keydown', onBodyKey);
      cmdInput?.removeEventListener('keydown', onCmdKey);
      if (state._contactSysopFlow?._editorCleanup === editorCleanup) {
        state._contactSysopFlow._editorCleanup = null;
      }
    };
    flow._editorCleanup = editorCleanup;

    function doSave() {
      submitContactSysop();
    }

    function isOnFirstLine(ta) {
      return ta.value.substring(0, ta.selectionStart).indexOf('\n') === -1;
    }

    function onSubjectKey(e) {
      if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelContactSysop(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        safeFocus(bodyEl);
        bodyEl.setSelectionRange(0, 0);
      }
    }

    function onBodyKey(e) {
      if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelContactSysop(); return; }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (cmdInput) {
          safeFocus(cmdInput);
          cmdInput.select();
        }
        return;
      }
      if ((e.key === 'ArrowUp' && isOnFirstLine(bodyEl)) || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        safeFocus(subjectEl);
        subjectEl.setSelectionRange(subjectEl.value.length, subjectEl.value.length);
        return;
      }
      if (e.key === 'Enter') {
        const pos = bodyEl.selectionStart;
        const before = bodyEl.value.substring(0, pos);
        const currentLine = before.split('\n').pop().trim();
        if (currentLine === '.' || currentLine === '/s') {
          e.preventDefault();
          doSave();
          return;
        }
      }
    }

    function onCmdKey(e) {
      if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
        e.preventDefault();
        safeFocus(bodyEl);
        bodyEl.setSelectionRange(bodyEl.value.length, bodyEl.value.length);
      }
    }

    subjectEl.oninput = (e) => { flow.subject = e.target.value; clearInlineValidationError(); };
    subjectEl.addEventListener('keydown', onSubjectKey);

    bodyEl.oninput = (e) => { flow.bodyLines = e.target.value.split('\n'); clearInlineValidationError(); };
    bodyEl.addEventListener('keydown', onBodyKey);

    if (cmdInput) {
      cmdInput.addEventListener('keydown', onCmdKey);
    }

    setTimeout(() => {
      if (subjectEl) {
        safeFocus(subjectEl);
        subjectEl.setSelectionRange(subjectEl.value.length, subjectEl.value.length);
      }
    }, 10);
  }

  async function handleContactSysopRawInput(raw, context = {}) {
    if (state.screen !== 'contact-sysop' || !state._contactSysopFlow) {
      if (state._terminalInputHandler === handleContactSysopRawInput) {
        clearContactSysopFlow();
      }
      return false;
    }

    const rawStr = String(raw || '').trim();
    const cmdUpper = rawStr.toUpperCase();
    const koCmd = toCommandToken(rawStr);
    const isCancel = cmdUpper === 'P' || cmdUpper === 'M' || cmdUpper === 'B' || cmdUpper === 'Q' || cmdUpper === '/Q' || cmdUpper === 'ESC' || koCmd === 'P' || koCmd === 'M' || koCmd === 'B' || koCmd === '/Q';

    if (cmdUpper === 'T' || koCmd === 'T') {
      await cancelContactSysop();
      if (typeof showMain === 'function') {
        await showMain();
      }
      return true;
    }

    if (isCancel) {
      await cancelContactSysop();
      return true;
    }

    if (cmdUpper === '1' || cmdUpper === 'SEND' || cmdUpper === '/S' || koCmd === 'SEND' || koCmd === '/S') {
      await submitContactSysop();
      return true;
    }

    return true;
  }

  async function showContactSysop(fromHistory = false) {
    if (state.user?.isGuest) {
      setHint('건의하기는 로그인 후 이용하실 수 있습니다.');
      setPrompt('내용 >>');
      setReady?.(true);
      await showBoardSelect('guide', '서비스 안내');
      return;
    }

    state.screen = 'contact-sysop';
    if (!fromHistory) updateURL();

    state._contactSysopFlow = {
      subject: '',
      bodyLines: [],
      sending: false
    };
    state._terminalInputHandler = handleContactSysopRawInput;
    renderContactSysopScreen();
  }

  return {
    showContactSysop,
    handleContactSysopRawInput
  };
}
