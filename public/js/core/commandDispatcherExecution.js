import { normalizeCommand } from './commandNormalizer.js';

// [LOG_ID: 20260715_2300] 'policy'(GUIDE의 이용약관/개인정보처리방침)가 빠져 있어 그 화면에서만
// P/M(상위)과 T(초기화면)가 먹통이었다 — 힌트바엔 "상위(P)"가 떠 있는데 실제로 아무 반응이
// 없었다(사용자 보고: "이용약관 메뉴에서 P 입력이 안되는데"). policy는 자체 라우터
// (commandRouterGlobalNavigation.js)에 F/B(페이징)만 있고 P/M/T는 애초에 이 목록을 통한
// 공통 처리에 의존하는 구조였는데, help/history 등과 함께 등록되지 않았던 것.
// 다른 모든 화면(post-view/chat/news/weather/memo/myinfo/amusement/vote/ranking/login 등)은
// 각자 라우터에서 P를 직접 처리하고 있어 이 목록 누락의 영향을 받지 않음을 전수 확인했다.
const HISTORY_BACK_SCREENS = new Set([
  'help',
  'policy',
  // [LOG_ID: 20260716_1600] 전체 메뉴 안내(INDEX)는 자체 라우터에 F/B(페이징)만 있고 P/M/T가
  // 없으므로, 여기 등록해야 공용 handleHistoryBack()/showMain() 폴백을 탄다 — 등록을 빠뜨려
  // 힌트바엔 "상위(P)"가 뜨는데 실제로는 무반응이던 policy 버그(20260715_2300)와 같은 함정.
  'menu-index',
  'history',
  'profile',
  // [LOG_ID: 20260716_2200] 이용 현황도 자체 라우터가 없는 조회 전용 화면 — P/M/B/T 폴백 필요.
  'my-stats',
  'active-users',
  'activity-summary',
  'system-diagnostics',
  'system-log'
]);

