/**
 * [LOG: 20260426_0210] 시스템 관련 화면 처리 (Who is online 등)
 */
import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential, renderRawHtmlScreenWithTopbar } from './ansiTopbarScreen.js';

export function createSystemScreens(deps) {
  const {
    apiFetch,
    ansiToHTML,
    applyCommandFooter,
    buildActiveUsersAnsi,
    buildSystemDiagnosticsAnsi,
    esc,
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

  // [LOG_ID: 20260718_1400] 종전엔 상단바(로고 박스+시계) 없는 "오류" bbs-box만 그려서, 게스트가
  // 이용현황(/account)에 들어오면 정상적인 "로그인 필요" 안내가 에러 화면처럼 보였다(브라우저 실측).
  // memo 화면(renderMemoStatus, 20260708_1030)과 동일하게 표준 상단바를 갖춘 화면으로 렌더한다.
  // 게스트 안내처럼 오류가 아닌 경우는 leftLabel/centerLabel을 그대로 쓰고 빨간색을 안 입힌다.
  function renderSystemInfo(message, options = {}) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const safe = esc ? esc(String(message || '')) : String(message || '');
    const colorClass = options.isError === false ? '' : ' ansi-red';
    // [LOG_ID: 20260726_1400] 이 줄은 대부분 짧은 고정 안내문이지만 showMyStats 등 일부 호출부는
    // 잡은 예외의 e.message를 그대로 이어붙인다(예: fetch 네트워크 오류 메시지) — 길이가 정해져
    // 있지 않은데 .ansi-line의 전역 white-space:pre 때문에 줄바꿈이 안 돼, 긴 오류 메시지가
    // 모바일에서 조용히 잘릴 수 있었다(쪽지 보내기·건의하기와 같은 버그 클래스). 이 화면은
    // 표/정렬이 필요 없는 단일 문장이라 인라인 스타일로 이 div에만 줄바꿈을 허용한다.
    renderRawHtmlScreenWithTopbar({
      leftLabel: options.leftLabel || 'INFO',
      centerLabel: options.centerLabel || '안내',
      bodyHtml: `<div class="ansi-line${colorClass}" style="white-space: normal; word-break: keep-all; overflow-wrap: break-word;">${safe}</div>`,
      screenEl,
      isMobile
    });
  }

  function renderSystemError(message) {
    renderSystemInfo(message, { leftLabel: 'ERR', centerLabel: '오류' });
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
      // 게스트는 서버가 401을 낸다 — 오류가 아니라 "로그인 필요" 안내로(상단바 포함) 보여준다.
      if (state.user?.isGuest) {
        renderSystemInfo('이용 현황은 로그인 후 확인하실 수 있습니다.', {
          leftLabel: 'ACCT', centerLabel: '이용 현황 (ACCOUNT)', isError: false
        });
      } else {
        renderSystemInfo(`이용 현황을 가져오지 못했습니다. ${String(e?.message || '')}`, {
          leftLabel: 'ACCT', centerLabel: '이용 현황 (ACCOUNT)'
        });
      }
      await applyFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showActiveUsers, showSystemDiagnostics, showActivitySummary, showMyStats };
}
