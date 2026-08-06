/**
 * [LOG: 20260410_2315] 사용자 프로필 화면 처리 모듈
 */
import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

export function createProfileScreens(deps) {
  const {
    ansiToHTML, apiFetch, applyCommandFooter, buildProfileAnsi, cmdInput,
    getCommandFooterText, getSupportedFooterText, renderScreenSequential, screenEl, setLoading, state, updateURL
  } = deps;

  async function applyProfileFooter() {
    // [LOG_ID: 20260708_1030] setHint(getSupportedFooterText(state))를 직접 부르던 기존 코드는
    // "번호/명령(...)\n선택 >>" 두 줄짜리 원시 디렉티브 문자열을 그대로 힌트 영역에 통째로 밀어넣어,
    // 힌트줄 안에 엉뚱한 "선택 >>"가 덧붙어 보이고 실제 프롬프트는 (envVars.PROMPT 기본값인) 맨 ">>"만
    // 표시되는 불일치를 냈다. applyCommandFooter를 쓰면 다른 모든 화면과 동일하게 힌트/프롬프트가
    // 올바르게 분리되고 setReady(true)까지 자동으로 처리된다.
    await applyCommandFooter('', getSupportedFooterText(state) || getCommandFooterText('profile'));
  }

  function extractProfileMember(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'member')) {
      return payload.member || null;
    }

    return payload;
  }

  async function renderProfileAnsi(ansiText) {
    await renderAnsiScreenWithTopbarSequential({
      ansiText,
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: applyProfileFooter
    });
  }

  async function renderMissingProfile(userId) {
    await renderProfileAnsi(buildProfileAnsi(null, { notFound: true, userId }));
  }

  async function showProfile(userId, fromHistory = false) {
    state.screen = 'profile';
    // [LOG: 20260729_1616] 아이디는 항상 소문자로 정규화하여 URL도 소문자로 생성됨.
    state._profileUserId = String(userId || '').trim().toLowerCase();
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    try {
      // [LOG: 20260429_0606] Missing profile routes should render an inline
      // fail-closed screen instead of surfacing a 404 fetch error.
      const response = await apiFetch(`/api/members/${encodeURIComponent(userId)}?allowMissing=1`);
      // [LOG: 20260801_2000] ESC 취소 후 stale fetch가 이전 화면을 덮어씌우는 경쟁 조건 가드
      if (state.screen !== 'profile') return;
      const member = extractProfileMember(response);
      if (!member) {
        await renderMissingProfile(userId);
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
        return;
      }

      await renderProfileAnsi(buildProfileAnsi(member));
    } catch (e) {
      // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
      // console.error('프로필 조회 실패:', e.message);
      await renderProfileAnsi(buildProfileAnsi(null, { error: true }));
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showProfile };
}
