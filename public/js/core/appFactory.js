/**
 * appFactory.js
 * [LOG: 20260426_2045] Evolution Mode: Advanced modularization and structural optimization.
 * [LOG: 20260426_2140] Evolution: Integrated i18n and cleaner initialization sequence.
 * [LOG: 20260428_1900] Evolution Mode 19: System Integrity Guardian & Global Exception Handlers.
 */

import { UI_TEXT } from './i18n.js';
import { createCommandFooterUtils } from './commandFooter.js';
import { createCommandFooterTextUtils } from './commandFooterText.js';
import { createSignupScreens } from './signupScreens.js';
import { createServiceCommandHandler } from './commandRouterService.js';
import { createEntryCommandHandler } from './commandRouterEntry.js';
import { createBrowseCommandHandler } from './commandRouterBrowse.js';
import { createChatCommandHandler } from './commandRouterChat.js';
import { createPostViewCommandHandler } from './commandRouterPostView.js';
import { ansiToHTML, displayWidth, isWideChar } from './ansiRenderUtils.js';
import { renderMenuHotspots, buildMenuHotspotsFromRows } from './menuHotspotUtils.js';
import { createMenuNavigation } from './menuNavigation.js';
import { createServiceScreens } from './serviceScreens.js';
import { createPostScreens } from './postScreens.js';
import { createChatScreens } from './chatScreens.js';
import { createAuthScreens } from './authScreens.js';
import { createApiFetch, ApiError } from './apiFetch.js';
import { createMenuService } from './menuService.js';
import { createBoardService } from './boardService.js';
import { createPostService } from './postService.js';
import { createDataService } from './dataService.js';
import { createAuthService } from './authService.js';
import { createSignupModule } from './signupModule.js';
import { createBoardAnsiBuilders } from './ansiBoardBuilders.js';
import { createServiceAnsiBuilders } from './ansiServiceBuilders.js';
import { bindAppEvents } from './appEvents.js';
import { createRoutingModule } from './routingModule.js';
import { createTerminalUiCore } from './terminalUiCore.js';
import { createTerminalStatusManager } from './terminalStatusManager.js';
import { createCommandPalette } from './commandPalette.js';
import { createCommandDispatcher } from './commandDispatcher.js';
import { createHelpScreens } from './helpScreens.js';
import { createProfileScreens } from './profileScreens.js';
import { createMyInfoScreens } from './myInfoScreens.js';
import { createMemoScreens } from './memoScreens.js';
import { createSystemAnsiBuilders } from './systemAnsiBuilders.js';
import { createSystemScreens } from './systemScreens.js';
import { createSystemLogger } from './systemLogger.js';
import { createSystemLogScreens } from './systemLogScreens.js';
import { createWorkspaceService } from './workspaceService.js';
import { createAliasService } from './aliasService.js';
import { createVfsService } from './vfsService.js'; // Added
import { createNetworkService } from './networkService.js';
import { createPerformanceService } from './performanceService.js';
import { createInteractionHandlers } from './interactionHandlers.js';
import { createMemoCommandHandler } from './commandRouterMemo.js';
import { createMyInfoCommandHandler } from './commandRouterMyInfo.js';
import { createVfsCommandHandler } from './commandRouterVfs.js';
import { createGlobalCommandHandler } from './commandRouterGlobal.js';
import { createThemeService } from './themeService.js';
import { createSoundService } from './soundService.js';
import { createSettingsService } from './settingsService.js';
import { triggerVisualFeedback, getLevenshteinDistance } from './uiUtils.js';
import { CMD_META } from './commandService.js';
import { createAppFactoryServices } from './appFactoryServices.js';
import { createAppFactoryScreens } from './appFactoryScreens.js';
import { createAppFactoryHandlers } from './appFactoryHandlers.js';
import { initializeAppFactoryRuntime } from './appFactoryRuntime.js';

export function initApp(deps) {
  const { state, refs, SIGNUP_TOS_TEXT, SIGNUP_PRIVACY_TEXT } = deps;
  const services = createAppFactoryServices({
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
  });

  const screens = createAppFactoryScreens({
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
  });

  const handlers = createAppFactoryHandlers({
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
  });

  return initializeAppFactoryRuntime({
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
  });
}
