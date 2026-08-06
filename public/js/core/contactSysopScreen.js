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
      setHint('제목을 입력해주세요.');
      if (titleEl) titleEl.focus();
      return false;
    }
    if (!content) {
      setHint('내용을 입력해주세요.');
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
    const titleId = 'tosysop-ed-title';
    const bodyId = 'tosysop-ed-body';
    const sep = '─'.repeat(isMobile ? 40 : 76);

    const inputStyle = `
      flex: 1;
      background: transparent;
      border: none;
      color: #ffffff !important;
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
      font-family: inherit !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      letter-spacing: inherit !important;
      outline: none;
      padding: 0;
      margin: 0;
      resize: none;
    `;

    const bodyHtml = `
<div style="display:flex;flex-direction:column;height:100%;overflow-y:auto;min-height:0;font-family:inherit;font-size:inherit;line-height:inherit;color:#ffffff !important;background:transparent;box-sizing:border-box;">
  <div style="display:flex;align-items:center;padding:2px 0;gap:0;flex-shrink:0;">
    <span style="white-space:nowrap;user-select:none;color:#ffffff !important;font-family:inherit;">수    신 :&nbsp;</span>
    <span style="color:#ffffff !important;font-family:inherit;">시삽 (SYSOP)</span>
  </div>
  <div style="display:flex;align-items:center;padding:2px 0;gap:0;flex-shrink:0;">
    <span style="white-space:nowrap;user-select:none;color:#ffffff !important;font-family:inherit;">제    목 :&nbsp;</span>
    <input id="${titleId}" type="text" autocomplete="off" spellcheck="false" maxlength="60" style="${inputStyle}" autofocus />
  </div>
  <div style="color:#555;font-size:inherit;line-height:inherit;letter-spacing:0;white-space:pre;user-select:none;margin:2px 0;flex-shrink:0;">${sep}</div>
  <div style="display:flex;flex-direction:column;flex:1;margin-top:4px;min-height:4.4em;">
    <div style="color:#ffffff !important;padding-bottom:4px;user-select:none;font-family:inherit;flex-shrink:0;">내    용 :</div>
    <textarea id="${bodyId}" spellcheck="false" autocomplete="off" style="${textareaStyle}"></textarea>
  </div>
  <div style="color:#ffffff !important;font-size:inherit !important;border-top:1px dashed #333;padding:4px 0;white-space:normal;word-break:keep-all;overflow-wrap:break-word;user-select:none;font-family:inherit;flex-shrink:0;">
    저장: Ctrl+S 또는 마지막 줄에 . 후 Enter
  </div>
</div>`;

    renderRawHtmlScreenWithTopbar({
      leftLabel: 'TOSYSOP',
      centerLabel: '시삽에게 건의하기 (글쓰기)',
      bodyHtml,
      screenEl,
      isMobile
    });

    const titleEl = document.getElementById(titleId);
    const bodyEl = document.getElementById(bodyId);
    if (!titleEl || !bodyEl) return;

    titleEl.value = String(flow.subject || '').slice(0, 60);
    bodyEl.value = Array.isArray(flow.bodyLines) ? flow.bodyLines.join('\n') : '';

    const promptRow = typeof document !== 'undefined' ? document.getElementById('terminal-prompt-row') : null;
    if (promptRow) promptRow.style.display = '';
    if (cmdInput) {
      cmdInput.style.display = '';
      cmdInput.disabled = false;
    }

    setHint('저장: Ctrl+S 또는 마지막 줄에 .  취소: Escape  이동: Tab/화살표');
    setPrompt('내용 >>');
    setReady?.(true);
    focusCommandInput();

    function doSave() {
      submitContactSysop();
    }

    function isOnFirstLine(ta) {
      return ta.value.substring(0, ta.selectionStart).indexOf('\n') === -1;
    }

    function onTitleKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelContactSysop(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        bodyEl.focus();
        bodyEl.setSelectionRange(0, 0);
      }
    }

    function onBodyKey(e) {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (e.key === 'Escape') { e.preventDefault(); cancelContactSysop(); return; }
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (cmdInput) {
          cmdInput.focus();
          cmdInput.select();
        }
        return;
      }
      if ((e.key === 'ArrowUp' && isOnFirstLine(bodyEl)) || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        titleEl.focus();
        titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);
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
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        bodyEl.focus();
      }
    }

    titleEl.oninput = (e) => { flow.subject = e.target.value; };
    titleEl.addEventListener('keydown', onTitleKey);

    bodyEl.oninput = (e) => { flow.bodyLines = e.target.value.split('\n'); };
    bodyEl.addEventListener('keydown', onBodyKey);

    if (cmdInput) {
      cmdInput.addEventListener('keydown', onCmdKey);
    }
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
