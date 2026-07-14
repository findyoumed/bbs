import { shouldAutoFocusCommandInput } from './uiUtils.js';
import { renderAnsiScreenWithTopbarSequential } from './ansiTopbarScreen.js';

/**
 * [LOG_ID: 20260716_1400] 하이텔 원전 (1)서비스안내-24.이용자검색(member) — byid/byname.
 *
 * 서버 API(/api/members/search?userId=|nickName=)와 프로필 화면(showProfile)은 이미 있었으나
 * 검색 API는 회원가입 중복확인에서만 쓰였고, 프로필은 PF/WHO 명령으로 "아이디를 정확히 아는"
 * 경우에만 열 수 있었다 — 닉네임으로 사람을 찾을 방법이 아예 없었다. 이 화면이 그 빈칸을 채운다.
 */
export function createMemberSearchScreens(deps) {
  const {
    ansiToHTML,
    applyCommandFooter,
    buildMemberSearchAnsi,
    cmdInput,
    getCommandFooterText,
    renderScreenSequential,
    screenEl,
    searchMember,
    setHint,
    setPrompt,
    showProfile,
    state,
    updateURL
  } = deps;

  // [LOG_ID: 20260707_2300] PC통신: 화면 전체(본문+하단 힌트/입력줄)가 위→아래로 이어서 나온다.
  async function render(options = {}) {
    await renderAnsiScreenWithTopbarSequential({
      ansiText: buildMemberSearchAnsi(options),
      ansiToHTML,
      screenEl,
      renderScreenSequential,
      afterBodyRender: async () => {
        await applyCommandFooter('', getCommandFooterText('memberSearch'));
        setPrompt('아이디/이름 입력 >>');
      }
    });
    if (shouldAutoFocusCommandInput()) cmdInput.focus();
  }

  async function showMemberSearch(fromHistory = false) {
    state.screen = 'member-search';
    state.serviceData = { kind: 'member-search' };
    if (!fromHistory) updateURL();
    await render();
  }

  /**
   * mode: 'byid' | 'byname' | 'any'(기본 — 아이디로 먼저, 없으면 이름으로)
   * 찾으면 기존 프로필 화면(PF/WHO와 동일)으로 넘긴다.
   */
  async function findMember(query, mode = 'any') {
    const keyword = String(query || '').trim();
    if (!keyword) return false;

    let member = null;
    try {
      if (mode === 'any' || mode === 'byid') {
        member = await searchMember({ userId: keyword });
      }
      if (!member && (mode === 'any' || mode === 'byname')) {
        member = await searchMember({ nickName: keyword });
      }
    } catch (error) {
      setHint('회원 정보를 조회하지 못했습니다: ' + (error?.message || ''));
      return true;
    }

    if (!member) {
      await render({ notFoundQuery: keyword });
      return true;
    }

    await showProfile(member.userId);
    return true;
  }

  return { showMemberSearch, findMember };
}
