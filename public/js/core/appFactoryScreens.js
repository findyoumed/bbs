export function createAppFactoryScreens(deps) {
  const {
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    createAuthScreens,
    createChatScreens,
    createHelpScreens,
    createMemoScreens,
    createMenuNavigation,
    createMyInfoScreens,
    createPostScreens,
    createProfileScreens,
    createServiceScreens,
    createSignupModule,
    createSignupScreens,
    createSystemLogScreens,
    createSystemScreens,
    refs,
    renderMenuHotspots,
    services,
    state,
    buildMenuHotspotsFromRows
  } = deps;

  const {
    ansiToHTML,
    apiFetch,
    authService,
    boardAnsiBuilders,
    boardService,
    cmdInput,
    dataService,
    displayWidth,
    getCommandFooterText,
    getSupportedFooterText,
    hintEl,
    isWideChar,
    logger,
    menuService,
    postService,
    screenEl,
    serviceAnsiBuilders,
    systemAnsiBuilders,
    terminalUiCore
  } = services;

  const screenDeps = {
    ansiToHTML,
    displayWidth,
    isWideChar,
    applyCommandFooter: terminalUiCore.applyCommandFooter,
    mountPromptRow: terminalUiCore.mountPromptRow,
    restorePromptRow: terminalUiCore.restorePromptRow,
    state,
    setHint: terminalUiCore.setHint,
    setFooterVisibility: terminalUiCore.setFooterVisibility,
    setPrompt: terminalUiCore.setPrompt,
    setLoading: terminalUiCore.setLoading,
    buildLoadingScreenMarkup: terminalUiCore.buildLoadingScreenMarkup,
    esc: terminalUiCore.esc,
    renderScreenSequential: terminalUiCore.renderScreenSequential,
    cmdInput,
    // [LOG: 20260429_0704] Direct signup sub-routes render confirm inputs in the shared footer hint area.
    hintEl,
    screenEl,
    getCommandFooterText,
    getSupportedFooterText,
    updateURL: (...args) => refs.updateURL(...args)
  };

  const systemScreens = createSystemScreens({
    ...screenDeps,
    apiFetch,
    buildActiveUsersAnsi: systemAnsiBuilders.buildActiveUsersAnsi,
    buildSystemDiagnosticsAnsi: systemAnsiBuilders.buildSystemDiagnosticsAnsi,
    buildActivitySummaryAnsi: systemAnsiBuilders.buildActivitySummaryAnsi
  });
  const systemLogScreens = createSystemLogScreens({
    ...screenDeps,
    logger,
    showToast: terminalUiCore.showToast,
    buildSystemLogAnsi: systemAnsiBuilders.buildSystemLogAnsi
  });
  const menuNav = createMenuNavigation({
    ...screenDeps,
    ...boardService,
    ...menuService,
    buildBoardSelectAnsi: boardAnsiBuilders.buildBoardSelectAnsi,
    buildMainMenuAnsi: boardAnsiBuilders.buildMainMenuAnsi,
    buildMenuHotspotsFromRows,
    renderMenuHotspots,
    startOAuthLogin: authService.startOAuthLogin,
    refs
  });
  const { handleHistoryBack, showMain, showBoardSelect, getBoardSelectTitle, jumpToContent } = menuNav;

  const serviceScreens = createServiceScreens({
    ...screenDeps,
    ...dataService,
    buildBoardSelectAnsi: boardAnsiBuilders.buildBoardSelectAnsi,
    buildLocalWeatherAnsi: serviceAnsiBuilders.buildLocalWeatherAnsi,
    buildWeatherLocalAnsi: serviceAnsiBuilders.buildWeatherLocalAnsi,
    buildWeatherMenuAnsi: serviceAnsiBuilders.buildWeatherMenuAnsi,
    buildNewsArticleAnsi: serviceAnsiBuilders.buildNewsArticleAnsi,
    buildNewsListAnsi: serviceAnsiBuilders.buildNewsListAnsi,
    buildWeatherAnsi: serviceAnsiBuilders.buildWeatherAnsi,
    getBoardKey: boardService.getBoardKey,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  const postScreens = createPostScreens({
    ...screenDeps,
    ...postService,
    buildAttachmentListAnsi: boardAnsiBuilders.buildAttachmentListAnsi,
    buildPostListAnsi: boardAnsiBuilders.buildPostListAnsi,
    buildPostViewAnsi: boardAnsiBuilders.buildPostViewAnsi,
    downloadAttachment: postService.downloadAttachment,
    findBoardByKey: boardService.findBoardByKey,
    getBoardKey: boardService.getBoardKey,
    getBoardSelectTitle,
    loadAttachments: postService.loadAttachments,
    loadMenuTree: menuService.loadMenuTree,
    showMain
  });
  const chatScreens = createChatScreens({
    ...screenDeps,
    apiFetch,
    buildChatLobbyAnsi: serviceAnsiBuilders.buildChatLobbyAnsi,
    buildChatRoomAnsi: serviceAnsiBuilders.buildChatRoomAnsi,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  const authScreens = createAuthScreens({
    ...screenDeps,
    getAuthLeafRoutePath: menuService.getAuthLeafRoutePath,
    getBoardSelectTitle,
    showBoardSelect,
    showMain,
    handleLoginIdSubmit: (userId) => refs.handleLoginIdSubmit(userId),
    handleLoginSubmit: () => refs.handleLoginSubmit(),
    handlePasswordResetCancel: () => refs.handlePasswordResetCancel(),
    handlePasswordResetSubmit: () => refs.handlePasswordResetSubmit()
  });
  const memoScreens = createMemoScreens({
    ...screenDeps,
    apiFetch,
    buildMemoListAnsi: serviceAnsiBuilders.buildMemoListAnsi,
    buildMemoViewAnsi: serviceAnsiBuilders.buildMemoViewAnsi,
    getMenuNodeByKey: menuService.getMenuNodeByKey,
    showMain
  });
  const signupModule = createSignupModule({
    ...screenDeps,
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    createSignupScreens,
    getMenuNodeByKey: menuService.getMenuNodeByKey,
    getMenuNodeLabel: menuService.getMenuNodeLabel,
    getMenuParentNode: menuService.getMenuParentNode,
    precheckSignup: authService.precheckSignup,
    searchMember: authService.searchMember,
    showMain,
    doSignup: authService.doSignup
  });
  const helpScreens = createHelpScreens({ ...screenDeps });
  const profileScreens = createProfileScreens({ ...screenDeps, apiFetch });
  const myInfoScreens = createMyInfoScreens({
    ...screenDeps,
    apiFetch,
    doLogin: authService.doLogin,
    doLogout: authService.doLogout,
    guestUser: authService.guestUser,
    showMain
  });

  return {
    authScreens,
    chatScreens,
    getBoardSelectTitle,
    handleHistoryBack,
    helpScreens,
    jumpToContent,
    memoScreens,
    menuNav,
    myInfoScreens,
    postScreens,
    profileScreens,
    screenDeps,
    serviceScreens,
    showBoardSelect,
    showMain,
    signupModule,
    systemLogScreens,
    systemScreens
  };
}
