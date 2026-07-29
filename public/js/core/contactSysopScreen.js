import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
import { convertKoreanToEnglish } from './commandNormalizer.js';

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

  // [LOG_ID: 20260722_1600] 사용자 리포트: 한/영 전환이 안 된 채 '/s'를 치면 두벌식 자판상
  // 같은 물리키가 'ㄴ'으로 들어와 '/ㄴ'이 된다(P/M/B 취소 명령도 동일 현상). 명령어 토큰
  // 비교에서만 두벌식→영타 역변환을 시도하고, 실제 편지 본문(자유 한국어 문장)에는 적용하지
  // 않는다 — 한글 음절은 최소 2글자(초성+중성)로 분해되므로 단일 글자 명령(P/M/B 등)과 우연히
  // 같은 결과가 나올 일이 없고, 변환 결과가 알려진 명령과 일치할 때만 그 명령으로 인정하므로
  // 일반 문장 오작동 위험은 없다.
  function toCommandToken(value) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value) ? convertKoreanToEnglish(value).toUpperCase() : '';
  }

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

  function appendContactSysopLine(prompt, value, isRawHtml = false) {
    const flow = state._contactSysopFlow;
    if (!flow) return;
    flow.transcript.push({ 
      prompt: String(prompt || ''), 
      value: String(value ?? ''), 
      isRawHtml: Boolean(isRawHtml) 
    });
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
    // [LOG_ID: 20260727_0715] 인라인 style.display까지 직접 건드리면, 뒤로가기처럼 이 화면 자신의
    // 정리 경로(clearContactSysopFlow)를 안 거치고 떠났을 때 다른 화면의 setReady()/
    // setFooterVisibility(true)(data-footer-state 속성만 되돌림)로는 이 인라인 스타일이 지워지지
    // 않아 footer가 영원히 숨은 채로 남았다(사용자 보고: "W로 글쓰기가 왜 안되지" — 실측 재현:
    // 건의하기 진입 후 뒤로가기 → 입력줄 자체가 안 보여서 클릭도 안 됨). setFooterVisibility와
    // 동일하게 속성만 바꿔 CSS([data-footer-state="hidden"])가 표시를 담당하게 하면, 다음 화면의
    // 정상적인 setReady(true) 호출 한 번으로 항상 복구된다.
    const footerEl = typeof document !== 'undefined' ? document.getElementById('terminal-footer') : null;
    if (footerEl) {
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
      const container = document.getElementById('terminal-container');
      if (container && !container._tosysopClickBound) {
        container._tosysopClickBound = true;
        container.addEventListener('click', async (event) => {
          const target = event.target.closest('[data-tosysop-action]');
          if (!target) return;

          event.preventDefault();
          event.stopPropagation();

          const action = target.dataset.tosysopAction;
          const flow = state._contactSysopFlow;
          if (!flow) return;

          if (action === 'save') {
            if (flow.stage === 'body') {
              const activeId = getActiveInlineInputId(flow);
              const inlineInput = document.getElementById(activeId);
              const pendingLine = inlineInput ? inlineInput.value : '';
              if (pendingLine.trim()) {
                flow.bodyLines.push(pendingLine);
                appendContactSysopLine(`*${flow.bodyLines.length}:`, pendingLine);
              }
              flow._draftBodyLine = '';
              if (inlineInput) inlineInput.value = '';
              enterConfirmStage(flow);
            } else if (flow.stage === 'confirm') {
              await submitContactSysop();
            }
          } else if (action === 'cancel') {
            await cancelContactSysop();
          }
        });
      }

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
            // [LOG_ID: 20260729_0010] 사용자 지적 — 일반 게시판 글쓰기(postWriteView.js)는
            // Ctrl+S나 본문 마지막 줄에 '.'만 입력해도 저장되는데, 건의하기 에디터는 오직
            // '/s' 또는 'SEND'를 타이핑하고 엔터를 쳐야만 다음 단계로 넘어갔다 — 사용자가
            // 원래 알고 있는 "글 저장" 단축키(^S, .)가 여기서만 안 먹혔다. 본문 작성 단계는
            // '/s'와 동일하게(다음 단계인 발송확인으로), 발송확인 단계는 '1'/SEND와 동일하게
            // (실제 발송) Ctrl+S를 받아들이도록 맞춘다. '.'은 본문 단계에서 한 줄 전체로
            // 입력했을 때(엔터 시) '/s'와 동일하게 처리한다(postWriteView의 "마지막 줄이 '.'"
            // 규칙과 동일한 의미).
            // [LOG_ID: 20260729_0040] 사용자 재지적 — "다른 글쓰기메뉴랑 똑같이" 만들려면
            // ESC로도 취소가 돼야 한다(postWriteView.js는 title/keyword/body 모든 필드에서
            // Escape 키를 취소로 받는다). 여기는 지금까지 P/M/B/q 텍스트 명령으로만 취소가
            // 가능했고 ESC 키 자체는 아무 반응이 없었다 — 단계 구분 없이 항상 취소로 받는다.
            if (e.key === 'Escape') {
              e.preventDefault();
              await cancelContactSysop();
              return;
            }

            if (e.ctrlKey && e.key === 's') {
              e.preventDefault();
              if (flow.stage === 'body') {
                // postWriteView의 Ctrl+S는 텍스트영역에 남아있는 내용을 그대로 저장한다 —
                // 여기서도 입력창에 아직 커밋 안 된(엔터 안 친) 줄이 있으면 버리지 말고
                // 먼저 본문 줄로 추가한 뒤 발송확인으로 넘어간다.
                const pendingLine = inlineInput.value;
                if (pendingLine.trim()) {
                  flow.bodyLines.push(pendingLine);
                  appendContactSysopLine(`*${flow.bodyLines.length}:`, pendingLine);
                }
                flow._draftBodyLine = '';
                inlineInput.value = '';
                enterConfirmStage(flow);
              } else if (flow.stage === 'confirm') {
                await submitContactSysop();
              }
              return;
            }

            if (e.key === 'Enter') {
              e.preventDefault();
              const val = inlineInput.value;
              const trimmed = val.trim();
              const cmdUpper = trimmed.toUpperCase();
              // [LOG_ID: 20260722_1600] koCmd: 한/영 전환 안 된 상태로 친 명령의 두벌식 역변환
              // 결과(예: '/s'→'/ㄴ'→'/S'). 'M'이 힌트 문구(취소: /q, P, M, B)엔 있는데 정작 이
              // 비교식엔 빠져 있어 실제로는 작동하지 않았다 — 오늘 밤 계속 잡아온 "안내엔 있는데
              // 실제로 안 되는 명령" 패턴이라 함께 바로잡는다.
              const koCmd = toCommandToken(trimmed);
              const isCancel = trimmed === '/q' || cmdUpper === 'P' || cmdUpper === 'M' || cmdUpper === 'B'
                || koCmd === '/Q' || koCmd === 'P' || koCmd === 'M' || koCmd === 'B';

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
                appendContactSysopLine('', '에디터쓰기 (끝낼때는 <span class="cmd-token cmd-clickable" data-tosysop-action="save" data-tip="글 저장 및 발송 단계로 이동">완료: Ctrl+S</span> 또는 마지막 줄에 . 입력, <span class="cmd-token cmd-clickable" data-tosysop-action="cancel" data-tip="작성 취소하고 상위 메뉴로 이동">취소: ESC</span>)', true);
                renderContactSysopScreen();
                return;
              }

              // 2) 본문 작성 단계 (*1:, *2:...)
              if (flow.stage === 'body') {
                // [LOG_ID: 20260729_0010] '.'을 한 줄 전체로 입력하고 엔터 — postWriteView의
                // "마지막 줄이 '.'이면 저장" 규칙과 동일하게 '/s'와 같이 취급한다.
                if (trimmed === '/s' || trimmed === '.' || cmdUpper === 'SEND' || koCmd === '/S' || koCmd === 'SEND') {
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
                if (trimmed === '1' || cmdUpper === 'Y' || trimmed === '/s' || cmdUpper === 'SEND'
                  || koCmd === 'Y' || koCmd === '/S' || koCmd === 'SEND') {
                  return await submitContactSysop();
                }
                if (trimmed === '0' || cmdUpper === 'N' || koCmd === 'N') {
                  flow.stage = 'body';
                  flow._draftConfirmCmd = '';
                  appendContactSysopLine('', '계속 작성하실 수 있습니다. <span class="cmd-token cmd-clickable" data-tosysop-action="save" data-tip="글 저장 및 발송 단계로 이동">완료: Ctrl+S</span> 또는 마지막 줄에 . 입력, <span class="cmd-token cmd-clickable" data-tosysop-action="cancel" data-tip="작성 취소하고 상위 메뉴로 이동">취소: ESC</span>', true);
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
    // [LOG_ID: 20260727_0715] 브라우저 뒤로가기 등 이 화면 자신의 취소·완료 경로(cancelContactSysop/
    // clearContactSysopFlow)를 거치지 않고 떠나면(popstate는 이 화면을 전혀 모른다) state.screen만
    // 바뀌고 state._contactSysopFlow/_terminalInputHandler는 그대로 남아, 이 핸들러가 이후
    // 어떤 화면에서 어떤 명령을 눌러도(W 등) 계속 무조건 true로 삼켜버렸다(사용자 보고: "W 또는
    // ㅈ로 글쓰기가 왜 안되지" — 실측 재현: 건의하기 진입 후 뒤로가기 → 이후 모든 명령 무반응).
    // memo-list/post-write의 raw 핸들러처럼 화면이 실제로 이 화면인지 먼저 확인하고, 아니면
    // clearContactSysopFlow()로 자가 치유(hidden footer·disabled cmdInput 복구)한 뒤 처리하지
    // 않은 것으로 돌려보내 정상 라우팅이 이어지게 한다.
    if (state.screen !== 'contact-sysop' || !state._contactSysopFlow) {
      if (state._terminalInputHandler === handleContactSysopRawInput) {
        clearContactSysopFlow();
      }
      return false;
    }
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
