import { createGlobalNavigationCommandHandler } from './commandRouterGlobalNavigation.js';
import { createGlobalSystemCommandHandler } from './commandRouterGlobalSystem.js';

/**
 * [LOG: 20260425_2210] 전역 명령어 라우터 (Global Command Router)
 * - 어디서나 작동하는 공통 명령어 (HELP, USER, MYINFO, PROFILE 등) 처리
 */
export function createGlobalCommandHandler(deps) {
  const systemHandler = createGlobalSystemCommandHandler(deps);
  const navigationHandler = createGlobalNavigationCommandHandler(deps);

  return async function handleGlobalCommand(commandContext) {
    if (await systemHandler(commandContext)) {
      return true;
    }

    if (await navigationHandler(commandContext)) {
      return true;
    }

    return false;
  };
}
