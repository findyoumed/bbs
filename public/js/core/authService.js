import { createAuthServiceActions } from './authServiceActions.js';
import { createAuthServiceBootstrap } from './authServiceBootstrap.js';

export function createAuthService(deps) {
  const {
    state,
    updateUserInfo
  } = deps;

  function guestUser() {
    return { userId: 'guest', nickName: '손님', level: 1, isAdmin: false, isGuest: true };
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
      console.error('[Auth] Failed to refresh user session', error);
      state.user = guestUser();
    }
    const isGuest = Boolean(state.user?.isGuest ?? true);
    if (wasGuest !== isGuest) {
      state.menuTree = null;
      state.menuLookup = {};
      state.menuParents = {};
      state._menuTreeGuestState = undefined;
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
