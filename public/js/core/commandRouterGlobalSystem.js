import { createGlobalRuntimeCommandHandler } from './commandRouterGlobalRuntime.js';

export function createGlobalSystemCommandHandler(deps) {
  const runtimeHandler = createGlobalRuntimeCommandHandler(deps);

  return async function handleGlobalSystemCommand(commandContext) {
    if (await runtimeHandler(commandContext)) {
      return true;
    }
    // [LOG_ID: 20260805_0253] The removed workspace handler was an async stub
    // that always returned false after its commands were retired.
    return false;
  };
}
