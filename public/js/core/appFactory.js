/**
 * appFactory.js
 * [LOG: 20260426_2045] Evolution Mode: Advanced modularization and structural optimization.
 * [LOG: 20260426_2140] Evolution: Integrated i18n and cleaner initialization sequence.
 * [LOG: 20260428_1900] Evolution Mode 19: System Integrity Guardian & Global Exception Handlers.
 */

import { UI_TEXT } from './i18n.js';
import { createCommandFooterUtils } from './commandFooter.js';
import { createCommandFooterTextUtils } from './commandFooterText.js';
import { createEntryCommandHandler } from './commandRouterEntry.js';
import { ansiToHTML, displayWidth, isWideChar } from './ansiRenderUtils.js';
import { renderMenuHotspots, buildMenuHotspotsFromRows } from './menuHotspotUtils.js';
import { createMenuNavigation } from './menuNavigation.js';
import { createAuthScreens } from './authScreens.js';
import { createApiFetch, ApiError } from './apiFetch.js';
import { createMenuService } from './menuService.js';
import { createBoardService } from './boardService.js';
import { createPostService } from './postService.js';
import { createDataService } from './dataService.js';
import { createAuthService } from './authService.js';
import { createBoardAnsiBuilders } from './ansiBoardBuilders.js';
import { createServiceAnsiBuilders } from './ansiServiceBuilders.js';
import { bindAppEvents } from './appEvents.js';
import { createRoutingModule } from './routingModule.js';
import { createTerminalUiCore } from './terminalUiCore.js';
import { createTerminalStatusManager } from './terminalStatusManager.js';
import { createCommandPalette } from './commandPalette.js';
import { createCommandDispatcher } from './commandDispatcher.js';
import { createSystemAnsiBuilders } from './systemAnsiBuilders.js';
import { createSystemLogger } from './systemLogger.js';
import { createNetworkService } from './networkService.js';
import { createPerformanceService } from './performanceService.js';
import { createInteractionHandlers } from './interactionHandlers.js';
import { createThemeService } from './themeService.js';
import { createSoundService } from './soundService.js';
import { createSettingsService } from './settingsService.js';
import { createAppFactoryServices } from './appFactoryServices.js';
import { createAppFactoryScreens } from './appFactoryScreens.js';
import { createAppFactoryHandlers } from './appFactoryHandlers.js';
import { initializeAppFactoryRuntime } from './appFactoryRuntime.js';
import { createLazyHandlerFactory, createLazyObjectFactory } from './lazyModuleFactory.js';

// [LOG_ID: 20260804_1114] Optional feature modules are loaded on first use. The
// facades retain stable method references required by routing and event wiring.
const createServiceScreens = createLazyObjectFactory(
  () => import('./serviceScreens.js').then((module) => module.createServiceScreens),
  ['showNewsArticle', 'showNewsList', 'showNewsMenu', 'showWeatherMenu', 'showWeatherView']
);
const createPostScreens = createLazyObjectFactory(
  () => import('./postScreens.js').then((module) => module.createPostScreens),
  ['showPostList', 'showPostView', 'showPostWrite', 'handleWriteSubmit', 'cancelPostWrite', 'showAdjacentPost', 'showPtPrepare', 'showPtResult', 'showAttachmentList']
);
const createChatScreens = createLazyObjectFactory(
  () => import('./chatScreens.js').then((module) => module.createChatScreens),
  ['openChatRoomCreate', 'showChatLobby', 'showChatRoom']
);
const createMemoScreens = createLazyObjectFactory(
  () => import('./memoScreens.js').then((module) => module.createMemoScreens),
  ['cancelMemoWrite', 'handleMemoRawInput', 'handleMemoSubmit', 'showMemoList', 'showMemoView', 'showMemoViewPage', 'showMemoWrite']
);
const createMyInfoScreens = createLazyObjectFactory(
  () => import('./myInfoScreens.js').then((module) => module.createMyInfoScreens),
  ['cancelMyInfoEdit', 'openDeleteAccount', 'openEmailChange', 'openNicknameChange', 'openPasswordChange', 'logoutFromMyInfo', 'showMyInfo', 'submitDeleteAccount', 'submitEmailChange', 'submitNicknameChange', 'submitPasswordChange']
);
const createHelpScreens = createLazyObjectFactory(
  () => import('./helpScreens.js').then((module) => module.createHelpScreens),
  ['showHelp', 'showHistory']
);
const createProfileScreens = createLazyObjectFactory(
  () => import('./profileScreens.js').then((module) => module.createProfileScreens),
  ['showProfile']
);
const createPolicyScreens = createLazyObjectFactory(
  () => import('./policyScreens.js').then((module) => module.createPolicyScreens),
  ['showPolicy']
);
const createSystemScreens = createLazyObjectFactory(
  () => import('./systemScreens.js').then((module) => module.createSystemScreens),
  ['showActiveUsers', 'showSystemDiagnostics', 'showActivitySummary', 'showMyStats']
);
const createSystemLogScreens = createLazyObjectFactory(
  () => import('./systemLogScreens.js').then((module) => module.createSystemLogScreens),
  ['showSystemLog', 'handleLogCommand']
);
const createSignupModule = createLazyObjectFactory(
  async () => {
    const [module, screensModule] = await Promise.all([
      import('./signupModule.js'),
      import('./signupScreens.js')
    ]);
    return (deps) => module.createSignupModule({
      ...deps,
      createSignupScreens: screensModule.createSignupScreens
    });
  },
  ['showSignup']
);

const createServiceCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterService.js').then((module) => module.createServiceCommandHandler)
);
const createBrowseCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterBrowse.js').then((module) => module.createBrowseCommandHandler)
);
const createChatCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterChat.js').then((module) => module.createChatCommandHandler)
);
const createPostViewCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterPostView.js').then((module) => module.createPostViewCommandHandler)
);
const createMemoCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterMemo.js').then((module) => module.createMemoCommandHandler)
);
const createMyInfoCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterMyInfo.js').then((module) => module.createMyInfoCommandHandler)
);
const createGlobalCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterGlobal.js').then((module) => module.createGlobalCommandHandler)
);

export function initApp(deps) {
  const { state, refs, SIGNUP_TOS_TEXT, SIGNUP_PRIVACY_TEXT } = deps;
  const services = createAppFactoryServices({
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
    createServiceAnsiBuilders,
    createSettingsService,
    createSoundService,
    createSystemAnsiBuilders,
    createSystemLogger,
    createTerminalStatusManager,
    createTerminalUiCore,
    createThemeService,
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
    createPolicyScreens,
    createMenuNavigation,
    createMyInfoScreens,
    createPostScreens,
    createProfileScreens,
    createServiceScreens,
    createSignupModule,
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
