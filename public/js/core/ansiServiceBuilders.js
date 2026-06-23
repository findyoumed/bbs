import { createWeatherAnsiBuilders } from './weatherAnsiBuilders.js';
import { createNewsAnsiBuilders } from './newsAnsiBuilders.js';
import { createChatAnsiBuilders } from './chatAnsiBuilders.js';
import { createMemoAnsiBuilders } from './memoAnsiBuilders.js';
import { createSystemAnsiBuilders } from './systemAnsiBuilders.js';
import { createAmusementAnsiBuilders } from './amusementAnsiBuilders.js';

export function createServiceAnsiBuilders(deps) {
  return {
    ...createWeatherAnsiBuilders(deps),
    ...createNewsAnsiBuilders(deps),
    ...createChatAnsiBuilders(deps),
    ...createMemoAnsiBuilders(deps),
    ...createSystemAnsiBuilders(deps),
    ...createAmusementAnsiBuilders(deps)
  };
}
