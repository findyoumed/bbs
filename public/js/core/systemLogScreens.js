/**
 * systemLogScreens.js
 * [LOG: 20260428_0930] Evolution Mode 14: System log viewer screen.
 */
import { renderAnsiScreenWithTopbar } from './ansiTopbarScreen.js';

export function createSystemLogScreens(deps) {
  const {
    state,
    screenEl,
    ansiToHTML,
    buildSystemLogAnsi,
    getSupportedFooterText,
    logger,
    setHint,
    setPrompt,
    updateURL,
    showToast
  } = deps;

  async function showSystemLog(fromHistory = false) {
    state.screen = 'system-log';
    if (!fromHistory) updateURL();

    renderLogs();

    setHint(getSupportedFooterText(state));
    setPrompt('LOG>>');
  }

  function renderLogs() {
    const logs = logger.getLogs();
    const ansiText = buildSystemLogAnsi(logs);
    // [LOG_ID: 20260708_1030] 다른 화면과 동일한 정통 상단바(로고 박스+실시간 시계)로 렌더링한다.
    // (기존엔 ansiToHTML 결과를 맨 div로만 감싸 buildSystemLogAnsi의 buildTopHeader 4줄이
    // 평범한 본문 텍스트 줄로만 섞여 나오고, 로고는 클릭 불가·시계는 멈춰 있었다.)
    renderAnsiScreenWithTopbar({ ansiText, ansiToHTML, screenEl });
  }

  async function handleLogCommand(cmd) {
    if (cmd === 'C') {
      logger.clear();
      renderLogs();
      showToast('로그가 초기화되었습니다.');
      return true;
    }
    if (cmd === 'R') {
      renderLogs();
      return true;
    }
    if (cmd === 'CP') {
      const text = logger.getFormattedLogs();
      try {
        await navigator.clipboard.writeText(text);
        showToast('로그가 클립보드에 복사되었습니다.');
      } catch (err) {
        showToast('클립보드 복사 실패: ' + err.message, 3000, 'error');
      }
      return true;
    }
    return false;
  }

  return { showSystemLog, handleLogCommand };
}
