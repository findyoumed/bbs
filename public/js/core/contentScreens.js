import { createPostScreens } from './postScreens.js';
import { createServiceScreens } from './serviceScreens.js';

export function createContentScreens(deps) {
  return {
    ...createPostScreens(deps),
    ...createServiceScreens(deps)
  };
}
