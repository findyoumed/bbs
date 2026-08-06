import { createAuthServiceActions } from './authServiceActions.js';
import { createAuthServiceBootstrap } from './authServiceBootstrap.js';

export function createAuthService(deps) {
  const {
    apiFetch,
    showToast,
    state,
    updateUserInfo
  } = deps;

  function guestUser() {
    return { userId: 'guest', nickName: '손님', level: 1, isAdmin: false, isGuest: true };
  }

  // [LOG_ID: 20260712_1940] 하이텔 '전자사서함 확인' 재현 — 접속(로그인/세션 복원) 직후 새 쪽지
  // 도착 여부를 알려준다(하이텔 길라잡이 p.94: 접속 시 새 편지 도착 여부 확인이 환경설정 항목일
  // 만큼 보편적 경험). 서버 GET /api/memos/unread/count 는 이미 있었으나 클라이언트가 한 번도
  // 호출하지 않던 것을 연결. 0통이거나 조회 실패면 침묵한다.
  async function notifyUnreadMemos() {
    if (typeof apiFetch !== 'function' || state.user?.isGuest !== false) {
      return;
    }
    // [LOG_ID: 20260714_2100] 원전 MSG 명령(메시지수신 ON/OFF)으로 이 알림을 끌 수 있게 한다.
    if (String(state.envVars?.MSG || 'ON').toUpperCase() === 'OFF') {
      return;
    }
    try {
      const result = await apiFetch('/api/memos/unread/count', { silent: true });
      const count = Number(result?.count || 0);
      if (count > 0 && typeof showToast === 'function') {
        showToast(`새 쪽지가 ${count}통 도착해 있습니다. (쪽지함: ME)`, 5000, 'info');
      }
    } catch (error) {
      // 접속 알림은 부가 기능 — 실패는 조용히 넘긴다.
    }
  }

  async function refreshUser() {
    const headers = state.token ? { Authorization: `Bearer ${state.token}` } : {};
    const wasGuest = Boolean(state.user?.isGuest ?? true);
    try {
      const response = await fetch('/api/auth/session', { headers });
      const payload = await response.json();
      const sessionData = payload?.success === true && payload.data !== undefined
        ? payload.data
        : payload;
      state.user = sessionData?.user || guestUser();
    } catch (error) {
      // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
      // console.error('[Auth] Failed to refresh user session', error);
      state.user = guestUser();
    }
    const isGuest = Boolean(state.user?.isGuest ?? true);
    if (wasGuest !== isGuest) {
      state.menuTree = null;
      state.menuLookup = {};
      state.menuParents = {};
      state._menuTreeGuestState = undefined;
      // [LOG_ID: 20260712_1940] 손님→회원 전환(로그인 완료 또는 부팅 시 세션 복원) 시점에만
      // 전자사서함(새 쪽지)을 확인한다. 로그아웃(회원→손님)에는 발동하지 않는다.
      if (!isGuest) {
        void notifyUnreadMemos();
      }
    }
    updateUserInfo();
  }

  const { initAuth } = createAuthServiceBootstrap({
    ...deps,
    refreshUser
  });

  const authActions = createAuthServiceActions({
    ...deps,
    guestUser,
    refreshUser
  });

  return {
    ...authActions,
    guestUser,
    initAuth,
    refreshUser
  };
}
