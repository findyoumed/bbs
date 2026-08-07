/**
 * appFactory.js
 * [LOG: 20260426_2045] Evolution Mode: Advanced modularization and structural optimization.
 * [LOG: 20260426_2140] Evolution: Integrated i18n and cleaner initialization sequence.
 * [LOG: 20260428_1900] Evolution Mode 19: System Integrity Guardian & Global Exception Handlers.
 */

import { UI_TEXT } from './i18n.js';
import { createCommandFooterUtils } from './commandFooter.js';
import { createCommandFooterTextUtils } from './commandFooterText.js';
import { ansiToHTML, displayWidth, isWideChar } from './ansiRenderUtils.js';
import { renderMenuHotspots, buildMenuHotspotsFromRows } from './menuHotspotUtils.js';
import { createMenuNavigation } from './menuNavigation.js';
import { createApiFetch, ApiError } from './apiFetch.js';
import { createMenuService } from './menuService.js';
import { createBoardService } from './boardService.js';
import { createPostService } from './postService.js';
import { createDataService } from './dataService.js';
import { createAuthService } from './authService.js';
import { createBoardAnsiBuilders } from './ansiBoardBuilders.js';
import { bindAppEvents } from './appEvents.js';
import { createRoutingModule } from './routingModule.js';
import { createTerminalUiCore } from './terminalUiCore.js';
import { createTerminalStatusManager } from './terminalStatusManager.js';
import { createCommandPalette } from './commandPalette.js';
import { createCommandDispatcher } from './commandDispatcher.js';
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
  async () => {
    // [LOG_ID: 20260805_1435] 선택 서비스의 화면과 ANSI 빌더를 같은 lazy 경계에서 로드한다.
    const [module, weatherBuildersModule, newsBuildersModule, systemBuildersModule] = await Promise.all([
      import('./serviceScreens.js'),
      import('./weatherAnsiBuilders.js'),
      import('./newsAnsiBuilders.js'),
      import('./systemAnsiBuilders.js')
    ]);
    return (deps) => module.createServiceScreens({
      ...deps,
      ...weatherBuildersModule.createWeatherAnsiBuilders(deps),
      ...newsBuildersModule.createNewsAnsiBuilders(deps),
      ...systemBuildersModule.createSystemAnsiBuilders(deps)
    });
  },
  ['showNewsArticle', 'showNewsList', 'showNewsMenu', 'showWeatherMenu', 'showWeatherView']
);
// [LOG_ID: 20260804_2353] Authentication screens are only needed after the
// public main screen or an auth deep link is entered. Keep their implementation
// out of the initial module graph while preserving the existing screen API.
const createAuthScreens = createLazyObjectFactory(
  () => import('./authScreens.js').then((module) => module.createAuthScreens),
  ['showLogin', 'showPasswordReset']
);
const createPostScreens = createLazyObjectFactory(
  () => import('./postScreens.js').then((module) => module.createPostScreens),
  ['showPostList', 'showPostView', 'showPostWrite', 'handleWriteSubmit', 'cancelPostWrite', 'showAdjacentPost', 'showPtPrepare', 'showPtResult', 'showAttachmentList']
);
const createChatScreens = createLazyObjectFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./chatScreens.js'),
      import('./chatAnsiBuilders.js')
    ]);
    return (deps) => module.createChatScreens({
      ...deps,
      ...buildersModule.createChatAnsiBuilders(deps)
    });
  },
  ['openChatRoomCreate', 'showChatLobby', 'showChatRoom']
);
const createMemoScreens = createLazyObjectFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./memoScreens.js'),
      import('./memoAnsiBuilders.js')
    ]);
    return (deps) => module.createMemoScreens({
      ...deps,
      ...buildersModule.createMemoAnsiBuilders(deps)
    });
  },
  ['cancelMemoWrite', 'handleMemoRawInput', 'handleMemoSubmit', 'showMemoList', 'showMemoMenu', 'showMemoView', 'showMemoViewPage', 'showMemoWrite']
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
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./profileScreens.js'),
      import('./systemAnsiBuilders.js')
    ]);
    return (deps) => module.createProfileScreens({
      ...deps,
      buildProfileAnsi: buildersModule.createSystemAnsiBuilders(deps).buildProfileAnsi
    });
  },
  ['showProfile']
);
const createPolicyScreens = createLazyObjectFactory(
  async () => {
    // [LOG_ID: 20260805_1435] 약관 원문은 정책 화면을 처음 열 때 함께 로드한다.
    const [module, policyTextModule] = await Promise.all([
      import('./policyScreens.js'),
      import('./signupPolicyText.js')
    ]);
    return (deps) => module.createPolicyScreens({
      ...deps,
      SIGNUP_PRIVACY_TEXT: policyTextModule.SIGNUP_PRIVACY_TEXT,
      SIGNUP_TOS_TEXT: policyTextModule.SIGNUP_TOS_TEXT
    });
  },
  ['showPolicy']
);
const createSystemScreens = createLazyObjectFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./systemScreens.js'),
      import('./systemAnsiBuilders.js')
    ]);
    return (deps) => module.createSystemScreens({
      ...deps,
      ...buildersModule.createSystemAnsiBuilders(deps)
    });
  },
  ['showActiveUsers', 'showSystemDiagnostics', 'showActivitySummary', 'showMyStats']
);
const createSystemLogScreens = createLazyObjectFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./systemLogScreens.js'),
      import('./systemAnsiBuilders.js')
    ]);
    return (deps) => module.createSystemLogScreens({
      ...deps,
      buildSystemLogAnsi: buildersModule.createSystemAnsiBuilders(deps).buildSystemLogAnsi
    });
  },
  ['showSystemLog', 'handleLogCommand']
);
// [LOG_ID: 20260804_1305] Keep optional feature implementations and their ANSI
// builders outside the initial graph while preserving stable routing references.
const createAmusementScreens = createLazyObjectFactory(
  async () => {
    const [screensModule, amusementBuildersModule, arcadeBuildersModule] = await Promise.all([
      import('./amusementScreens.js'),
      import('./amusementAnsiBuilders.js'),
      import('./arcadeAnsiBuilders.js')
    ]);
    return (deps) => screensModule.createAmusementScreens({
      ...deps,
      ...amusementBuildersModule.createAmusementAnsiBuilders(deps),
      ...arcadeBuildersModule.createArcadeAnsiBuilders(deps)
    });
  },
  [
    'showBiorhythm', 'showBiorhythmResult', 'showFortune', 'showFortuneResult',
    'showMbti', 'showMbtiDetail', 'showMbtiList', 'startMbtiTest', 'handleMbtiAnswer',
    'showBlood', 'showBloodResult', 'showCompat', 'showCompatStep2', 'showCompatResult',
    'showTojeong', 'showTojeongResult', 'showRetroArt', 'showRetroArtView',
    'showOmok', 'omokMove', 'omokResign', 'showOthello', 'othelloMove',
    'showBaseball', 'baseballGuess', 'showHangman', 'hangmanGuess', 'hangmanResign',
    'showPuzzle15', 'puzzle15Move', 'showScramble', 'scrambleGuess', 'showWp', 'wpGuess',
    'showTyping', 'typingGuess', 'showQuiz', 'quizGuess', 'showBattle', 'battleMove',
    'battleResign'
  ]
);
const createVoteScreens = createLazyObjectFactory(
  async () => {
    const [screensModule, buildersModule, utilsModule] = await Promise.all([
      import('./voteScreens.js'),
      import('./voteAnsiBuilders.js'),
      import('./ansiBuilderUtils.js')
    ]);
    return (deps) => screensModule.createVoteScreens({
      ...deps,
      ...buildersModule.createVoteAnsiBuilders({
        ansiBuilderUtils: utilsModule.createAnsiBuilderUtils(deps)
      })
    });
  },
  ['showVoteList', 'showVoteDetail', 'castVote', 'showVoteCreate', 'submitVote']
);
const createConfScreens = createLazyObjectFactory(
  async () => {
    const [screensModule, buildersModule, utilsModule] = await Promise.all([
      import('./confScreens.js'),
      import('./confAnsiBuilders.js'),
      import('./ansiBuilderUtils.js')
    ]);
    return (deps) => screensModule.createConfScreens({
      ...deps,
      ...buildersModule.createConfAnsiBuilders({
        ansiBuilderUtils: utilsModule.createAnsiBuilderUtils(deps)
      })
    });
  },
  [
    'showConfRooms', 'showConfAgendas', 'showConfAgenda', 'showConfAgendaPage',
    'showConfRoomCreate', 'submitConfRoom', 'showConfAgendaNew', 'submitConfAgenda',
    'secondConfAgenda', 'closeConfRoom'
  ]
);
const createMemberSearchScreens = createLazyObjectFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./memberSearchScreens.js'),
      import('./systemAnsiBuilders.js')
    ]);
    return (deps) => module.createMemberSearchScreens({
      ...deps,
      buildMemberSearchAnsi: buildersModule.createSystemAnsiBuilders(deps).buildMemberSearchAnsi
    });
  },
  ['showMemberSearch', 'findMember']
);
const createMenuIndexScreens = createLazyObjectFactory(
  () => import('./menuIndexScreens.js').then((module) => module.createMenuIndexScreens),
  ['showMenuIndex']
);
const createContactSysopScreen = createLazyObjectFactory(
  () => import('./contactSysopScreen.js').then((module) => module.createContactSysopScreen),
  ['showContactSysop', 'handleContactSysopRawInput']
);
const createSignupModule = createLazyObjectFactory(
  async () => {
    // [LOG_ID: 20260805_1435] 회원가입 전용 약관 원문을 초기 그래프에서 분리한다.
    const [module, screensModule, policyTextModule] = await Promise.all([
      import('./signupModule.js'),
      import('./signupScreens.js'),
      import('./signupPolicyText.js')
    ]);
    return (deps) => module.createSignupModule({
      ...deps,
      createSignupScreens: screensModule.createSignupScreens,
      SIGNUP_PRIVACY_TEXT: policyTextModule.SIGNUP_PRIVACY_TEXT,
      SIGNUP_TOS_TEXT: policyTextModule.SIGNUP_TOS_TEXT
    });
  },
  ['showSignup']
);

const createServiceCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterService.js').then((module) => module.createServiceCommandHandler)
);
// [LOG_ID: 20260805_1435] 화면 전용 명령 라우터는 해당 화면에서 첫 입력 시 로드한다.
const createEntryCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterEntry.js').then((module) => module.createEntryCommandHandler)
);
const createVoteCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterVote.js').then((module) => module.createVoteCommandHandler)
);
const createConfCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterConf.js').then((module) => module.createConfCommandHandler)
);
const createBrowseCommandHandler = createLazyHandlerFactory(
  () => import('./commandRouterBrowse.js').then((module) => module.createBrowseCommandHandler)
);
const createChatCommandHandler = createLazyHandlerFactory(
  async () => {
    const [module, buildersModule] = await Promise.all([
      import('./commandRouterChat.js'),
      import('./chatAnsiBuilders.js')
    ]);
    return (deps) => module.createChatCommandHandler({
      ...deps,
      buildChatRoomAnsi: buildersModule.createChatAnsiBuilders(deps).buildChatRoomAnsi
    });
  }
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
  const { state, refs } = deps;
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
  });

  const screens = createAppFactoryScreens({
    createAuthScreens,
    createAmusementScreens,
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
    createSystemLogScreens,
    createSystemScreens,
    createVoteScreens,
    refs,
    renderMenuHotspots,
    services,
    state,
    buildMenuHotspotsFromRows
  });

  const handlers = createAppFactoryHandlers({
    createBrowseCommandHandler,
    createChatCommandHandler,
    createConfCommandHandler,
    createEntryCommandHandler,
    createGlobalCommandHandler,
    createMemoCommandHandler,
    createMyInfoCommandHandler,
    createPostViewCommandHandler,
    createServiceCommandHandler,
    createVoteCommandHandler,
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
