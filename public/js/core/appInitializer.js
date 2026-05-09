/**
 * appInitializer.js
 * [LOG: 20260426_2115] Evolution Mode: Split appFactory into focused initialization stages.
 */

export function createInfrastructure(deps) {
  const { state, createSettingsService, createSoundService, createTerminalUiCore, loadAssetText, looksLikeCommandFooter, parseCommandFooter, getSupportedFooterText } = deps;
  
  const settingsService = createSettingsService({ state });
  settingsService.loadSettings();

  const soundService = createSoundService({ state });
  
  const terminalUiCore = createTerminalUiCore({
    hintEl: document.getElementById('cmd-hint'),
    cmdPromptEl: document.getElementById('cmd-prompt'),
    cmdInput: document.getElementById('cmd-input'),
    screenEl: document.getElementById('terminal-screen'),
    state, loadAssetText, looksLikeCommandFooter, parseCommandFooter, getSupportedFooterText,
    soundService,
    setScale: settingsService.setScale,
    isManualScale: settingsService.isManualScale
  });

  terminalUiCore.initTooltips();
  terminalUiCore.initZoom();

  return { settingsService, soundService, terminalUiCore };
}

export function createDataServices(deps) {
  const { apiFetch, state, boardService, menuService, postService, dataService, authService, themeService, settingsService } = deps;
  
  const { toggleTheme, restoreTheme } = themeService;

  return {
    boardService,
    menuService,
    postService,
    dataService,
    authService,
    toggleTheme,
    restoreTheme
  };
}
