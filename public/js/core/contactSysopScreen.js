import { renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';
import { shouldAutoFocusCommandInput } from './uiUtils.js';

// [LOG_ID: 20260720_2300] GUIDE의 '건의하기'를 게시판에서 시삽 이메일 발송 기능으로 교체.
// 글이 쌓이기만 하고 아무도 안 보는 빈 게시판 대신, 쓰는 즉시 실제 이메일로 전달되게 했다.
// [LOG_ID: 20260721_1700] 사용자 요청: "하이텔, 나우누리, 천리안 같은 PC통신 UI로 만들자" —
// 기존엔 memoScreens.js의 최소 라인 에디터 패턴만 따랐는데, 이 앱의 다른 글쓰기 화면
// (postWriteView.js)이 이미 재현해 둔 정통 PC통신 라인 에디터 관례(단계 진입 시 안내문,
// "현재:" 표시, 화면을 넘는 트랜스크립트의 말줄임 처리)를 그대로 가져오고, 실제 시삽에게
// 이메일을 보내는 되돌릴 수 없는 동작이므로 원전 PC통신 게시판 저장 흐름의 핵심 요소인
// "미리보기 + 저장 확인(Y/N)" 단계를 추가했다.
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

  // [LOG_ID: 20260721_1700] postWriteView.js의 20260710_1640과 동일한 이유 — 본문이 길어지면
  // 지금 치는 줄이 화면 하단 프롬프트 밖으로 밀려나던 문제를 같은 방식(화면 끝 줄부터
  // 이어쓰기, 잘린 앞부분은 생략 표시)으로 막는다.
  const MAX_VISIBLE_TRANSCRIPT_LINES = 18;

  function getVisibleTranscript(flow) {
    const lines = flow.transcript;
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
    const promptHtml = prompt ? `<span class="ansi-cyan">${esc(prompt)}</span>` : '';
    const valueHtml = value ? `${prompt ? ' ' : ''}<span class="ansi-white">${esc(value)}</span>` : '';
    return `<div class="ansi-line">${promptHtml}${valueHtml}</div>`;
  }

  // [LOG_ID: 20260722_1100] 사용자 지적: "글쓰기 편하게 되어 있어야지. 지금은 글 제목을
  // 아래쪽에서 넣고 있잖아" — 원전(그림 7.6)은 수신/제목이 편지쓰기 화면 맨 위에 고정된
  //머리글로 계속 보이는데, 이전 구현은 그 줄들을 스크롤되는 트랜스크립트 배열에 넣어서
  // 본문을 몇 줄만 써도 MAX_VISIBLE_TRANSCRIPT_LINES 말줄임에 밀려 화면에서 사라졌다 —
  // 즉 몇 줄 쓰고 나면 누구에게, 무슨 제목으로 쓰는 중인지 안 보이는 상태가 됐었다. 수신/
  // 제목을 트랜스크립트가 아니라 매 렌더마다 새로 만드는 고정 머리글로 분리해, 본문을
  // 아무리 길게 써도 화면 맨 위에서 절대 스크롤되어 사라지지 않게 한다.
  function buildHeaderHtml(flow) {
    if (!flow || flow.stage === 'subject') {
      return '';
    }
    return `${renderLine({ prompt: '수신 :', value: '시삽' })}${renderLine({ prompt: '제목 :', value: flow.subject })}${renderLine({ prompt: '', value: '' })}`;
  }

  function renderContactSysopScreen() {
    const flow = state._contactSysopFlow;
    if (!flow) return;

    const headerHtml = buildHeaderHtml(flow);
    const transcriptHtml = getVisibleTranscript(flow).map(renderLine).join('');

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    renderRawHtmlScreenWithTopbar({
      leftLabel: 'TOSYSOP',
      centerLabel: '건의하기',
      bodyHtml: headerHtml + transcriptHtml,
      screenEl,
      isMobile
    });

    if (flow.sending) {
      setHint('시삽에게 전송하는 중입니다..');
      setPrompt('>>');
    } else if (flow.stage === 'confirm') {
      setHint('발송(1), 이어서 작성(0), 취소(/q, P, M, B)');
      setPrompt('발송 명령 (1, 0) >>');
    } else if (flow.stage === 'subject') {
      // [LOG_ID: 20260722_1130] 사용자 지적: 제목 입력 단계에서 아직 시작도 안 한 본문
      // 작성 명령("전송(/s 또는 SEND)")을 안내하고 있었다 — 제목은 한 줄만 입력하는 단계라
      // /s·SEND는 이 단계에서 의미가 없다(본문 단계에 가서야 실제로 동작함).
      setHint('제목을 입력하고 Enter, 취소(/q, P, M, B)');
      setPrompt('제목 >>');
    } else {
      setHint('전송(/s 또는 SEND), 취소(/q, P, M, B)');
      setPrompt('내용 >>');
    }
    setReady?.(true);
    focusCommandInput();
  }

  async function cancelContactSysop() {
    clearContactSysopFlow();
    await showBoardSelect('guide', '서비스 안내');
    return true;
  }

  // [LOG_ID: 20260722_0200] 정통 PC통신 게시판 저장 흐름의 핵심 — 실제로 이메일을 보내기
  // 전에 제목/본문을 한 번에 보여주고 저장 여부를 묻는다. 원전(하이텔 길라잡이 p.109)의
  // 발송 명령 화면 "명령(H, 1:발송, 2:저장, 3:발송+저장, 4:발송+삐삐, 5:발송+저장+삐삐,
  // 0:취소)"을 그대로 가져오되, 건의하기는 편지함(저장)도 삐삐(호출) 기능도 없는 시삽 앞
  // 1회성 이메일 발송이라 실제로 동작하는 두 개(발송/취소)만 남긴다 — 원전에 있다고 그대로
  // 베끼면 "H"처럼 그 화면에서 실제로는 아무 반응도 없는 죽은 선택지가 생긴다(memoScreens.js의
  // 쪽지쓰기 발송 명령 화면도 같은 이유로 "H"가 표기만 되고 실제로는 처리되지 않는 걸 확인함 —
  // 같은 함정을 반복하지 않는다). 취소(0)는 쪽지쓰기의 "임시글 폐기"와 달리 본문으로 되돌아가
  // 계속 쓸 수 있게 한다(완전 취소는 기존처럼 /q, P, M, B로).
  function enterConfirmStage(flow) {
    flow.stage = 'confirm';
    // [LOG_ID: 20260722_1100] 수신/제목은 buildHeaderHtml()이 이미 고정 머리글로 보여주고
    // 있으므로 미리보기에서 다시 반복하지 않는다(중복 표시 방지).
    appendContactSysopLine('', '');
    appendContactSysopLine('', '--- 보낼 내용 미리보기 ---');
    flow.bodyLines.forEach((line) => appendContactSysopLine('', line || ' '));
    appendContactSysopLine('', '--------------------------');
    appendContactSysopLine('[선택]', '명령(1:발송, 0:이어서 작성)');
    renderContactSysopScreen();
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
      flow.stage = 'body';
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
      // [LOG_ID: 20260722_1100] 수신/제목은 이제 buildHeaderHtml()이 고정 머리글로 그리므로
      // 트랜스크립트엔 다시 넣지 않는다 — 대신 본문 작성용으로 트랜스크립트를 새로 시작해
      // 말줄임 예산(MAX_VISIBLE_TRANSCRIPT_LINES) 전체를 본문 줄에 쓸 수 있게 한다.
      flow.transcript = [
        { prompt: '', value: '내용을 한 줄씩 입력하세요. 완료: /s 또는 SEND, 취소: /q, P, M, B' }
      ];
      renderContactSysopScreen();
      return true;
    }

    if (flow.stage === 'confirm') {
      appendContactSysopLine('발송 명령 >>', line);
      if (isCancel) {
        renderContactSysopScreen();
        return await cancelContactSysop();
      }
      // [LOG_ID: 20260722_0200] 원전 발송 명령(1:발송)이 기본이고, Y/SEND/`/s`는 이전 버전과의
      // 하위 호환을 위해 그대로 유지한다(기능은 동일, 입력 방식만 여러 개).
      if (trimmed === '1' || cmd === 'Y' || trimmed === '/s' || cmd === 'SEND') {
        return await submitContactSysop();
      }
      if (trimmed === '0' || cmd === 'N') {
        flow.stage = 'body';
        appendContactSysopLine('', '계속 작성하실 수 있습니다. 완료: /s 또는 SEND, 취소: /q, P, M, B');
        renderContactSysopScreen();
        return true;
      }
      appendContactSysopLine('[안내]', '1(발송) 또는 0(이어서 작성)을 입력해 주세요.');
      renderContactSysopScreen();
      return true;
    }

    // stage === 'body'
    // [LOG_ID: 20260722_1005] /s·취소 명령은 편지 본문 줄이 아니라 에디터를 끝내는 제어
    // 입력이므로(원전의 'CTRL+Z'에 해당) 본문 줄과 같은 "*N:" 번호를 붙이지 않는다.
    if (trimmed === '/s' || cmd === 'SEND') {
      appendContactSysopLine('명령 >>', line);
      enterConfirmStage(flow);
      return true;
    }
    if (isCancel) {
      appendContactSysopLine('명령 >>', line);
      renderContactSysopScreen();
      return await cancelContactSysop();
    }

    // [LOG_ID: 20260722_1005] 구글 드라이브에 실제로 올려주신 하이텔 원전 스캔본(그림 7.6
    // "메일의 발송")에서 편지쓰기 에디터가 각 줄 앞에 "*1:", "*2:", "*3:"...으로 번호를 매기며
    // 받아쓰는 걸 직접 확인했다 — 지금까지는 그냥 "내용 >>"만 반복해 몇 번째 줄인지 안 보였다.
    // 그 번호 매기는 에디터 관례를 그대로 재현한다(내용은 그대로 한 줄씩 입력, 완료는 이
    // 사이트 다른 글쓰기 화면들과 통일된 /s·SEND 관례를 유지 — 원전의 'E'로 바꾸면 이 화면만
    // 달라져 오히려 혼란을 준다).
    flow.bodyLines.push(line);
    appendContactSysopLine(`*${flow.bodyLines.length}:`, line);
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
        { prompt: '', value: '건의하기 작성' },
        { prompt: '', value: '' },
        // [LOG_ID: 20260722_1005] 그림 7.6 "메일의 발송"의 편지쓰기 머리글(수신/제목)을
        // 재현 — 건의하기는 받는 사람이 항상 시삽으로 고정이라 정적으로 표시한다.
        { prompt: '수신 :', value: '시삽' },
        { prompt: '[안내]', value: '시삽에게 보낼 건의사항을 작성해 주세요. 보내신 내용은 이메일로 전달됩니다.' },
        { prompt: '', value: '' },
        { prompt: '', value: '제목을 입력하십시오.' }
      ],
      stage: 'subject',
      sending: false
    };
    state._terminalInputHandler = handleContactSysopRawInput;
    renderContactSysopScreen();
  }

  return { showContactSysop };
}
