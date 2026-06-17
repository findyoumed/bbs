/**
 * [LOG: 20260426_0210] 시스템 관련 화면 처리 (Who is online 등)
 */
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createSystemScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    buildActiveUsersAnsi,
    buildSystemDiagnosticsAnsi,
    getCommandFooterText,
    getSupportedFooterText,
    screenEl,
    setLoading,
    updateURL,
    setHint,
    setPrompt,
    cmdInput,
    state
  } = deps;

  async function showActiveUsers(fromHistory = false) {
    state.screen = 'active-users';
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    try {
      const users = await apiFetch('/api/system/active-users');
      const rendered = ansiToHTML(buildActiveUsersAnsi(users || []));
      screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;
      setHint(getSupportedFooterText(state));
      setPrompt('>>');
    } catch (e) {
      screenEl.innerHTML = '<div class="bbs-box"><div class="bbs-title">오류</div><div style="padding:20px">접속자 정보를 가져오지 못했습니다.</div></div>';
      setHint(getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
      setPrompt('>>');
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showActivitySummary(fromHistory = false) {
    state.screen = 'activity-summary';
    if (!fromHistory) updateURL();
    setLoading('활동 내역을 분석하는 중입니다..');
    try {
      const data = await apiFetch('/api/system/activity-summary');
      const { buildActivitySummaryAnsi } = deps;
      const rendered = ansiToHTML(buildActivitySummaryAnsi(data));
      screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;
      setHint(getSupportedFooterText(state));
      setPrompt('>>');
    } catch (e) {
      screenEl.innerHTML = '<div class="bbs-box"><div class="bbs-title">오류</div><div style="padding:20px">활동 요약을 가져오지 못했습니다.</div></div>';
      setHint(getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
      setPrompt('>>');
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showSystemDiagnostics(fromHistory = false) {

    state.screen = 'system-diagnostics';
    if (!fromHistory) updateURL();
    setLoading('시스템 정보를 수집하는 중입니다..');
    try {
      const info = await apiFetch('/api/system/info');
      const rendered = ansiToHTML(buildSystemDiagnosticsAnsi(info));
      screenEl.innerHTML = `<div class="ansi-screen">${rendered.html}</div>`;
      setHint(getSupportedFooterText(state));
      setPrompt('>>');
    } catch (e) {
      screenEl.innerHTML = '<div class="bbs-box"><div class="bbs-title">오류</div><div style="padding:20px">시스템 정보를 가져오지 못했습니다.</div></div>';
      setHint(getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
      setPrompt('>>');
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showActiveUsers, showSystemDiagnostics, showActivitySummary };
}
