import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

// [LOG_ID: 20260720_2300] GUIDE의 '건의하기'를 게시판에서 시삽 이메일 발송 기능으로 교체.
// 글이 쌓이기만 하고 아무도 안 보는 빈 게시판 대신, 쓰는 즉시 실제 이메일로 전달되게 했다.
// UI는 memoScreens.js의 쪽지 쓰기(라인 에디터 트랜스크립트) 패턴을 그대로 따른다.
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
    state,
    updateURL
  } = deps;

  function focusCommandInput() {
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  function clearContactSysopFlow() {
    if (state._terminalInputHandler === handleContactSysopRawInput) {
      state._terminalInputHandler = null;
    }
    state._contactSysopFlow = null;
  }

  function appendContactSysopLine(prompt, value) {
    const flow = state._contactSysopFlow;
    if (!flow) return;
    flow.transcript.push({ prompt: String(prompt || ''), value: String(value ?? '') });
  }

  function renderContactSysopScreen() {
    const flow = state._contactSysopFlow;
    if (!flow) return;

    const transcriptHtml = flow.transcript
      .map((line) => {
        const prompt = String(line?.prompt || '');
        const value = String(line?.value ?? '');
        return `<div class="ansi-line"><span class="ansi-cyan">${esc(prompt)}</span>${value ? ` <span class="ansi-white">${esc(value)}</span>` : ''}</div>`;
      })
      .join('');

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    renderRawHtmlScreenWithTopbar({
      leftLabel: 'TOSYSOP',
      centerLabel: '건의하기',
      bodyHtml: transcriptHtml,
      screenEl,
      isMobile
    });

    if (flow.sending) {
      setHint('시삽에게 전송하는 중입니다..');
      setPrompt('>>');
    } else {
      setHint('전송(/s 또는 SEND), 취소(/q, P, M, B)');
      setPrompt(flow.stage === 'subject' ? '제목 >>' : '내용 >>');
    }
    setReady?.(true);
    focusCommandInput();
  }

  async function cancelContactSysop() {
    clearContactSysopFlow();
    await showBoardSelect('guide', '서비스 안내');
    return true;
  }

  async function submitContactSysop() {
    const flow = state._contactSysopFlow;
    if (!flow) return false;

    const subject = String(flow.subject || '').trim();
    const content = flow.bodyLines.join('\n').trim();
    if (!subject || !content) {
      appendContactSysopLine('[안내]', '제목과 내용을 모두 입력해 주세요.');
      renderContactSysopScreen();
      return false;
    }

    try {
      flow.sending = true;
      renderContactSysopScreen();
      await apiFetch('/api/contact-sysop', {
        method: 'POST',
        body: JSON.stringify({ subject, content })
      });
      clearContactSysopFlow();
      setHint('건의하신 내용을 시삽에게 이메일로 전달했습니다.');
      await showBoardSelect('guide', '서비스 안내');
      return true;
    } catch (error) {
      flow.sending = false;
      appendContactSysopLine('[안내]', `발송 실패: ${String(error?.message || '알 수 없는 오류입니다.')}`);
      renderContactSysopScreen();
      return false;
    }
  }

  async function handleContactSysopRawInput(raw) {
    if (state.screen !== 'contact-sysop' || !state._contactSysopFlow) {
      return false;
    }

    const flow = state._contactSysopFlow;
    if (flow.sending) {
      return true;
    }

    const line = String(raw ?? '');
    const trimmed = line.trim();
    const cmd = trimmed.toUpperCase();
    const isCancel = trimmed === '/q' || cmd === 'P' || cmd === 'M' || cmd === 'B';

    if (flow.stage === 'subject') {
      appendContactSysopLine('제목 >>', line);
      if (isCancel) {
        renderContactSysopScreen();
        return await cancelContactSysop();
      }
      if (!trimmed) {
        appendContactSysopLine('[안내]', '제목을 입력해 주세요.');
        renderContactSysopScreen();
        return true;
      }
      flow.subject = trimmed;
      flow.stage = 'body';
      appendContactSysopLine('[안내]', '내용을 한 줄씩 입력하세요. /s 또는 SEND 전송, /q 취소');
      renderContactSysopScreen();
      return true;
    }

    // stage === 'body'
    if (trimmed === '/s' || cmd === 'SEND') {
      appendContactSysopLine('내용 >>', line);
      return await submitContactSysop();
    }
    if (isCancel) {
      appendContactSysopLine('내용 >>', line);
      renderContactSysopScreen();
      return await cancelContactSysop();
    }

    flow.bodyLines.push(line);
    appendContactSysopLine('내용 >>', line);
    renderContactSysopScreen();
    return true;
  }

  async function showContactSysop(fromHistory = false) {
    // [LOG_ID: 20260721_0345] 보안/코드 점검 중 발견: 게스트 분기가 state.screen·URL을 먼저
    // 바꾼 뒤에야 걸려서, 실제로는 화면 내용(직전 GUIDE 목록)이 그대로 남은 채 URL만
    // /guide/tosysop으로 바뀌는 불일치가 있었다. 다른 로그인 필요 기능들(쪽지·투표·CONF 등)은
    // 전부 라우터 단계에서 아예 화면 전환 전에 게스트를 막는 것과 다른 패턴이었다. 게스트
    // 체크를 화면 전환보다 먼저 하도록 순서를 바꿔 같은 관례를 따른다 — 게스트는 현재 화면에
    // 그대로 머물고 힌트만 뜬다.
    if (state.user?.isGuest) {
      setHint('건의하기는 로그인 후 이용하실 수 있습니다.');
      setPrompt('>>');
      setReady?.(true);
      return;
    }

    state.screen = 'contact-sysop';
    if (!fromHistory) updateURL();

    state._contactSysopFlow = {
      subject: '',
      bodyLines: [],
      transcript: [
        { prompt: '[안내]', value: '시삽에게 보낼 건의사항을 작성해 주세요. 보내신 내용은 이메일로 전달됩니다.' }
      ],
      stage: 'subject',
      sending: false
    };
    state._terminalInputHandler = handleContactSysopRawInput;
    renderContactSysopScreen();
  }

  return { showContactSysop };
}
