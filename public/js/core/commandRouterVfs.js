import { createVfsInspectOps } from './commandRouterVfsInspectOps.js';
import { createVfsMutationOps } from './commandRouterVfsMutationOps.js';
import { createVfsTextOps } from './commandRouterVfsTextOps.js';

const VFS_COMMANDS = new Set([
  'FILES', 'DIR', 'TYPE', 'CAT', 'DEL', 'WRITE', 'EDIT', 'RUN', 'SOURCE',
  'INFO', 'GREP', 'PWD', 'WC', 'SORT', 'UNIQ', 'HEAD', 'TAIL', 'DIFF',
  'TEE', 'CP', 'MV', 'TOUCH'
]);

export function createVfsCommandHandler(deps) {
  const { vfsService } = deps;

  const { handleInspectCommand } = createVfsInspectOps(deps);
  const { handleTextCommand } = createVfsTextOps(deps);
  const { handleMutationCommand } = createVfsMutationOps(deps);

  return async function handleVfsCommand({ cmd, rawCmd, context }) {
    if (!VFS_COMMANDS.has(cmd) || !vfsService) {
      return false;
    }

    const parts = String(rawCmd || '').split(/\s+/);

    return await handleInspectCommand({ cmd, parts, context })
      || await handleTextCommand({ cmd, parts, context })
      || await handleMutationCommand({ cmd, parts, context });
  };
}
