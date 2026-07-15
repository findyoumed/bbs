// [LOG: 20260623_0013] origin/main에서 vote/ranking command handler 포팅 (self-contained import)
import { createVoteCommandHandler } from './commandRouterVote.js';
import { createRankingCommandHandler } from './commandRouterRanking.js';

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
    // [LOG_ID: 20260713_0930] LV 등급변경(운영자) — olddos-bbs 원작 명령 복원
    apiFetch: services.apiFetch
  });

  // [LOG: 20260623_0013] vote/ranking command handler (origin/main 포팅)
  const handleVoteCommand = createVoteCommandHandler({
    ...handlerDeps,
    ...screens.voteScreens
  });
  const handleRankingCommand = createRankingCommandHandler({
    ...handlerDeps,
    ...screens.rankingScreens
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
    applyTheme: services.applyTheme,
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
    showMemoWrite: screens.memoScreens.showMemoWrite,
    showMyInfo: screens.myInfoScreens.showMyInfo,
    showChatLobby: screens.chatScreens.showChatLobby,
    showHelp: screens.helpScreens.showHelp,
    showHistory: screens.helpScreens.showHistory,
    showPolicy: screens.policyScreens.showPolicy,
    // [LOG_ID: 20260716_1600] 전체 메뉴 안내(INDEX) F/B 페이징·코드 직접 입력 처리용.
    showMenuIndex: screens.menuIndexScreens.showMenuIndex,
    handleHistoryBack: screens.handleHistoryBack,
    setHint: services.terminalUiCore.setHint,
    setPrompt: services.terminalUiCore.setPrompt,
    findBoardByCode: services.boardService.findBoardByCode,
    showPostList: screens.postScreens.showPostList,
    showLogin: screens.authScreens.showLogin,
    toggleMute: services.soundService.toggleMute,
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
    // [LOG: 20260623_0013] vote/ranking command handler 리턴 (origin/main 포팅)
    handleVoteCommand,
    handleRankingCommand
  };
}
