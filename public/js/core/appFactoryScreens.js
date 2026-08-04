// [LOG: 20260623_0013] origin/main에서 vote 스크린 포팅 (self-contained import)
// [LOG_ID: 20260716_1400] 하이텔 (1)-24 이용자검색(member/byid/byname)
// [LOG_ID: 20260716_1600] 하이텔 (1)-6/8 메뉴안내·인덱스안내(menu/index)
// [LOG_ID: 20260720_2300] GUIDE 건의하기 — 게시판 대신 시삽 이메일 발송.

// [LOG_ID: 20260804_1305] Optional screen factories are injected as lazy facades.
export function createAppFactoryScreens(deps) {
  const {
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT,
    createAmusementScreens,
    createAuthScreens,
    createChatScreens,
    createConfScreens,
    createContactSysopScreen,
    createHelpScreens,
    createMemberSearchScreens,
    createMemoScreens,
    createMenuIndexScreens,
    createPolicyScreens,
    createMenuNavigation,
    createMyInfoScreens,
    createPostScreens,
    createProfileScreens,
    createServiceScreens,
    createSignupModule,
    createSignupScreens,
    createSystemLogScreens,
    createSystemScreens,
    createVoteScreens,
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
    setReady: terminalUiCore.setReady,
    setLoading: terminalUiCore.setLoading,
    showToast: terminalUiCore.showToast,
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
    buildActivitySummaryAnsi: systemAnsiBuilders.buildActivitySummaryAnsi,
    // [LOG_ID: 20260716_2200] 하이텔 (1)-25 계열 — 내 이용 현황.
    buildMyStatsAnsi: systemAnsiBuilders.buildMyStatsAnsi
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
    apiFetch,
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
    apiFetch,
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
  // [LOG_ID: 20260720_2300] GUIDE 건의하기 — 시삽 이메일 발송 화면.
  const contactSysopScreens = createContactSysopScreen({
    ...screenDeps,
    apiFetch,
    showBoardSelect
  });
  // [LOG_ID: 20260713_2100] GUIDE 화면 이용약관/개인정보처리방침 뷰어.
  const policyScreens = createPolicyScreens({
    ...screenDeps,
    SIGNUP_PRIVACY_TEXT,
    SIGNUP_TOS_TEXT
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
  // [LOG_ID: 20260716_1600] 전체 메뉴 안내(INDEX) — 살아있는 메뉴 트리에서 매번 생성한다.
  const menuIndexScreens = createMenuIndexScreens({
    ...screenDeps,
    getMenuChildren: menuService.getMenuChildren,
    getMenuNodeLabel: menuService.getMenuNodeLabel,
    getMenuNodeKey: menuService.getMenuNodeKey,
    renderMenuHotspots: renderMenuHotspots,
    // [LOG_ID: 20260718_1400] /index URL 직접 진입 시 메뉴 트리가 없어 목록이 비던 문제 — 선로드용.
    loadMenuTree: menuService.loadMenuTree
  });
  const profileScreens = createProfileScreens({ ...screenDeps, apiFetch, buildProfileAnsi: systemAnsiBuilders.buildProfileAnsi });
  // [LOG_ID: 20260716_1400] 이용자검색 — 검색은 기존 authService.searchMember(/api/members/search),
  // 결과 표시는 기존 프로필 화면을 그대로 재사용한다(신규 API·신규 데이터 없음).
  const memberSearchScreens = createMemberSearchScreens({
    ...screenDeps,
    buildMemberSearchAnsi: systemAnsiBuilders.buildMemberSearchAnsi,
    searchMember: authService.searchMember,
    showProfile: profileScreens.showProfile
  });
  const myInfoScreens = createMyInfoScreens({
    ...screenDeps,
    apiFetch,
    doLogin: authService.doLogin,
    doLogout: authService.doLogout,
    guestUser: authService.guestUser,
    showMain
  });

  // [LOG: 20260623_0013] vote 스크린 (origin/main 포팅, apiFetch는 로컬 screenDeps에 없어 명시 전달)
  const voteScreens = createVoteScreens({
    ...screenDeps,
    apiFetch,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  // [LOG_ID: 20260719_1600] 토론의 광장(CONF) 스크린
  const confScreens = createConfScreens({
    ...screenDeps,
    apiFetch,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  const amusementScreens = createAmusementScreens({
    ...screenDeps,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });

  return {
    authScreens,
    chatScreens,
    contactSysopScreens,
    getBoardSelectTitle,
    handleHistoryBack,
    helpScreens,
    jumpToContent,
    memberSearchScreens,
    memoScreens,
    menuIndexScreens,
    menuNav,
    myInfoScreens,
    policyScreens,
    postScreens,
    profileScreens,
    screenDeps,
    serviceScreens,
    voteScreens,
    confScreens,
    amusementScreens,
    showBoardSelect,
    showMain,
    signupModule,
    systemLogScreens,
    systemScreens
  };
}
