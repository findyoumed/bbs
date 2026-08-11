export function createAppFactoryHandlers(deps) {
  const {
    createBrowseCommandHandler,
    createChatCommandHandler,
    createConfCommandHandler,
    createEntryCommandHandler,
    createGlobalCommandHandler,
    createMemoCommandHandler,
    createMyInfoCommandHandler,
    createPostViewCommandHandler,
    createServiceCommandHandler,
    createVoteCommandHandler,
    refs,
    screens,
    services,
    state
  } = deps;

  const handlerDeps = {
    state,
    executeGoCommand: (...args) => screens.menuNav?.executeGoCommand?.(...args),
    setHint: services.terminalUiCore.setHint,
    setPrompt: services.terminalUiCore.setPrompt,
    showMain: screens.showMain,
    showBoardSelect: screens.showBoardSelect,
    updateURL: (...args) => refs.updateURL(...args)
  };

  const handleServiceCommand = createServiceCommandHandler({
    ...handlerDeps,
    ...screens.serviceScreens,
    ...screens.amusementScreens,
    // [LOG_ID: 20260716_1400] 이용자검색 화면의 자유입력(아이디/닉네임)·BYID/BYNAME 처리.
    ...screens.memberSearchScreens,
    showToast: services.terminalUiCore.showToast
  });
  const handleEntryCommand = createEntryCommandHandler({
    ...handlerDeps,
    handleLoginSubmit: () => refs.handleLoginSubmit(),
    handlePasswordResetSubmit: () => refs.handlePasswordResetSubmit(),
    handlePasswordResetCancel: () => refs.handlePasswordResetCancel(),
    handleWriteSubmit: screens.postScreens.handleWriteSubmit,
    cancelPostWrite: screens.postScreens.cancelPostWrite
  });
  const handleBrowseCommand = createBrowseCommandHandler({
    ...handlerDeps,
    ...screens.menuNav,
    ...screens.postScreens,
    apiFetch: services.apiFetch,
    deletePost: services.postService.deletePost,
    doLogout: services.authService.doLogout,
    getMenuChildren: services.menuService.getMenuChildren,
    getMenuNodeByKey: services.menuService.getMenuNodeByKey,
    getMenuNodeKey: services.menuService.getMenuNodeKey,
    getMenuNodeTitle: services.menuService.getMenuNodeTitle,
    getMenuParentKey: (key) => state.menuParents[key] || '',
    resolveMenuNodeTarget: (target, nodes) => (nodes || []).find((node) =>
      [node?.door, node?.go, node?.id, services.menuService.getMenuNodeLabel(node), services.menuService.getMenuNodeCode(node)]
        .map(services.boardService.normalizeSearchKey)
        .includes(services.boardService.normalizeSearchKey(target))),
    showChatLobby: screens.chatScreens.showChatLobby,
    showLogin: screens.authScreens.showLogin,
    showToast: services.terminalUiCore.showToast,
    showAlert: services.terminalUiCore.showAlert
  });
  const handleChatCommand = createChatCommandHandler({
    ...handlerDeps,
    ...screens.chatScreens,
    ansiToHTML: services.ansiToHTML,
    apiFetch: services.apiFetch,
    cmdInput: services.cmdInput,
    // [LOG_ID: 20260805_1435] 지연 로딩된 채팅 ANSI 빌더의 폭 계산 의존성 전달.
    displayWidth: services.displayWidth,
    isWideChar: services.isWideChar,
    restoreStateFromURL: (...args) => refs.restoreStateFromURL(...args),
    screenEl: services.screenEl
  });
  const handleMemoCommand = createMemoCommandHandler({
    ...handlerDeps,
    ...screens.memoScreens,
    apiFetch: services.apiFetch
  });
  const handleMyInfoCommand = createMyInfoCommandHandler({ ...handlerDeps, ...screens.myInfoScreens });
  const handlePostViewCommand = createPostViewCommandHandler({
    ...handlerDeps,
    ...screens.postScreens,
    renderScreenSequential: services.terminalUiCore.renderScreenSequential,
    showConfirm: services.terminalUiCore.showConfirm,
    showAlert: services.terminalUiCore.showAlert,
    showPrompt: services.terminalUiCore.showPrompt,
    showToast: services.terminalUiCore.showToast,
    deletePost: services.postService.deletePost,
    recommendPost: services.postService.recommendPost,
    restoreStateFromURL: (...args) => refs.restoreStateFromURL(...args),
    showAttachmentList: screens.postScreens.showAttachmentList,
    downloadAttachment: services.postService.downloadAttachment,
    uploadAttachment: services.postService.uploadAttachment,
    // [LOG_ID: 20260713_0930] LV 등급변경(운영자) — olddos-bbs 원작 명령 복원
    apiFetch: services.apiFetch
  });

  // [LOG: 20260623_0013] vote command handler (origin/main 포팅)
  const handleVoteCommand = createVoteCommandHandler({
    ...handlerDeps,
    ...screens.voteScreens
  });
  // [LOG_ID: 20260719_1600] 토론의 광장(CONF) command handler
  const handleConfCommand = createConfCommandHandler({
    ...handlerDeps,
    ...screens.confScreens
  });

  const handleCmdRef = (...args) => {
    if (typeof refs.handleCmd === 'function') {
      return refs.handleCmd(...args);
    }
    return false;
  };

  const globalCommandHandlerDeps = {
    ...handlerDeps,
    ...screens.menuNav,
    state,
    refs,
    // [LOG_ID: 20260810_1530] #cmd-hint의 SEND/P/T 클릭 명령도 건의하기 전용
    // raw-input 처리기와 동일한 흐름으로 실행되도록 전역 라우터에 주입한다.
    handleContactSysopRawInput: screens.contactSysopScreens.handleContactSysopRawInput,
    // [LOG_ID: 20260811_1610] WHO/WH/UID global commands call the active-user
    // screen directly; omit it here and the command fails at runtime.
    showActiveUsers: screens.systemScreens.showActiveUsers,
    // [LOG_ID: 20260811_1615] Global navigation/runtime commands use these
    // screen and service functions directly; keep the dependency graph
    // explicit so H/C/SYSINFO and related commands cannot fail at runtime.
    showProfile: screens.profileScreens.showProfile,
    showMyInfo: screens.myInfoScreens.showMyInfo,
    showHelp: screens.helpScreens.showHelp,
    showHistory: screens.helpScreens.showHistory,
    showPolicy: screens.policyScreens.showPolicy,
    showMenuIndex: screens.menuIndexScreens.showMenuIndex,
    showPostList: screens.postScreens.showPostList,
    showSystemDiagnostics: screens.systemScreens.showSystemDiagnostics,
    showActivitySummary: screens.systemScreens.showActivitySummary,
    showSystemLog: screens.systemLogScreens.showSystemLog,
    showMemoList: screens.memoScreens.showMemoList,
    showMemoMenu: screens.memoScreens.showMemoMenu,
    showMemoWrite: screens.memoScreens.showMemoWrite,
    doLogout: services.authService.doLogout,
    // [LOG_ID: 20260811_1400] Global FIND navigation calls the board index
    // helper directly, so provide the service method to the command router.
    findBoardByCode: services.boardService.findBoardByCode,
    showLogin: screens.authScreens.showLogin,
    toggleMute: services.soundService.toggleMute,
    toggleTheme: services.toggleTheme,
    networkService: services.networkService,
    adjustZoom: services.terminalUiCore.adjustZoom,
    setZoom: services.terminalUiCore.setZoom,
    autoAdjustZoom: services.terminalUiCore.autoAdjustZoom,
    setScale: services.settingsService.setScale,
    // [LOG_ID: 20260711_2340] SET/UNSET이 envVars를 localStorage에 저장할 때 쓰는
    // settingsService.saveEnvVars 경로 — 서비스 자체가 주입되지 않아 저장이 항상 건너뛰어졌다.
    settingsService: services.settingsService,
    performanceService: services.performanceService,
    handleCmd: handleCmdRef,
    apiFetch: services.apiFetch
  };

  return {
    globalCommandHandlerDeps,
    handleBrowseCommand,
    handleChatCommand,
    handleEntryCommand,
    handleGlobalCommand: createGlobalCommandHandler(globalCommandHandlerDeps),
    handleMemoCommand,
    handleMyInfoCommand,
    handlePostViewCommand,
    handleServiceCommand,
    // [LOG: 20260623_0013] vote command handler 리턴 (origin/main 포팅)
    handleVoteCommand,
    handleConfCommand
  };
}
