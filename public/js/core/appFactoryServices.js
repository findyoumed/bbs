// [LOG_ID: 20260805_1435] 선택 화면 ANSI 빌더는 appFactory의 lazy factory가 주입한다.
export function createAppFactoryServices(deps) {
  const {
    ansiToHTML,
    createApiFetch,
    createAuthService,
    createBoardAnsiBuilders,
    createBoardService,
    createCommandFooterTextUtils,
    createCommandFooterUtils,
    createDataService,
    createMenuService,
    createNetworkService,
    createPerformanceService,
    createPostService,
    createSettingsService,
    createSoundService,
    createSystemLogger,
    createTerminalStatusManager,
    createTerminalUiCore,
    createThemeService,
    displayWidth,
    isWideChar,
    refs,
    state
  } = deps;

  const cmdInput = document.getElementById('cmd-input');
  const screenEl = document.getElementById('terminal-screen');
  const hintEl = document.getElementById('cmd-hint');

  const settingsService = createSettingsService({ state });
  settingsService.loadSettings();

  const logger = createSystemLogger({ state, maxEntries: 200 });
  const performanceService = createPerformanceService({ state, logger });
  const soundService = createSoundService({ state });

  const { loadAssetText, looksLikeCommandFooter, parseCommandFooter } = createCommandFooterUtils({
    assetCache: state.assetCache,
    onCacheHit: () => performanceService.recordCache(true),
    onCacheMiss: () => performanceService.recordCache(false)
  });
  const { getCommandFooterText, getSupportedFooterText } = createCommandFooterTextUtils({ state });

  const terminalUiCore = createTerminalUiCore({
    hintEl: document.getElementById('cmd-hint'),
    cmdPromptEl: document.getElementById('cmd-prompt'),
    cmdInput,
    screenEl,
    state,
    loadAssetText,
    looksLikeCommandFooter,
    parseCommandFooter,
    getSupportedFooterText,
    soundService,
    setScale: settingsService.setScale,
    isManualScale: settingsService.isManualScale,
    performanceService
  });

  terminalUiCore.initBlinkingCursor();
  terminalUiCore.initTooltips();
  terminalUiCore.initZoom();

  const { applyTheme, toggleTheme, restoreTheme } = createThemeService({
    state,
    setTheme: settingsService.setTheme
  });

  const statusManager = createTerminalStatusManager({ state });
  statusManager.init();

  const networkService = createNetworkService();

  const { apiFetch } = createApiFetch({
    state,
    logger,
    onActivity: (active) => terminalUiCore.setBusy(active),
    onGlobalError: (error) => terminalUiCore.showToast(error.message, 3000, 'error'),
    onLatency: (ms) => statusManager.setLatency(ms)
  });

  const boardService = createBoardService({ apiFetch, state });
  const menuService = createMenuService({ apiFetch, compareDoor: boardService.compareDoor, state });
  const postService = createPostService({ apiFetch, state });
  const dataService = createDataService({ apiFetch, state });
  // [LOG: 20260429_0545] Auth bootstrap expects a route predicate here; passing
  // the path builder causes any recovery hash route to arm password-update mode.
  const authService = createAuthService({
    apiFetch,
    getAuthLeafRoutePath: menuService.getAuthLeafRoutePath,
    isPasswordResetRoutePath: menuService.isPasswordResetRoutePath,
    showPasswordReset: (...args) => refs.showPasswordReset(...args),
    // [LOG_ID: 20260712_1940] 접속 시 새 쪽지 도착 알림(notifyUnreadMemos)용 토스트 출력기.
    showToast: (text, duration, level, options = {}) => terminalUiCore.showToast(text, duration, level, options),
    state,
    updateUserInfo: () => statusManager.update()
  });

  const boardAnsiBuilders = createBoardAnsiBuilders({
    compareDoor: boardService.compareDoor,
    getBoardCode: boardService.getBoardCode,
    getBoardDisplayName: boardService.getBoardDisplayName,
    getBoardDoor: boardService.getBoardDoor,
    isWideChar,
    displayWidth,
    state
  });
  return {
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
    networkService,
    performanceService,
    postService,
    restoreTheme,
    screenEl,
    settingsService,
    soundService,
    statusManager,
    terminalUiCore,
    applyTheme,
    toggleTheme
  };
}
