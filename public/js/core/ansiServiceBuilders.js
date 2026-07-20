import { createWeatherAnsiBuilders } from './weatherAnsiBuilders.js';
import { createNewsAnsiBuilders } from './newsAnsiBuilders.js';
import { createChatAnsiBuilders } from './chatAnsiBuilders.js';
import { createMemoAnsiBuilders } from './memoAnsiBuilders.js';
import { createSystemAnsiBuilders } from './systemAnsiBuilders.js';
import { createAmusementAnsiBuilders } from './amusementAnsiBuilders.js';
import { createArcadeAnsiBuilders } from './arcadeAnsiBuilders.js';

export function createServiceAnsiBuilders(deps) {
  return {
    ...createWeatherAnsiBuilders(deps),
    ...createNewsAnsiBuilders(deps),
    ...createChatAnsiBuilders(deps),
    ...createMemoAnsiBuilders(deps),
    ...createSystemAnsiBuilders(deps),
    ...createAmusementAnsiBuilders(deps),
    // [LOG_ID: 20260720_1358] 오락실 게임 5종 (오목/오델로/숫자야구/영어단어맞추기/숫자판맞추기)
    ...createArcadeAnsiBuilders(deps)
  };
}
