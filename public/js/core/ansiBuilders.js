import { createBoardAnsiBuilders } from './ansiBoardBuilders.js';
import { createServiceAnsiBuilders } from './ansiServiceBuilders.js';

export function createAnsiBuilders(deps) {
  return {
    ...createBoardAnsiBuilders(deps),
    ...createServiceAnsiBuilders(deps)
  };
}
