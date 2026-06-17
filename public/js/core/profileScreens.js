/**
 * [LOG: 20260410_2315] 사용자 프로필 화면 처리 모듈
 */
import { shouldAutoFocusCommandInput } from './uiUtils.js';

export function createProfileScreens(deps) {
  const { apiFetch, esc, getCommandFooterText, getSupportedFooterText, screenEl, setLoading, setReady, updateURL, setHint, setPrompt, cmdInput, state } = deps;

  function applyProfileFooter() {
    setHint(getSupportedFooterText(state) || getCommandFooterText('profile'));
    setPrompt('>>');
    // [LOG: 20260617_1005] Profile renders without applyCommandFooter, so clear loading here.
    setReady?.(true);
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

  function renderMissingProfile(userId) {
    screenEl.innerHTML = `
      <div class="bbs-box">
        <div class="bbs-title">사용자 정보 (PROFILE)</div>
        <div style="padding: 20px; color: #fff; line-height: 2;">
          회원 정보를 찾을 수 없습니다.<br>
          대상 ID : ${esc(userId || '정보 없음')}
        </div>
      </div>
    `;
    applyProfileFooter();
  }

  async function showProfile(userId, fromHistory = false) {
    state.screen = 'profile';
    state._profileUserId = userId;
    if (!fromHistory) updateURL();
    setLoading('연결하는 중입니다..');
    try {
      // [LOG: 20260429_0606] Missing profile routes should render an inline
      // fail-closed screen instead of surfacing a 404 fetch error.
      const response = await apiFetch(`/api/members/${encodeURIComponent(userId)}?allowMissing=1`);
      const member = extractProfileMember(response);
      if (!member) {
        renderMissingProfile(userId);
        if (shouldAutoFocusCommandInput()) {
          cmdInput.focus();
        }
        return;
      }

      screenEl.innerHTML = `
        <div class="bbs-box">
          <div class="bbs-title">사용자 정보 (PROFILE)</div>
          <div style="padding: 20px; color: #fff; line-height: 2;">
            아이디  : ${member.userId ? esc(member.userId) : '정보 없음'}<br>
            닉네임  : ${member.nickName ? esc(member.nickName) : '정보 없음'}<br>
            회원등급: ${member.level || 1} (${member.isAdmin ? '운영자' : '일반회원'})<br>
            가입일  : ${member.registrationDateTime || '정보 없음'}<br>
          </div>
        </div>
      `;
      applyProfileFooter();
    } catch (e) {
      console.error('프로필 조회 실패:', e.message);
      screenEl.innerHTML = `
        <div class="bbs-box">
          <div class="bbs-title">오류</div>
          <div style="padding: 20px; color: #fff; line-height: 2;">
            프로필 정보를 불러오지 못했습니다.
          </div>
        </div>`;
      applyProfileFooter();
    }
    if (shouldAutoFocusCommandInput()) {
      cmdInput.focus();
    }
  }

  return { showProfile };
}
