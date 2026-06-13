export function createAppFactoryHandlers(deps) {
  const {
    createBrowseCommandHandler,
    createChatCommandHandler,
    createEntryCommandHandler,
    createGlobalCommandHandler,
    createMemoCommandHandler,
    createMyInfoCommandHandler,
    createPostViewCommandHandler,
    createServiceCommandHandler,
    createVfsCommandHandler,
    refs,
    screens,
    services,
    state
  } = deps;

  const handlerDeps = {
    state,
    setHint: services.terminalUiCore.setHint,
    setPrompt: services.terminalUiCore.setPrompt,
    showMain: screens.showMain,
    showBoardSelect: screens.showBoardSelect,
    updateURL: (...args) => refs.updateURL(...args)
  };

  const handleServiceCommand = createServiceCommandHandler({
    ...handlerDeps,
    ...screens.serviceScreens,
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
    showToast: services.terminalUiCore.showToast
  });
  const handleChatCommand = createChatCommandHandler({
    ...handlerDeps,
    ...screens.chatScreens,
    ansiToHTML: services.ansiToHTML,
    apiFetch: services.apiFetch,
    buildChatRoomAnsi: services.serviceAnsiBuilders.buildChatRoomAnsi,
    cmdInput: services.cmdInput,
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
    showConfirm: services.terminalUiCore.showConfirm,
    showAlert: services.terminalUiCore.showAlert,
    showPrompt: services.terminalUiCore.showPrompt,
    showToast: services.terminalUiCore.showToast,
    deletePost: services.postService.deletePost,
    recommendPost: services.postService.recommendPost,
    restoreStateFromURL: (...args) => refs.restoreStateFromURL(...args),
    showAttachmentList: screens.postScreens.showAttachmentList,
    downloadAttachment: services.postService.downloadAttachment
  });

  const handleCmdRef = (...args) => {
    if (typeof refs.handleCmd === 'function') {
      return refs.handleCmd(...args);
    }
    return false;
  };

  const globalCommandHandlerDeps = {
    state,
    refs,
    doLogout: services.authService.doLogout,
    toggleTheme: services.toggleTheme,
    toggleHintExpansion: services.terminalUiCore.toggleHintExpansion,
    showConfirm: services.terminalUiCore.showConfirm,
    showAlert: services.terminalUiCore.showAlert,
    showPrompt: services.terminalUiCore.showPrompt,
    showEditor: services.terminalUiCore.showEditor,
    executeGoCommand: screens.menuNav.executeGoCommand,
    showProfile: screens.profileScreens.showProfile,
    showActiveUsers: screens.systemScreens.showActiveUsers,
    showSystemDiagnostics: screens.systemScreens.showSystemDiagnostics,
    showActivitySummary: screens.systemScreens.showActivitySummary,
    showSystemLog: screens.systemLogScreens.showSystemLog,
    showMemoList: screens.memoScreens.showMemoList,
    showMyInfo: screens.myInfoScreens.showMyInfo,
    showChatLobby: screens.chatScreens.showChatLobby,
    showHelp: screens.helpScreens.showHelp,
    showHistory: screens.helpScreens.showHistory,
    handleHistoryBack: screens.handleHistoryBack,
    setHint: services.terminalUiCore.setHint,
    setPrompt: services.terminalUiCore.setPrompt,
    findBoardByCode: services.boardService.findBoardByCode,
    showPostList: screens.postScreens.showPostList,
    showLogin: screens.authScreens.showLogin,
    toggleMute: services.soundService.toggleMute,
    workspaceService: services.workspaceService,
    aliasService: services.aliasService,
    vfsService: services.vfsService,
    networkService: services.networkService,
    adjustZoom: services.terminalUiCore.adjustZoom,
    setZoom: services.terminalUiCore.setZoom,
    autoAdjustZoom: services.terminalUiCore.autoAdjustZoom,
    setScale: services.settingsService.setScale,
    performanceService: services.performanceService,
    handleCmd: handleCmdRef
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
    handleVfsCommand: createVfsCommandHandler(globalCommandHandlerDeps)
  };
}
