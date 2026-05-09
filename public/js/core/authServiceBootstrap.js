function safeParseStoredJson(storageKey) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || 'null');
  } catch (error) {
    console.error(`[Auth] Failed to parse localStorage item: ${storageKey}`, error);
    return null;
  }
}

function safeRemoveStoredItem(storageKey) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.error(`[Auth] Failed to remove localStorage item: ${storageKey}`, error);
  }
}

async function readJsonOrNull(response, label) {
  try {
    return await response.json();
  } catch (error) {
    console.error(`[Auth] Failed to parse ${label} response`, error);
    return null;
  }
}

async function redirectToSignupProfile(getAuthLeafRoutePath) {
  const signupProfilePath = `${getAuthLeafRoutePath('signup')}/profile`;
  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (currentPath === signupProfilePath) {
    return;
  }

  window.history.replaceState({ screen: 'signup' }, '', signupProfilePath);
  if (typeof window.onpopstate === 'function') {
    await window.onpopstate(new PopStateEvent('popstate'));
  }
}

async function syncPendingOAuthProfile(state, getAuthLeafRoutePath) {
  const pendingOAuth = safeParseStoredJson('01410-oauth-pending-profile');
  if (!pendingOAuth?.userId || !pendingOAuth?.nickName || !state.token) {
    return;
  }

  try {
    const response = await fetch('/api/members/oauth-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({
        userId: pendingOAuth.userId,
        nickName: pendingOAuth.nickName
      })
    });
    const payload = await readJsonOrNull(response, 'OAuth register');
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'OAuth 회원 등록을 완료하지 못했습니다.');
    }

    state._oauthSignupError = '';
    safeRemoveStoredItem('01410-oauth-pending-profile');
  } catch (error) {
    state._oauthSignupError = error?.message || 'OAuth 회원 등록을 완료하지 못했습니다.';
    await redirectToSignupProfile(getAuthLeafRoutePath);
  }
}

function readRecoveryParamsFromLocation() {
  const searchParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = String(hashParams.get('type') || searchParams.get('type') || '').trim().toLowerCase();
  const code = String(searchParams.get('code') || hashParams.get('code') || '').trim();
  const tokenHash = String(searchParams.get('token_hash') || hashParams.get('token_hash') || '').trim();
  const accessToken = String(hashParams.get('access_token') || searchParams.get('access_token') || '').trim();
  const refreshToken = String(hashParams.get('refresh_token') || searchParams.get('refresh_token') || '').trim();

  return {
    accessToken,
    code,
    refreshToken,
    hasAccessToken: Boolean(accessToken),
    isRecoveryType: type === 'recovery',
    tokenHash
  };
}

function markPasswordRecoveryActive(state, session) {
  state._passwordRecoveryActive = true;
  state._passwordResetMode = 'update';
  state._passwordResetNotice = '새 비밀번호를 입력해 주십시오.';
  state.token = session?.access_token || state.token || '';
}

function cleanPasswordRecoveryUrl() {
  const cleanPath = window.location.pathname || '/';
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState({ screen: 'password-reset' }, '', cleanPath);
}

async function exchangeRecoveryCodeForSession(state, code) {
  if (!code || typeof state.supabase?.auth?.exchangeCodeForSession !== 'function') {
    return null;
  }

  const { data, error } = await state.supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[Auth] Password recovery code exchange failed:', error.message);
    return null;
  }
  return data?.session || null;
}

async function verifyRecoveryTokenHashForSession(state, tokenHash) {
  if (!tokenHash || typeof state.supabase?.auth?.verifyOtp !== 'function') {
    return null;
  }

  const { data, error } = await state.supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery'
  });
  if (error) {
    console.error('[Auth] Password recovery token verification failed:', error.message);
    return null;
  }
  return data?.session || null;
}

async function setRecoverySessionFromImplicitTokens(state, recoveryParams) {
  const accessToken = String(recoveryParams?.accessToken || '').trim();
  const refreshToken = String(recoveryParams?.refreshToken || '').trim();
  if (!accessToken || !refreshToken || typeof state.supabase?.auth?.setSession !== 'function') {
    return null;
  }

  // [LOG: 20260509_1251] Supabase recovery 메일이 implicit hash 토큰으로 돌아오면 직접 세션화해야 request 화면 루프가 나지 않는다.
  const { data, error } = await state.supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) {
    console.error('[Auth] Password recovery implicit session restore failed:', error.message);
    return null;
  }
  return data?.session || null;
}

