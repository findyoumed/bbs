import { createGlobalRuntimeCommandHandler } from './commandRouterGlobalRuntime.js';
import { createGlobalWorkspaceCommandHandler } from './commandRouterGlobalWorkspace.js';

export function createGlobalSystemCommandHandler(deps) {
  const runtimeHandler = createGlobalRuntimeCommandHandler(deps);
  const workspaceHandler = createGlobalWorkspaceCommandHandler(deps);

  return async function handleGlobalSystemCommand(commandContext) {
    if (await runtimeHandler(commandContext)) {
      return true;
    }

    if (await workspaceHandler(commandContext)) {
      return true;
    }

    return false;
  };
}
