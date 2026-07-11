// [LOG: 20260623_0013] origin/main에서 vote/ranking 스크린 포팅 (self-contained import)
import { createVoteScreens } from './voteScreens.js';
import { createRankingScreens } from './rankingScreens.js';
import { createAmusementScreens } from './amusementScreens.js';

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
    terminalUiCore,
    voteAnsiBuilders,
    rankingAnsiBuilders
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
  const profileScreens = createProfileScreens({ ...screenDeps, apiFetch, buildProfileAnsi: systemAnsiBuilders.buildProfileAnsi });
  const myInfoScreens = createMyInfoScreens({
    ...screenDeps,
    apiFetch,
    doLogin: authService.doLogin,
    doLogout: authService.doLogout,
    guestUser: authService.guestUser,
    showMain
  });

  // [LOG: 20260623_0013] vote/ranking 스크린 (origin/main 포팅, apiFetch는 로컬 screenDeps에 없어 명시 전달)
  const voteScreens = createVoteScreens({
    ...screenDeps,
    apiFetch,
    buildVoteListAnsi: voteAnsiBuilders.buildVoteListAnsi,
    buildVoteDetailAnsi: voteAnsiBuilders.buildVoteDetailAnsi,
    buildVoteCreateAnsi: voteAnsiBuilders.buildVoteCreateAnsi,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  const rankingScreens = createRankingScreens({
    ...screenDeps,
    apiFetch,
    buildRankingSummaryAnsi: rankingAnsiBuilders.buildRankingSummaryAnsi,
    buildRankingDetailAnsi: rankingAnsiBuilders.buildRankingDetailAnsi,
    getMenuNodeByKey: menuService.getMenuNodeByKey
  });
  const amusementScreens = createAmusementScreens({
    ...screenDeps,
    buildBiorhythmIntroAnsi: serviceAnsiBuilders.buildBiorhythmIntroAnsi,
    buildBiorhythmAnsi: serviceAnsiBuilders.buildBiorhythmAnsi,
    buildFortuneIntroAnsi: serviceAnsiBuilders.buildFortuneIntroAnsi,
    buildFortuneAnsi: serviceAnsiBuilders.buildFortuneAnsi,
    buildMbtiListAnsi: serviceAnsiBuilders.buildMbtiListAnsi,
    buildMbtiDetailAnsi: serviceAnsiBuilders.buildMbtiDetailAnsi,
    buildRetroArtListAnsi: serviceAnsiBuilders.buildRetroArtListAnsi,
    buildRetroArtViewAnsi: serviceAnsiBuilders.buildRetroArtViewAnsi,
    findMbtiType: serviceAnsiBuilders.findMbtiType,
    getMenuNodeByKey: menuService.getMenuNodeByKey
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
    voteScreens,
    rankingScreens,
    amusementScreens,
    showBoardSelect,
    showMain,
    signupModule,
    systemLogScreens,
    systemScreens
  };
}
