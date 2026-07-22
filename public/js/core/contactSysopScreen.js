import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';

// [LOG_ID: 20260720_2300] GUIDE의 '건의하기'를 게시판에서 시삽 이메일 발송 기능으로 교체.
// [LOG_ID: 20260721_1700] 사용자 요청: "하이텔, 나우누리, 천리안 같은 PC통신 UI로 만들자" —
// [LOG_ID: 20260722_1410] 사용자의 12차 지적: "내용 이부분이 다시 아래로 내려갔는데" —
// 하이텔 원전 PDF 106쪽 [그림 7.1] 100% 동일 라인 에디터(*1:, *2:...) 및 107쪽 [그림 7.2] 폼 정합.
// 제목 입력뿐만 아니라 본문 에디터(*1:, *2:...) 및 발송 승인 명령까지 전 과정을 본문 영역 내부의
// 인라인 <input>에서 수신하여, 하단 24행 푸터로 입력이 떨어지는 현상을 100% 원천 차단함.
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

  function getActiveInlineInputId(flow) {
    if (!flow) return null;
    if (flow.stage === 'body') return 'tosysop-inline-body';
    if (flow.stage === 'confirm') return 'tosysop-inline-confirm';
    if (flow.stage === 'sent_success') return 'tosysop-inline-sent';
    return 'tosysop-inline-title';
  }

  // [LOG_ID: 20260722_1530] 사용자 지적 — 직전 수정(20260722_1500)은 "포커스가 일단 다른
  // 곳으로 찍혔다가 되돌아오는" 방식(click 캡처 후 requestAnimationFrame으로 재확보)이라,
  // 아주 짧지만 실제로 포커스가 두 번 이동하는 게 보였다("포커스가 2군데로 쪼개지는" 원인).
  // "처음부터 포커스는 1개로"라는 요청대로 mousedown만 막아봤더니(20260722_1530 1차 시도),
  // 실브라우저 재현 테스트에서 여전히 뚫렸다 — mousedown과 click은 서로 다른 이벤트라
  // mousedown에서 stopPropagation해도 뒤이어 발생하는 별도의 click 이벤트(그리고 거기 달린
  // 다른 전역 리스너의 cmdInput.focus() 호출)는 전혀 막지 못했다(재현 테스트로 확인 후 정정).
  // 그래서 두 이벤트 모두에 개입한다 — mousedown에서 preventDefault로 브라우저의 기본
  // 블러/포커스 이동 자체를 취소하고(네이티브 동작 차단), 뒤따르는 click은 capture 단계
  // document에서 stopPropagation으로 끊어 그 이후의 다른 리스너(bubble 단계 포함)에 아예
  // 도달하지 못하게 한다 — 두 이벤트 다 막아야 인라인 입력창이 단 한 번도 포커스를 안 잃는다.
  let focusGuardHandlers = null;

  function installFocusGuard() {
    if (typeof document === 'undefined' || focusGuardHandlers) return;

    const isOutsideActiveInput = (event) => {
      const flow = state._contactSysopFlow;
      if (!flow) return false;
      const activeId = getActiveInlineInputId(flow);
      const activeInput = activeId ? document.getElementById(activeId) : null;
      return Boolean(activeInput) && event.target !== activeInput;
    };

    const onMouseDown = (event) => {
      if (isOutsideActiveInput(event)) {
        event.preventDefault();
      }
    };

    const onClickCapture = (event) => {
      if (!isOutsideActiveInput(event)) return;
      event.stopPropagation();
      const flow = state._contactSysopFlow;
      const activeId = getActiveInlineInputId(flow);
      const activeInput = document.getElementById(activeId);
      if (activeInput && document.activeElement !== activeInput) {
        activeInput.focus();
        const len = activeInput.value.length;
        activeInput.setSelectionRange(len, len);
      }
    };

    focusGuardHandlers = { mousedown: onMouseDown, click: onClickCapture };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClickCapture, true);
  }

  function removeFocusGuard() {
    if (focusGuardHandlers && typeof document !== 'undefined') {
      document.removeEventListener('mousedown', focusGuardHandlers.mousedown, true);
      document.removeEventListener('click', focusGuardHandlers.click, true);
    }
    focusGuardHandlers = null;
  }

  function clearContactSysopFlow() {
    removeFocusGuard();
    if (typeof document !== 'undefined') {
      const footerEl = document.getElementById('terminal-footer');
      if (footerEl) {
        footerEl.style.display = '';
        footerEl.removeAttribute('data-footer-state');
      }
      if (cmdInput) {
        cmdInput.disabled = false;
        cmdInput.value = '';
      }
    }
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

  const MAX_VISIBLE_TRANSCRIPT_LINES = 18;

  function getVisibleTranscript(lines) {
    if (lines.length <= MAX_VISIBLE_TRANSCRIPT_LINES) {
      return lines;
    }
    const hiddenCount = lines.length - (MAX_VISIBLE_TRANSCRIPT_LINES - 1);
    return [
      { prompt: '', value: `(... 이전 ${hiddenCount}줄 생략 ...)` },
      ...lines.slice(hiddenCount)
    ];
  }

  function renderLine(line) {
    const prompt = String(line?.prompt || '');
    const value = String(line?.value ?? '');
    const isRawHtml = Boolean(line?.isRawHtml);
    const promptHtml = prompt ? `<span class="ansi-cyan">${esc(prompt)}</span>` : '';
    const renderedVal = isRawHtml ? value : esc(value);
    const valueHtml = value ? `${prompt ? ' ' : ''}<span class="ansi-white">${renderedVal}</span>` : '';
    return `<div class="ansi-line">${promptHtml}${valueHtml}</div>`;
  }

  function renderContactSysopScreen() {
    const flow = state._contactSysopFlow;
    if (!flow) return;

    // [LOG_ID: 20260722_1410] 건의하기 전체 과정 동안 하단 #terminal-footer 숨김 & cmdInput 비활성화
    const footerEl = typeof document !== 'undefined' ? document.getElementById('terminal-footer') : null;
    if (footerEl) {
      footerEl.style.display = 'none';
      footerEl.setAttribute('data-footer-state', 'hidden');
    }
    if (cmdInput) {
      cmdInput.disabled = true;
      cmdInput.blur();
    }

    let transcriptLines = [...flow.transcript];

    // 1) stage === 'subject' 제목 인라인 입력
    if (flow.stage === 'subject') {
      const draftVal = esc(flow._draftSubject || '');
      const inlineTitleHtml = `<input id="tosysop-inline-title" class="inline-tosysop-input" type="text" autocomplete="off" spellcheck="false" value="${draftVal}" autofocus />`;
      transcriptLines = transcriptLines.map((line) => {
        if (line.prompt === '제목 :') {
          return {
            prompt: '제목 :',
            value: inlineTitleHtml,
            isRawHtml: true
          };
        }
        return line;
      });
    }

    // 2) stage === 'body' 본문 라인 에디터 (*1:, *2:...) 인라인 입력
    if (flow.stage === 'body') {
      const lineNo = flow.bodyLines.length + 1;
      const draftBody = esc(flow._draftBodyLine || '');
      const inlineBodyHtml = `<input id="tosysop-inline-body" class="inline-tosysop-input" type="text" autocomplete="off" spellcheck="false" value="${draftBody}" autofocus />`;
      transcriptLines.push({
        prompt: `*${lineNo}:`,
        value: inlineBodyHtml,
        isRawHtml: true
      });
    }

    // 3) stage === 'confirm' 발송 확인 명령 인라인 입력
    if (flow.stage === 'confirm') {
      const draftCmd = esc(flow._draftConfirmCmd || '');
      const inlineCmdHtml = `<input id="tosysop-inline-confirm" class="inline-tosysop-input" type="text" autocomplete="off" spellcheck="false" value="${draftCmd}" autofocus />`;
      transcriptLines.push({
        prompt: '명령(1:발송, 0:이어서 작성) >>',
        value: inlineCmdHtml,
        isRawHtml: true
      });
    }

    // 4) stage === 'sent_success' 발송 성공 [ENTER] 대기 인라인 입력
    // [LOG_ID: 20260722_1550] 사용자 지적 — "선택 >>"은 이 줄에서 실제로 뭘 선택하는 게
    // 아니라 그냥 [ENTER]만 누르면 되는 안내문이라 불필요했다. 프롬프트 라벨 없이 안내
    // 문구만 남긴다(안 보이는 입력창은 그대로 Enter 키만 받는 용도로 유지).
    if (flow.stage === 'sent_success') {
      const inlineInputHtml = `<input id="tosysop-inline-sent" class="inline-tosysop-input" type="text" style="width: 1px; opacity: 0; position: absolute;" autofocus />`;
      transcriptLines.push({
        prompt: '',
        value: `[ENTER] 키를 누르십시오. ${inlineInputHtml}`,
        isRawHtml: true
      });
    }

    const transcriptHtml = getVisibleTranscript(transcriptLines).map(renderLine).join('');

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    renderRawHtmlScreenWithTopbar({
      leftLabel: 'TOSYSOP',
      centerLabel: '건의하기',
      bodyHtml: transcriptHtml,
      screenEl,
      isMobile
    });

    // [LOG_ID: 20260722_1500] 단계별 고유 ID를 조회하여 너비 조절 및 keydown 처리 바인딩.
    // 이전엔 onclick에서 항상 setSelectionRange(끝,끝)을 강제해, 텍스트 중간을 클릭해도
    // 캐럿이 맨 끝으로 튕겨나가는 버그가 있었다(사용자 지적: "텍스트 클릭 시 커서가 우측
    // 끝에 멈추는 현상") — 클릭 캐럿 배치는 브라우저 기본 동작이 이미 정확하므로 그 핸들러
    // 자체를 제거했다. 렌더 직후(첫 포커스 시)에만 커서를 끝에 두면 충분하다.
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        const activeId = getActiveInlineInputId(flow);
        const inlineInput = document.getElementById(activeId);
        if (inlineInput) {
          const adjustWidth = (el) => {
            const val = el.value || '';
            let chWidth = 2;
            for (let i = 0; i < val.length; i++) {
              chWidth += val.charCodeAt(i) > 127 ? 2 : 1;
            }
            el.style.width = `${Math.max(5, chWidth)}ch`;
          };

          inlineInput.focus();
          const len = inlineInput.value.length;
          inlineInput.setSelectionRange(len, len);
          adjustWidth(inlineInput);

          inlineInput.oninput = (e) => {
            adjustWidth(e.target);
            if (flow.stage === 'subject') flow._draftSubject = e.target.value;
            else if (flow.stage === 'body') flow._draftBodyLine = e.target.value;
            else if (flow.stage === 'confirm') flow._draftConfirmCmd = e.target.value;
          };

          inlineInput.onkeydown = async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const val = inlineInput.value;
              const trimmed = val.trim();
              const cmdUpper = trimmed.toUpperCase();
              const isCancel = trimmed === '/q' || cmdUpper === 'P' || cmdUpper === 'B';

              // 1) 제목 단계
              if (flow.stage === 'subject') {
                if (isCancel) return await cancelContactSysop();
                if (!trimmed) return;
                const lastLine = flow.transcript[flow.transcript.length - 1];
                if (lastLine && lastLine.prompt === '제목 :') {
                  lastLine.value = trimmed;
                }
                flow.subject = trimmed;
                flow._draftSubject = '';
                flow.stage = 'body';
                appendContactSysopLine('작성방법(1:에디터, 2:KERMIT, 3:ZMODEM, 4:SUPERKERMIT, 0:취소) >>', '1');
                appendContactSysopLine('', '');
                appendContactSysopLine('', '에디터쓰기 (끝낼때는 완료: /s 또는 SEND, 취소: /q, P, M, B)');
                renderContactSysopScreen();
                return;
              }

              // 2) 본문 작성 단계 (*1:, *2:...)
              if (flow.stage === 'body') {
                if (trimmed === '/s' || cmdUpper === 'SEND') {
                  flow._draftBodyLine = '';
                  enterConfirmStage(flow);
                  return;
                }
                if (isCancel) {
                  return await cancelContactSysop();
                }
                flow.bodyLines.push(val);
                appendContactSysopLine(`*${flow.bodyLines.length}:`, val);
                flow._draftBodyLine = '';
                renderContactSysopScreen();
                return;
              }

              // 3) 발송 확인 단계
              if (flow.stage === 'confirm') {
                if (isCancel) return await cancelContactSysop();
                if (trimmed === '1' || cmdUpper === 'Y' || trimmed === '/s' || cmdUpper === 'SEND') {
                  return await submitContactSysop();
                }
                if (trimmed === '0' || cmdUpper === 'N') {
                  flow.stage = 'body';
                  flow._draftConfirmCmd = '';
                  appendContactSysopLine('', '계속 작성하실 수 있습니다. 완료: /s 또는 SEND, 취소: /q, P, M, B');
                  renderContactSysopScreen();
                  return;
                }
                appendContactSysopLine('[안내]', '1(발송) 또는 0(이어서 작성)을 입력해 주세요.');
                flow._draftConfirmCmd = '';
                renderContactSysopScreen();
                return;
              }

              // 4) 발송 완료 후 엔터 대기 단계
              if (flow.stage === 'sent_success') {
                clearContactSysopFlow();
                await showBoardSelect('guide', '서비스 안내');
                return;
              }
            }
          };
        }
      }, 0);
    }

    setReady?.(true);
  }

  async function cancelContactSysop() {
    clearContactSysopFlow();
    await showBoardSelect('guide', '서비스 안내');
    return true;
  }

  function enterConfirmStage(flow) {
    flow.stage = 'confirm';
    appendContactSysopLine('', '');
    appendContactSysopLine('', '--- 보낼 내용 미리보기 ---');
    appendContactSysopLine('수신 :', '시삽');
    appendContactSysopLine('제목 :', flow.subject);
    flow.bodyLines.forEach((line) => appendContactSysopLine('', line || ' '));
    appendContactSysopLine('', '--------------------------');
    renderContactSysopScreen();
  }

  // [LOG: 20260722_1410] 발송 성공 시 즉시 이탈하지 않고 sent_success 상태로 유도
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
      flow.sending = false;
      flow.stage = 'sent_success';
      appendContactSysopLine('', '');
      appendContactSysopLine('[안내]', '건의하신 내용을 시삽에게 이메일로 전달했습니다.');
      renderContactSysopScreen();
      return true;
    } catch (error) {
      flow.sending = false;
      flow.stage = 'body';
      appendContactSysopLine('[안내]', `발송 실패: ${String(error?.message || '알 수 없는 오류입니다.')}`);
      renderContactSysopScreen();
      return false;
    }
  }

  async function handleContactSysopRawInput(raw) {
    // 인라인 <input>에서 모든 키 처리를 담당하므로 raw 핸들러 통과 처리
    return true;
  }

  async function showContactSysop(fromHistory = false) {
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
      _draftSubject: '',
      _draftBodyLine: '',
      _draftConfirmCmd: '',
      bodyLines: [],
      transcript: [
        { prompt: '', value: '편지 쓰기  (TOSYSOP)' },
        { prompt: '', value: '' },
        { prompt: '수신 :', value: '시삽' },
        { prompt: '제목 :', value: '' }
      ],
      stage: 'subject',
      sending: false
    };
    state._terminalInputHandler = handleContactSysopRawInput;
    installFocusGuard();
    renderContactSysopScreen();
  }

  return {
    showContactSysop,
    handleContactSysopRawInput
  };
}
