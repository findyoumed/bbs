// [LOG: 20260623_0013] origin/main에서 vote/ranking ansi 빌더 포팅 (self-contained import)
import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { createVoteAnsiBuilders } from './voteAnsiBuilders.js';
import { createRankingAnsiBuilders } from './rankingAnsiBuilders.js';

export function createAppFactoryServices(deps) {
  const {
    ansiToHTML,
    createAliasService,
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
    createServiceAnsiBuilders,
    createSettingsService,
    createSoundService,
    createSystemAnsiBuilders,
    createSystemLogger,
    createTerminalStatusManager,
    createTerminalUiCore,
    createThemeService,
    createVfsService,
    createWorkspaceService,
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

  const { toggleTheme, restoreTheme } = createThemeService({
    state,
    setTheme: settingsService.setTheme
  });

  const workspaceService = createWorkspaceService({
    state,
    logger,
    routingModule: { updateURL: (...args) => refs.updateURL(...args) },
    saveWorkspaces: settingsService.saveWorkspaces
  });
  workspaceService.init();

  const statusManager = createTerminalStatusManager({
    state,
    workspaceService
  });
  statusManager.init();

  const aliasService = createAliasService({
    state,
    saveAliases: settingsService.saveAliases
  });
  const vfsService = createVfsService({
    state,
    settingsService
  });
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
    state,
    updateUserInfo: () => statusManager.update()
  });

  const boardAnsiBuilders = createBoardAnsiBuilders({
    compareDoor: boardService.compareDoor,
    getBoardCode: boardService.getBoardCode,
    getBoardDisplayName: boardService.getBoardDisplayName,
    getBoardDoor: boardService.getBoardDoor,
    isWideChar,
    displayWidth
  });
  const serviceAnsiBuilders = createServiceAnsiBuilders({ isWideChar, displayWidth });
  const systemAnsiBuilders = createSystemAnsiBuilders({ isWideChar, displayWidth });

  // [LOG: 20260623_0013] vote/ranking ansi 빌더 (origin/main 포팅)
  const ansiBuilderUtils = createAnsiBuilderUtils({ isWideChar, displayWidth });
  const voteAnsiBuilders = createVoteAnsiBuilders({ ansiBuilderUtils });
  const rankingAnsiBuilders = createRankingAnsiBuilders({ ansiBuilderUtils });

  return {
    aliasService,
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
    serviceAnsiBuilders,
    voteAnsiBuilders,
    rankingAnsiBuilders,
    settingsService,
    soundService,
    statusManager,
    systemAnsiBuilders,
    terminalUiCore,
    toggleTheme,
    vfsService,
    workspaceService
  };
}