async function readCurrentAuthSession(state) {
  if (typeof state.supabase?.auth?.getSession !== 'function') {
    return null;
  }

  const { data } = await state.supabase.auth.getSession();
  return data?.session || null;
}

async function syncRecoveryStateFromLocation(state, isPasswordResetRoutePath, session) {
  const isPasswordResetPath = isPasswordResetRoutePath(window.location.pathname);
  const recoveryParams = readRecoveryParamsFromLocation();
  const hasRecoverySignal = isPasswordResetPath && (
    recoveryParams.isRecoveryType ||
    Boolean(recoveryParams.code) ||
    Boolean(recoveryParams.tokenHash) ||
    Boolean(recoveryParams.hasAccessToken)
  );

  if (
    !hasRecoverySignal
  ) {
    return session || null;
  }

  let recoverySession = null;
  const hasExplicitRecoveryToken = Boolean(recoveryParams.code || recoveryParams.tokenHash);
  // [LOG: 20260509_1050] Supabase recovery links may return either a PKCE `code`, a `token_hash`, or an implicit hash session.
  if (recoveryParams.code) {
    recoverySession = await exchangeRecoveryCodeForSession(state, recoveryParams.code);
  }
  if (!recoverySession && recoveryParams.tokenHash) {
    recoverySession = await verifyRecoveryTokenHashForSession(state, recoveryParams.tokenHash);
  }
  if (!recoverySession && recoveryParams.hasAccessToken) {
    recoverySession = await setRecoverySessionFromImplicitTokens(state, recoveryParams);
  }
  if (!recoverySession && !hasExplicitRecoveryToken) {
    recoverySession = session || await readCurrentAuthSession(state);
  }

  if (recoverySession) {
    markPasswordRecoveryActive(state, recoverySession);
    cleanPasswordRecoveryUrl();
    return recoverySession;
  }

  state._passwordRecoveryActive = false;
  state._passwordResetMode = 'request';
  state._passwordResetNotice = '비밀번호 재설정 링크를 확인하지 못했습니다. 다시 요청해 주십시오.';
  return null;
}

function bindAuthStateChangeListener(state, refreshUser, showPasswordReset) {
  state.supabase.auth.onAuthStateChange((event, session) => {
    state.token = session?.access_token || '';

    if (event === 'PASSWORD_RECOVERY') {
      state._passwordRecoveryActive = true;
      state._passwordResetMode = 'update';
      state._passwordResetNotice = '새 비밀번호를 입력해 주십시오.';
      void refreshUser();
      void showPasswordReset(false, 'update', { notice: state._passwordResetNotice });
      return;
    }

    if (event === 'SIGNED_OUT') {
      state._passwordRecoveryActive = false;
      state._passwordResetMode = 'request';
      state._passwordResetNotice = '';
    }

    void refreshUser();
  });
}

export function createAuthServiceBootstrap(deps) {
  const {
    apiFetch,
    getAuthLeafRoutePath,
    isPasswordResetRoutePath,
    showPasswordReset,
    state,
    refreshUser
  } = deps;

  async function initAuth() {
    state.authConfig = (await apiFetch('/api/auth/config')) || { enabled: false };

    if (state.authConfig.enabled && window.supabase) {
      state.supabase = window.supabase.createClient(
        state.authConfig.url,
        state.authConfig.publishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false // [LOG: 20260509_1314] recovery URL은 앱 bootstrap이 직접 처리해야 PASSWORD_RECOVERY 신호가 먼저 사라지지 않는다.
          }
        }
      );

      const { data } = await state.supabase.auth.getSession();
      let session = data?.session || null;

      session = await syncRecoveryStateFromLocation(state, isPasswordResetRoutePath, session) || session;

      if (session) {
        state.token = session.access_token;
        if (!state._passwordRecoveryActive) {
          await syncPendingOAuthProfile(state, getAuthLeafRoutePath);
        }
      }

      bindAuthStateChangeListener(state, refreshUser, showPasswordReset);
    }

    await refreshUser();
  }

  return {
    initAuth
  };
}
