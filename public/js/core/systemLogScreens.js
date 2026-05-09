/**
 * systemLogScreens.js
 * [LOG: 20260428_0930] Evolution Mode 14: System log viewer screen.
 */

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
    showToast,
    esc
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
    const rendered = ansiToHTML(ansiText);
    screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;
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
