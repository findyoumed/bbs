// [LOG_ID: 20260714_1700] ALIAS/WS/TRACE(가짜 셸 알리어스·워크스페이스 전환·스크립트 추적)
// 명령을 제거했다 — 사용자 결정: 1990년대 PC통신에 없던 기능이고 도움말에도 노출되지
// 않아 실사용자가 쓸 일이 없었다. SET/UNSET/ENV는 SET LEVEL(도움말 표시 등급)/
// SET HOME(초기 화면 지정)/SET THEME(나우누리 테마)/SET PROMPT(프롬프트 문자열) 같은
// 실제 사이트 기능의 기반이라 그대로 남긴다.
export function createGlobalWorkspaceCommandHandler(deps) {
  const {
    state,
    setHint,
    setPrompt,
    applyTheme
  } = deps;

  function ensureEnvVars() {
    if (!state.envVars) {
      state.envVars = {};
    }
    return state.envVars;
  }

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function splitCommand(rawCmd) {
    return String(rawCmd || '').trim().split(/\s+/);
  }

  return async function handleGlobalWorkspaceCommand({ cmd, rawCmd }) {
    // [LOG_ID: 20260729_1708] 사용자 요청으로 SET, UNSET, ENV, VARS 명령어 완전 제거
    return false;
  };
}
