import { createGlobalRuntimeCommandHandler } from './commandRouterGlobalRuntime.js';
import { createGlobalScriptingCommandHandler } from './commandRouterGlobalScripting.js';
import { createGlobalWorkspaceCommandHandler } from './commandRouterGlobalWorkspace.js';

export function createGlobalSystemCommandHandler(deps) {
  const runtimeHandler = createGlobalRuntimeCommandHandler(deps);
  const workspaceHandler = createGlobalWorkspaceCommandHandler(deps);
  const scriptingHandler = createGlobalScriptingCommandHandler(deps);

  return async function handleGlobalSystemCommand(commandContext) {
    if (await runtimeHandler(commandContext)) {
      return true;
    }

    if (await workspaceHandler(commandContext)) {
      return true;
    }

    if (await scriptingHandler(commandContext)) {
      return true;
    }

    return false;
  };
}
