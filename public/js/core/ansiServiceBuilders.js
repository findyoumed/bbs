import { createWeatherAnsiBuilders } from './weatherAnsiBuilders.js';
import { createNewsAnsiBuilders } from './newsAnsiBuilders.js';
import { createChatAnsiBuilders } from './chatAnsiBuilders.js';
import { createMemoAnsiBuilders } from './memoAnsiBuilders.js';
import { createSystemAnsiBuilders } from './systemAnsiBuilders.js';

// [LOG_ID: 20260804_1305] Feature-only amusement/arcade builders are composed by
// their lazy screen factory instead of this startup-critical shared aggregator.
export function createServiceAnsiBuilders(deps) {
  return {
    ...createWeatherAnsiBuilders(deps),
    ...createNewsAnsiBuilders(deps),
    ...createChatAnsiBuilders(deps),
    ...createMemoAnsiBuilders(deps),
    ...createSystemAnsiBuilders(deps)
  };
}
