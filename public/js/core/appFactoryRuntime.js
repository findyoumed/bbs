export function initializeAppFactoryRuntime(deps) {
  const {
    ApiError,
    UI_TEXT,
    bindAppEvents,
    createCommandDispatcher,
    createInteractionHandlers,
    createRoutingModule,
    refs,
    screens,
    services,
    state,
    handlers
  } = deps;

  Object.assign(refs, {
    ...screens.postScreens,
    ...screens.serviceScreens,
    ...screens.chatScreens,
    ...screens.authScreens,
    ...screens.voteScreens,
    ...screens.confScreens,
    ...screens.amusementScreens,
    // [LOG_ID: 20260713_1700] refs에 빠져 있어 refs.showMemoList가 항상 undefined였다 —
    // 메인 메뉴에 쪽지함 진입점이 없던 문제(menuNavigationActions type='memo')와
    // 쪽지 화면에서 뒤로가기 시 메인으로 튕기던 문제(menuNavigation.js handleHistoryBack)
    // 둘 다 이 누락이 원인이었다.
    ...screens.memoScreens,
    // [LOG_ID: 20260713_2100] refs.showHelp/showPolicy가 빠져 있어 GUIDE 메뉴의
    // "명령어안내"/"이용약관"/"개인정보처리방침" 바로가기(menuNavigationActions type='help'/'policy')가
    // 항상 조용히 실패(return false)하던 문제 — MEMO 때(20260713_1700)와 동일한 유형의 누락.
    showHelp: screens.helpScreens.showHelp,
    showPolicy: screens.policyScreens.showPolicy,
    // [LOG_ID: 20260716_1400] 이용자검색(menuNavigationActions type='member-search') 진입점.
    // showMemoList(20260713_1700)·showHelp/showPolicy(20260713_2100) 때와 동일한 누락이
    // 나지 않도록 refs·routingModule 양쪽에 함께 등록한다.
    ...screens.memberSearchScreens,
    // [LOG_ID: 20260716_1600] 전체 메뉴 안내(menuNavigationActions type='menu-index').
    ...screens.menuIndexScreens,
    // [LOG_ID: 20260716_2200] 이용 현황(menuNavigationActions type='my-stats').
    showMyStats: screens.systemScreens.showMyStats,
    // [LOG_ID: 20260720_2300] 건의하기(menuNavigationActions type='contact-sysop').
    ...screens.contactSysopScreens,
    showSignup: screens.signupModule.showSignup,
    showMain: screens.showMain,
    preloadBootstrap: screens.preloadBootstrap,
    showBoardSelect: screens.showBoardSelect,
    showMyInfo: screens.myInfoScreens.showMyInfo,
    handleLoginIdSubmit: async (userId) => {
      const normalizedUserId = String(userId || '').trim().toLowerCase();
      const isEmailLoginId = normalizedUserId.includes('@');
      const messageEl = document.getElementById('l-error');
      if (messageEl) messageEl.textContent = '';
      // [LOG: 20260503_2135] Validate the ID before moving to the password prompt.
      if (!normalizedUserId) {
        return false;
      }
      if (normalizedUserId === 'guest' || userId === '손님') {
        screens.signupModule.showSignup();
        return false;
      }

      try {
        services.terminalUiCore.setBusy(true);
        // [LOG: 20260507_1757] Login accepts either a BBS userId or registered email in the 회원 ID prompt.
        const member = await services.authService.searchMember(isEmailLoginId
          ? { email: normalizedUserId }
          : { userId });
        if (!member) {
          if (messageEl) {
            messageEl.textContent = isEmailLoginId
              ? '입력하신 이메일 또는 ID는 없습니다. 확인후 입력하십시오.'
              : '입력하신 ID는 없습니다. 확인후 입력하십시오.';
          }
          return false;
        }
        return true;
      } catch (error) {
        if (messageEl) {
          messageEl.textContent = error.message || '회원 정보를 조회하지 못했습니다.';
        }
        return false;
      } finally {
        services.terminalUiCore.setBusy(false);
      }
    },
    handleLoginSubmit: async () => {
      const userId = document.getElementById('l-id')?.value.trim();
      const password = document.getElementById('l-pw')?.value;
      const normalizedUserId = String(userId || '').trim().toLowerCase();
      // [LOG: 20260503_2054] PC통신식 guest 입력은 로그인 대신 회원가입 메뉴로 이동.
      if (normalizedUserId === 'guest' || userId === '손님') {
        screens.signupModule.showSignup();
        return;
      }
      if (!userId || !password) {
        return;
      }
      try {
        services.terminalUiCore.setBusy(true);
        // Auth state listeners and the explicit login refresh can complete
        // before showMain() starts. Hold unread notifications across that
        // transition so the screen render cannot erase the toast.
        state._deferUnreadMemoNotification = true;
        await services.authService.doLogin(userId, password);
        await screens.showMain();
        state._deferUnreadMemoNotification = false;
        services.terminalUiCore.showToast(UI_TEXT.LOGIN_SUCCESS, 2000, 'success');
        await services.authService.flushUnreadMemoNotification?.();
      } catch (error) {
        const messageEl = document.getElementById('l-error');
        if (messageEl) {
          messageEl.textContent = error.message || '로그인에 실패했습니다.';
        }
      } finally {
        state._deferUnreadMemoNotification = false;
        services.terminalUiCore.setBusy(false);
      }
    },
    handlePasswordResetSubmit: async () => {
      const messageEl = document.getElementById('pw-reset-message');
      if (messageEl) {
        messageEl.textContent = '';
      }
      try {
        services.terminalUiCore.setBusy(true);
        if (state._passwordResetMode === 'update') {
          const password = document.getElementById('pw-reset-pw')?.value;
          const confirmPassword = document.getElementById('pw-reset-pw-confirm')?.value;
          await services.authService.updatePasswordByRecovery(password, confirmPassword);
          state._passwordRecoveryActive = false;
          state._passwordResetMode = 'request';
          state._loginNotice = '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주십시오.';
          await services.authService.doLogout();
          screens.authScreens.showLogin();
          services.terminalUiCore.showToast(UI_TEXT.PASSWORD_CHANGED, 3000, 'success');
          return;
        }

        const value = document.getElementById('pw-reset-id')?.value.trim();
        state._passwordResetValue = value;
        await services.authService.requestPasswordReset(value);
        if (messageEl) {
          messageEl.textContent = UI_TEXT.PASSWORD_RESET_SENT;
        }
        // [LOG: 20260509_1116] Keep password reset success in the current transcript instead of redrawing the screen above the prompt.
        services.terminalUiCore.showToast(UI_TEXT.PASSWORD_RESET_SENT, 3000, 'success');
      } catch (error) {
        if (messageEl) {
          messageEl.textContent = `${UI_TEXT.ERROR}: ${error.message}`;
        }
        services.terminalUiCore.showToast(error.message, 3000, 'error');
      } finally {
        services.terminalUiCore.setBusy(false);
      }
    },
    handlePasswordResetCancel: async () => {
      if (state._passwordRecoveryActive) {
        await services.authService.doLogout();
      }
      state._passwordRecoveryActive = false;
      state._passwordResetMode = 'request';
      await screens.showBoardSelect('log', screens.getBoardSelectTitle('log'));
    }
  });

  const routingModule = createRoutingModule({
    ...screens.menuNav,
    ...screens.postScreens,
    ...screens.serviceScreens,
    ...screens.chatScreens,
    ...screens.authScreens,
    ...screens.memoScreens,
    ...screens.voteScreens,
    ...screens.confScreens,
    ...screens.amusementScreens,
    getAuthLeafRoutePath: services.menuService.getAuthLeafRoutePath,
    getMenuNodeByKey: services.menuService.getMenuNodeByKey,
    getMenuNodeKey: services.menuService.getMenuNodeKey,
    getMenuNodeRoutePath: services.menuService.getMenuNodeRoutePath,
    loadMenuTree: services.menuService.loadMenuTree,
    resolveMenuRoute: services.menuService.resolveMenuRoute,
    showHelp: screens.helpScreens.showHelp,
    showHistory: screens.helpScreens.showHistory,
    // [LOG_ID: 20260715_2400] policy(이용약관/개인정보처리방침) 화면이 routingModule deps에
    // 빠져 있어 URL 라우팅(buildURLForState/restoreStateFromURL)이 이 화면을 아예 모르는
    // 상태였다 — showHelp/showHistory 때(20260713_2100/2300)와 동일한 유형의 누락.
    showPolicy: screens.policyScreens.showPolicy,
    // [LOG_ID: 20260716_1400] /member URL 라우팅(buildURLForState/restoreStateFromURL)용.
    showMemberSearch: screens.memberSearchScreens.showMemberSearch,
    // [LOG_ID: 20260716_1600] /index URL 라우팅용.
    showMenuIndex: screens.menuIndexScreens.showMenuIndex,
    // [LOG_ID: 20260720_2300] /tosysop URL 라우팅용.
    showContactSysop: screens.contactSysopScreens.showContactSysop,
    // [LOG_ID: 20260716_2200] /account URL 라우팅용.
    showMyStats: screens.systemScreens.showMyStats,
    showMyInfo: screens.myInfoScreens.showMyInfo,
    showProfile: screens.profileScreens.showProfile,
    showSignup: screens.signupModule.showSignup,
    showSystemLog: screens.systemLogScreens.showSystemLog,
    // [LOG_ID: 20260721_1715] URL 대소문자 무관 복원을 위한 findBoardByKey 의존성 주입 추가
    findBoardByKey: services.boardService.findBoardByKey,
    // [LOG_ID: 20260724_1900] restoreStateFromURL이 findBoardByKey를 쓰려면 state.boards가
    // 먼저 채워져 있어야 하는데 loadBoards가 주입되지 않았었다 — loadMenuTree와 같은 유형의 누락.
    loadBoards: services.boardService.loadBoards,
    state,
    statusManager: services.statusManager,
    logger: services.logger
  });
  refs.updateURL = routingModule.updateURL;
  refs.restoreStateFromURL = routingModule.restoreStateFromURL;

  const { handleCmd } = createCommandDispatcher({
    state,
    terminalUiCore: services.terminalUiCore,
    statusManager: services.statusManager,
    soundService: services.soundService,
    recordCommandExecution: services.settingsService.recordCommandExecution,
    logger: services.logger,
    handlers: {
      handleGlobalCommand: handlers.handleGlobalCommand,
      handleEntryCommand: handlers.handleEntryCommand,
      handleBrowseCommand: handlers.handleBrowseCommand,
      handleServiceCommand: handlers.handleServiceCommand,
      handleChatCommand: handlers.handleChatCommand,
      handleMemoCommand: handlers.handleMemoCommand,
      handleMyInfoCommand: handlers.handleMyInfoCommand,
      handlePostViewCommand: handlers.handlePostViewCommand,
      handleLogCommand: screens.systemLogScreens.handleLogCommand,
      // [LOG: 20260623_0013] vote command handler 연결 (origin/main 포팅)
      handleVoteCommand: handlers.handleVoteCommand,
      handleConfCommand: handlers.handleConfCommand
    },
    screens: {
      showMain: screens.showMain,
      handleHistoryBack: screens.handleHistoryBack,
      postScreens: screens.postScreens
    },
    setPrompt: services.terminalUiCore.setPrompt
  });
  refs.handleCmd = handleCmd;

  const interactionHandlers = createInteractionHandlers({
    state,
    handleCmd,
    showPostView: screens.postScreens.showPostView,
    showPostList: screens.postScreens.showPostList,
    showBoardSelect: screens.showBoardSelect,
    getBoardSelectTitle: screens.getBoardSelectTitle,
    getMenuNodeByKey: services.menuService.getMenuNodeByKey,
    executeMenuNodeAction: screens.menuNav.executeMenuNodeAction,
    cmdInput: services.cmdInput,
    moveCaretToEnd: () => {
      const el = document.getElementById('cmd-input');
      if (el && typeof el.setSelectionRange === 'function') {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    },
    setGhostText: services.terminalUiCore.setGhostText,
    setSuggestions: services.terminalUiCore.setSuggestions
  });
  bindAppEvents({
    cmdInput: services.cmdInput,
    handleCmd,
    state,
    setSuggestions: services.terminalUiCore.setSuggestions,
    setGhostText: services.terminalUiCore.setGhostText,
    setPrompt: services.terminalUiCore.setPrompt,
    setReady: services.terminalUiCore.setReady,
    interruptRendering: services.terminalUiCore.interruptRendering,
    saveHistory: services.settingsService.saveHistory,
    jumpToContent: screens.jumpToContent,
    interactionHandlers
  });

  let hasLoggedSystemInfo = false;
  window.onerror = (message, source, lineno, colno, error) => {
    if (!hasLoggedSystemInfo && services.logger) {
      services.logger.logSystemInfo();
      hasLoggedSystemInfo = true;
    }

    const errorDetails = { source, lineno, colno, stack: error?.stack };
    if (services.logger) {
      services.logger.fatal(`런타임 오류: ${message}`, errorDetails);
    } else {
      // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
      // console.error('Global JS Error:', message, errorDetails);
    }

    services.terminalUiCore.showError(`런타임 오류: ${message}`);
    services.terminalUiCore.showToast('시스템 오류가 발생했습니다.', 3000, 'error');
    services.terminalUiCore.setPrompt('>>');
    services.terminalUiCore.setBusy(false);
    services.terminalUiCore.setFooterVisibility(true);
  };
  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);
    if (services.logger) {
      services.logger.error(`비동기 오류 (Unhandled Rejection): ${message}`, {
        reason,
        stack: reason?.stack
      });
    } else {
      // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
      // console.error('Unhandled Rejection:', reason);
    }
    if (!(reason instanceof ApiError)) {
      services.terminalUiCore.showToast('비동기 처리 중 오류가 발생했습니다.', 3000, 'warn');
    }
  };

  return {
    guestUser: services.authService.guestUser,
    flushUnreadMemoNotification: services.authService.flushUnreadMemoNotification,
    initAuth: services.authService.initAuth,
    initTooltips: services.terminalUiCore.initTooltips,
    renderInitError: services.terminalUiCore.renderInitError,
    restoreStateFromURL: refs.restoreStateFromURL,
    restoreTheme: services.restoreTheme,
    preloadBootstrap: screens.preloadBootstrap,
    showMain: screens.showMain,
    showPasswordReset: screens.authScreens.showPasswordReset,
    updateURL: refs.updateURL,
    // [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 "자동접속 차단시간"(SET IDLE) — app.js의 유휴 타이머가
    // 시간 초과 시 호출한다. 텍스트 입력 컨텍스트(대화실 메시지 등)를 거치는 handleCmd 파이프라인을
    // 타지 않고 로그아웃+리다이렉트를 직접 수행해, "BYE"가 채팅 메시지로 전송되는 오작동을 피한다.
    forceExit: async () => {
      if (!state.user?.isGuest) {
        await services.authService.doLogout();
      }
      window.location.assign('/');
    }
  };
}
