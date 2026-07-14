export function initializeAppFactoryRuntime(deps) {
  const {
    ApiError,
    UI_TEXT,
    bindAppEvents,
    createCommandDispatcher,
    createCommandPalette,
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
    ...screens.rankingScreens,
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
    showSignup: screens.signupModule.showSignup,
    showMain: screens.showMain,
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
        await services.authService.doLogin(userId, password);
        await screens.showMain();
        services.terminalUiCore.showToast(UI_TEXT.LOGIN_SUCCESS, 2000, 'success');
      } catch (error) {
        const messageEl = document.getElementById('l-error');
        if (messageEl) {
          messageEl.textContent = error.message || '로그인에 실패했습니다.';
        }
      } finally {
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
    ...screens.rankingScreens,
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
    showMyInfo: screens.myInfoScreens.showMyInfo,
    showProfile: screens.profileScreens.showProfile,
    showSignup: screens.signupModule.showSignup,
    showSystemLog: screens.systemLogScreens.showSystemLog,
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
      // [LOG: 20260623_0013] vote/ranking command handler 연결 (origin/main 포팅)
      handleVoteCommand: handlers.handleVoteCommand,
      handleRankingCommand: handlers.handleRankingCommand
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
  const commandPalette = createCommandPalette({
    state,
    terminalUiCore: services.terminalUiCore,
    handleCmd,
    soundService: services.soundService
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
    interactionHandlers,
    commandPalette
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
      console.error('Global JS Error:', message, errorDetails);
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
      console.error('Unhandled Rejection:', reason);
    }
    if (!(reason instanceof ApiError)) {
      services.terminalUiCore.showToast('비동기 처리 중 오류가 발생했습니다.', 3000, 'warn');
    }
  };

  return {
    guestUser: services.authService.guestUser,
    initAuth: services.authService.initAuth,
    initTooltips: services.terminalUiCore.initTooltips,
    renderInitError: services.terminalUiCore.renderInitError,
    restoreStateFromURL: refs.restoreStateFromURL,
    restoreTheme: services.restoreTheme,
    showMain: screens.showMain,
    showPasswordReset: screens.authScreens.showPasswordReset,
    updateURL: refs.updateURL
  };
}
