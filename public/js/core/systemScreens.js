/**
 * [LOG: 20260426_0210] 시스템 관련 화면 처리 (Who is online 등)
 */
import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

export function createSystemScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    applyCommandFooter,
    buildActiveUsersAnsi,
    buildSystemDiagnosticsAnsi,
    getCommandFooterText,
    getSupportedFooterText,
    renderScreenSequential,
    screenEl,
    setLoading,
    updateURL,
    cmdInput,
    state
  } = deps;

  // [LOG_ID: 20260708_1030] 세 화면(WHO/ACT/SYSINFO) 공용 렌더 헬퍼.
  // - renderAnsiScreenWithTopbar를 써서 다른 모든 화면과 동일한 정통 상단바(로고 박스+실시간 시계)를 갖춘다.
  //   (기존엔 buildTopHeader() 텍스트가 본문 안에 평범한 색상 줄로만 섞여 나와 시계가 멈춰 있고
  //   로고도 클릭이 안 되는 등 다른 화면과 이질적으로 보였다.)
  // - applyCommandFooter를 호출해 setReady(true)까지 위임한다. 기존엔 setLoading()만 걸고
  //   setReady를 한 번도 부르지 않아, 내부 400ms 로딩 타이머가 취소되지 않고 뒤늦게 발동해
  //   방금 그린 화면을 "연결하는 중입니다"로 영구히 덮어써 버리는 결함이 있었다.
  // [LOG_ID: 20260713_2000] renderAnsiScreenWithTopbarSequential로 전환 — 위→아래 순차 스트리밍 후
  // 본문+푸터가 함께 드러나도록 afterBodyRender에 footer 콜백을 받는다.
  async function renderSystemAnsiScreen(ansiText, afterBodyRender) {
    await renderAnsiScreenWithTopbarSequential({ ansiText, ansiToHTML, screenEl, renderScreenSequential, afterBodyRender });
  }

  function renderSystemError(message) {
    screenEl.innerHTML = `<div class="bbs-box"><div class="bbs-title">오류</div><div style="padding:20px">${message}</div></div>`;
  }

  async function showActiveUsers(fromHistory = false) {
    state.screen = 'active-users';
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    const applyFooter = () => applyCommandFooter('', getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
    try {
      const users = await apiFetch('/api/system/active-users');
      await renderSystemAnsiScreen(buildActiveUsersAnsi(users || []), applyFooter);
    } catch (e) {
      renderSystemError('접속자 정보를 가져오지 못했습니다.');
      await applyFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showActivitySummary(fromHistory = false) {
    state.screen = 'activity-summary';
    if (!fromHistory) updateURL();
    setLoading('활동 내역을 분석하는 중입니다..');
    const applyFooter = () => applyCommandFooter('', getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
    try {
      const data = await apiFetch('/api/system/activity-summary');
      const { buildActivitySummaryAnsi } = deps;
      await renderSystemAnsiScreen(buildActivitySummaryAnsi(data), applyFooter);
    } catch (e) {
      renderSystemError('활동 요약을 가져오지 못했습니다.');
      await applyFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  async function showSystemDiagnostics(fromHistory = false) {
    state.screen = 'system-diagnostics';
    if (!fromHistory) updateURL();
    setLoading('시스템 정보를 수집하는 중입니다..');
    const applyFooter = () => applyCommandFooter('', getSupportedFooterText(state) || getCommandFooterText('systemInfo'));
    try {
      const info = await apiFetch('/api/system/info');
      await renderSystemAnsiScreen(buildSystemDiagnosticsAnsi(info), applyFooter);
    } catch (e) {
      renderSystemError('시스템 정보를 가져오지 못했습니다.');
      await applyFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  // [LOG_ID: 20260716_2200] 하이텔 (1)-25 접속통계(account) 계열 — 내 이용 현황.
  async function showMyStats(fromHistory = false) {
    state.screen = 'my-stats';
    if (!fromHistory) updateURL();
    setLoading('이용 현황을 집계하는 중입니다..');
    const applyFooter = () => applyCommandFooter('', getCommandFooterText('systemInfo'));
    try {
      const stats = await apiFetch('/api/members/stats');
      const { buildMyStatsAnsi } = deps;
      await renderSystemAnsiScreen(buildMyStatsAnsi(stats), applyFooter);
    } catch (e) {
      // 게스트는 서버가 401을 낸다 — 로그인 안내로 바꿔 보여준다.
      renderSystemError(state.user?.isGuest
        ? '이용 현황은 로그인 후 확인하실 수 있습니다.'
        : `이용 현황을 가져오지 못했습니다. ${String(e?.message || '')}`);
      await applyFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showActiveUsers, showSystemDiagnostics, showActivitySummary, showMyStats };
}