// [LOG: 20260429_0440] Pending board search prompts show examples like `LT foo` / `LI bar`.
// Normalize that follow-up input back to the actual keyword so prompt-mode searches do not miss results.
function normalizePendingSearchInput(searchType, rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) {
    return '';
  }

  if (searchType === 'lt') {
    const match = input.match(/^(?:LT|GL|SUBJ)\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  if (searchType === 'li') {
    const match = input.match(/^LI\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  if (searchType === 'lc') {
    const match = input.match(/^(?:GA|BODY)\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  // [LOG_ID: 20260804_2037] 천리안 KEY 단독 명령의 후속 입력에서도
  // KEY/K 접두사를 다시 적은 사용자를 허용하고 실제 주제어만 검색한다.
  if (searchType === 'k') {
    const match = input.match(/^(?:K|KEY)\s+(.+)$/i);
    return match ? match[1].trim() : input;
  }

  return input;
}

function isSensitiveCommandInput(state) {
  // [LOG: 20260507_1735] Masked prompt input must never be written to command logs.
  if (state?._maskCommandInput === true) {
    return true;
  }

  const screen = String(state?.screen || '').trim().toLowerCase();
  if (screen !== 'myinfo') {
    return false;
  }

  const mode = String(state?._myInfoMode || '').trim().toLowerCase();
  const stage = String(state?._myInfoStage || '').trim().toLowerCase();
  if (mode === 'email') return stage === 'email-current';
  if (mode === 'password') return ['password-current', 'password-new', 'password-confirm'].includes(stage);
  if (mode === 'delete') return stage === 'delete-password';
  return false;
}

export function createCommandDispatcherExecution(deps) {
  const {
    state,
    terminalUiCore,
    statusManager,
    soundService,
    recordCommandExecution,
    logger,
    handlers: {
      handleGlobalCommand,
      handleEntryCommand,
      handleBrowseCommand,
      handleServiceCommand,
      handleChatCommand,
      handleMemoCommand,
      handleMyInfoCommand,
      handlePostViewCommand,
      handleLogCommand,
      handleVoteCommand,
      handleConfCommand
    },
    screens: {
      showMain,
      handleHistoryBack,
      postScreens
    },
    setPrompt,
    handleCmd
  } = deps;

  async function executeSingleCommand(rawInput, context = {}) {
    // [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 ENV "자동접속 차단시간"(SET IDLE) 재현을 위한
    // 유휴 시간 기준점 — 모든 명령 실행마다 갱신되며, app.js의 유휴 타이머가 이 값을 읽는다.
    state._lastActivityTime = Date.now();
    const input = String(rawInput || '').trim();
    const sensitiveInput = isSensitiveCommandInput(state);
    const normalized = normalizeCommand(input, state.screen);
    const cmd = normalized.toUpperCase();
    const screen = state.screen;

    // [LOG: 20260707_1224] raw-text 입력 컨텍스트: 대화실 메시지, 대화방 개설 단계, 내정보 편집 단계.
    // 이 컨텍스트에서 타이핑한 텍스트("hi", "help", "q", "cls" 등)는 명령이 아니라 입력값이므로
    // 전역/VFS 핸들러가 가로채기 전에 도메인 핸들러(chat/myinfo)가 먼저 소비해야 한다.
    // 클릭으로 들어온 명령(context.source === 'click', 상단바 로고 등)은 내비게이션 의도이므로 기존 순서를 따른다.
    const isClickSource = context?.source === 'click';
    const rawTextEntryScreen = screen === 'chat-room'
      || (screen === 'chat-lobby' && (state._chatRoomCreateStage || state._chatRoomJoinStage))
      || (screen === 'myinfo' && String(state._myInfoMode || 'view').trim().toLowerCase() !== 'view');
    const domainTextFirst = rawTextEntryScreen && !isClickSource;

    if (logger && input) {
      const logInput = sensitiveInput ? '[REDACTED]' : input;
      const logNormalized = sensitiveInput ? '[REDACTED]' : cmd;
      logger.cmd(`Command: ${logInput} (norm: ${logNormalized})`, {
        screen,
        rawInput: logInput,
        normalized: logNormalized,
        sensitive: sensitiveInput
      });
    }

    const dispatcherPipeline = [
      async () => {
        if (!state._pendingSearch) return false;
        const search = state._pendingSearch;
        state._pendingSearch = null;
        const searchInput = normalizePendingSearchInput(search.type, input);

        if (!searchInput) {
          await postScreens.showPostList(search.boardId, 1, {
            menuPath: search.menuPath,
            menuTitle: search.menuTitle,
            searchParams: {}
          });
          return true;
        }

        await postScreens.showPostList(search.boardId, 1, {
          menuPath: search.menuPath,
          menuTitle: search.menuTitle,
          searchParams: { [search.type]: searchInput }
        });
        return true;
      },
      async () => {
        if (input) return false;
        return (await handleBrowseCommand({ s: screen, input, cmd, rawCmd: normalized, context }))
          || (await handleServiceCommand({ s: screen, input, cmd, rawCmd: normalized, context }))
          || (await handleGlobalCommand({ s: screen, cmd, rawCmd: normalized, context }));
      },
      // [LOG: 20260707_1224] raw-text 컨텍스트의 타이핑 입력은 도메인 핸들러가 최우선으로 소비한다.
      // (chat: 대화실 메시지·슬래시 명령·개설 단계 입력 / myinfo: 별명·이메일·비밀번호·탈퇴 단계 입력)
      async () => domainTextFirst && !!input && (screen === 'chat-room' || screen === 'chat-lobby')
        && await handleChatCommand({ input, rawCmd: normalized, cmd, context }),
      async () => domainTextFirst && !!input && screen === 'myinfo'
        && await handleMyInfoCommand({ input, rawCmd: normalized, cmd, context }),
      // [LOG: 20260506_1315] Screen-local navigation commands like B/F must win
      // over global command handling so page navigation does not leak into menu navigation.
      async () => await handleBrowseCommand({ s: screen, input, cmd, rawCmd: normalized, context }),
      async () => await handleServiceCommand({ s: screen, input, cmd, rawCmd: normalized, context }),
      // [LOG: 20260623_0013] vote 화면 명령 라우팅 (origin/main 포팅)
      async () => await handleVoteCommand({ s: screen, cmd, rawCmd: normalized, context }),
      // [LOG_ID: 20260719_1600] 토론의 광장(CONF) 화면 명령 라우팅
      async () => await handleConfCommand({ s: screen, cmd, rawCmd: normalized, context }),
      async () => input && await handleGlobalCommand({ cmd, rawCmd: normalized, context }),
      async () => await handleEntryCommand({ s: screen, cmd, context }),
      // [LOG_ID: 20260722_2000] 사용자 리포트: "/policy/tos에서 P를 누르면 상위메뉴로 가는 게
      // 아니라 초기화면으로 이동해버리네" — P/M(상위)이 T(초기화면)와 똑같이 무조건 showMain()을
      // 타고 있었다. 이 목록의 화면들(policy/help/menu-index 등)은 자체 라우터가 없어 그 화면
      // 진입 전 어디 있었는지(GUIDE 메뉴 등 실제 "상위")를 모르는데, showMain()은 그 맥락을
      // 무시하고 항상 맨 처음 화면으로 보내버린다 — B(이전페이지 아님, HISTORY_BACK_SCREENS
      // 전용 실제 "뒤로가기")는 이미 handleHistoryBack()(브라우저 히스토리 기반, 실제 진입
      // 전 화면으로 복귀)을 쓰고 있었는데 P/M만 빠져 있었다. 사이트 전역 관례(M=P 동급,
      // hitel_upgrade_plan.txt P4-3 "사용자 결정: 현행 유지")대로 P/M도 B와 동일하게
      // handleHistoryBack()을 타도록 하고, T(초기화면 전용)만 showMain()으로 남긴다.
      async () => HISTORY_BACK_SCREENS.has(screen) && ['B', 'P', 'M'].includes(cmd) && (await handleHistoryBack(), true),
      async () => HISTORY_BACK_SCREENS.has(screen) && cmd === 'T' && (await showMain(), true),
      async () => await handleChatCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handleMemoCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handleMyInfoCommand({ input, rawCmd: normalized, cmd, context }),
      async () => await handlePostViewCommand({ cmd, context }),
      async () => screen === 'system-log' && (await handleLogCommand(cmd, context))
    ];

    try {
      let handled = false;
      for (const execute of dispatcherPipeline) {
        if (!(await execute())) {
          continue;
        }

        handled = true;
        if (!context.quiet) {
          soundService.playBeep();
        }
        if (!sensitiveInput && typeof recordCommandExecution === 'function') {
          recordCommandExecution(cmd);
        }
        break;
      }

      if (statusManager) {
        statusManager.update();
      }

      if (!handled && input && !['F', 'B', 'P', 'M', 'T'].includes(cmd)) {
        // [LOG: 20260507_1510] PC통신 UI에는 unknown-command footer feedback이 없으므로 조용히 무시한다.
        return false;
      }

      return handled;
    } catch (error) {
      if (error?.type === 'cancelled') {
        setPrompt('선택 >>');
        return false;
      }
      const rawMsg = error?.message || '명령 처리 중 오류가 발생했습니다.';
      const isSelfError = rawMsg.includes('본인') || rawMsg.includes('자신') || rawMsg.includes('own post');
      const isAlreadyError = rawMsg.includes('이미') || rawMsg.includes('already');
      const isUnexpectedEnd = rawMsg.includes('Unexpected end of input') || rawMsg.includes('JSON');
      const hintMsg = isSelfError ? (UI_TEXT.POST_RECOMMEND_SELF_FORBIDDEN || '자신의 글은 추천할 수 없습니다.')
                    : isAlreadyError ? (UI_TEXT.POST_RECOMMEND_ALREADY || '이미 추천한 게시물입니다.')
                    : isUnexpectedEnd ? '수신 데이터 처리 불가 - 응답 형식 오류입니다.'
                    : `오류: ${rawMsg}`;
      if (!isSelfError && !isAlreadyError) {
        // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
        // console.error('[Dispatcher] Error processing command:', error);
      }
      if (typeof setHint === 'function') {
        setHint(hintMsg);
      } else {
        terminalUiCore.showError(hintMsg);
      }
      setPrompt('선택 >>');
      return false;
    }
  }

  return {
    executeSingleCommand
  };
}
