export function createAuthService(deps) {
  const {
    apiFetch,
    showToast,
    state,
    updateUserInfo
  } = deps;

  let unreadNotificationPromise = null;
  let authActionsPromise = null;
  let authBootstrapPromise = null;
  let authInitializationPromise = null;

  // Authentication actions and recovery handling are not needed to render the
  // public TOP screen. Keep their implementations out of the initial module
  // graph, while exposing stable async facades to every existing caller.
  function loadAuthActions() {
    if (!authActionsPromise) {
      authActionsPromise = import('./authServiceActions.js').then((module) => module.createAuthServiceActions({
        ...deps,
        guestUser,
        refreshUser
      }));
    }
    return authActionsPromise;
  }

  function callAuthAction(name, args) {
    const needsAuthBootstrap = [
      'doLogin',
      'doSignup',
      'requestPasswordReset',
      'startOAuthLogin',
      'updatePasswordByRecovery'
    ].includes(name) && !state.supabase;
    const authReady = needsAuthBootstrap
      ? Promise.resolve(initAuth()).catch(() => null)
      : Promise.resolve();
    return authReady.then(() => loadAuthActions()).then((actions) => {
      const action = actions?.[name];
      if (typeof action !== 'function') {
        throw new Error(`Authentication action is unavailable: ${name}`);
      }
      return action(...args);
    });
  }

  function initAuth() {
    if (!authInitializationPromise) {
      if (!authBootstrapPromise) {
        authBootstrapPromise = import('./authServiceBootstrap.js').then((module) => module.createAuthServiceBootstrap({
          ...deps,
          refreshUser
        }));
      }
      authInitializationPromise = authBootstrapPromise
        .then((bootstrap) => bootstrap.initAuth())
        .catch((error) => {
          authInitializationPromise = null;
          throw error;
        });
    }
    return authInitializationPromise;
  }

  function guestUser() {
    return { userId: 'guest', nickName: '손님', level: 1, isAdmin: false, isGuest: true };
  }

  // [LOG_ID: 20260712_1940] 하이텔 '전자사서함 확인' 재현 — 접속(로그인/세션 복원) 직후 새 쪽지
  // 도착 여부를 알려준다(하이텔 길라잡이 p.94: 접속 시 새 편지 도착 여부 확인이 환경설정 항목일
  // 만큼 보편적 경험). 서버 GET /api/memos/unread/count 는 이미 있었으나 클라이언트가 한 번도
  // 호출하지 않던 것을 연결. 0통이거나 조회 실패면 침묵한다.
  async function fetchUnreadMemoNotification() {
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
        showToast(`새 쪽지가 ${count}통 도착해 있습니다. (쪽지함: ME)`, 5000, 'info', {
          title: '클릭하여 받은 쪽지함 열기',
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.location.assign('/memo');
            }
          }
        });
      }
    } catch (error) {
      // 접속 알림은 부가 기능 — 실패는 조용히 넘긴다.
    }
  }

  async function notifyUnreadMemos() {
    if (unreadNotificationPromise) return unreadNotificationPromise;
    unreadNotificationPromise = fetchUnreadMemoNotification();
    try {
      await unreadNotificationPromise;
    } finally {
      unreadNotificationPromise = null;
    }
  }

  // Initial auth runs before the first screen is rendered. Keep its unread
  // notification until the terminal footer is mounted so the first
  // render cannot erase a toast before it becomes visible.
  async function flushUnreadMemoNotification() {
    if (!state._pendingUnreadMemoNotification) return;
    state._pendingUnreadMemoNotification = false;
    await notifyUnreadMemos();
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
        const notificationUserKey = String(
          state.user?.userId || state.user?.id || state.token || 'member'
        );
        // Supabase SIGNED_IN and the explicit login refresh can both observe
        // the same guest→member transition. Record the transition identity so
        // a late listener completion cannot issue a second unread request.
        if (state._unreadMemoNotificationUserKey !== notificationUserKey) {
          state._unreadMemoNotificationUserKey = notificationUserKey;
          if (state._deferUnreadMemoNotification) {
            state._pendingUnreadMemoNotification = true;
          } else {
            void notifyUnreadMemos();
          }
        }
      } else {
        state._unreadMemoNotificationUserKey = '';
        state._pendingUnreadMemoNotification = false;
      }
    } else if (isGuest) {
      state._unreadMemoNotificationUserKey = '';
    }
    updateUserInfo();
  }

  return {
    doLogin: (...args) => callAuthAction('doLogin', args),
    doLogout: (...args) => callAuthAction('doLogout', args),
    doSignup: (...args) => callAuthAction('doSignup', args),
    precheckSignup: (...args) => callAuthAction('precheckSignup', args),
    requestPasswordReset: (...args) => callAuthAction('requestPasswordReset', args),
    resolveMemberEmail: (...args) => callAuthAction('resolveMemberEmail', args),
    searchMember: (...args) => callAuthAction('searchMember', args),
    startOAuthLogin: (...args) => callAuthAction('startOAuthLogin', args),
    updatePasswordByRecovery: (...args) => callAuthAction('updatePasswordByRecovery', args),
    guestUser,
    flushUnreadMemoNotification,
    initAuth,
    refreshUser
  };
}
