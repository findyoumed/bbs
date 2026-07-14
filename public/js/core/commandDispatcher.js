import { createCommandDispatcherExecution } from './commandDispatcherExecution.js';

/**
 * commandDispatcher.js
 * [LOG: 20260426_1700] Evolution Mode: Modular command dispatching system.
 * Extracts command handling logic from appFactory for better maintainability.
 * [LOG_ID: 20260714_1700] 셸 파이핑(|)/시퀀싱(;,&&)/리다이렉션(>,>>)/백그라운드(&)/
 * 변수치환($VAR)/스크립팅(IF,WHILE,FOR...) 계층을 전부 제거했다 — 사용자 결정:
 * 1990년대 PC통신에는 없던 기능이라 "완벽한 PC통신 재현" 목표와 맞지 않고, 도움말에도
 * 노출되지 않아(HELP_TAB_KEYS에서 SYS/VFS 카테고리 누락) 실사용자가 발견할 방법도
 * 없었다. handleCmd는 이제 executeSingleCommand로 바로 위임하는 얇은 래퍼다.
 */
export function createCommandDispatcher(deps) {
  const { executeSingleCommand } = createCommandDispatcherExecution(deps);

  async function handleCmd(input, context = {}) {
    return executeSingleCommand(String(input || '').trim(), context);
  }

  return { handleCmd };
}
