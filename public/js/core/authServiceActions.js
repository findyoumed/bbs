async function readJsonOrFallback(response, fallbackValue = null, label = 'response') {
  try {
    return await response.json();
  } catch (error) {
    // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.error 주석 처리
    // console.error(`[Auth] Failed to parse ${label}`, error);
    return fallbackValue;
  }
}

function buildMemberSearchParams(criteria, allowMissing) {
  const params = new URLSearchParams();
  if (allowMissing) {
    params.set('allowMissing', '1');
  }

  Object.entries(criteria || {}).forEach(([key, value]) => {
    const normalized = String(value || '').trim();
    if (normalized) {
      params.set(key, normalized);
    }
  });

  if (!Array.from(params.keys()).some((key) => key !== 'allowMissing')) {
    throw new Error('검색 조건이 필요합니다.');
  }

  return params;
}

function getSignupFieldId(field) {
  const normalized = String(field || '').trim();
  if (normalized === 'userId') return 'signup-userid';
  if (normalized === 'nickName') return 'signup-nickname';
  if (normalized === 'email') return 'signup-email';
  return 'signup-userid';
}

function normalizeSignupErrorMessage(message) {
  const text = String(message || '').trim();
  const normalized = text.toLowerCase();
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('email already')
  ) {
    return '이미 가입된 이메일입니다. 로그인 또는 비밀번호 찾기를 이용해 주십시오.';
  }
  return text || '가입 처리에 실패했습니다.';
}

async function finalizeSignupSession(apiFetch, refreshUser, state, nickname, resolvedEmail, accessToken) {
  if (!accessToken) {
    return false;
  }

  state.token = accessToken;
  await apiFetch('/api/members/profile', {
    method: 'POST',
    body: JSON.stringify({ nickName: nickname, email: resolvedEmail })
  });
  await refreshUser();
  return true;
}

export function createAuthServiceActions(deps) {
  const {
    apiFetch,
    getAuthLeafRoutePath,
    state,
    guestUser,
    refreshUser,
    updateUserInfo
  } = deps;

  async function searchMember(criteria = {}, { allowMissing = true } = {}) {
    const params = buildMemberSearchParams(criteria, allowMissing);
    const response = await fetch(`/api/members/search?${params.toString()}`);
    const payload = await readJsonOrFallback(response, null, 'member search response');

    if (!response.ok) {
      throw new Error(payload?.message || '회원 정보를 조회하지 못했습니다.');
    }

    // [LOG: 20260429_1803] Member search uses the standard API envelope; unwrap it before duplicate checks.
    const data = payload?.success === true && payload.data !== undefined
      ? payload.data
      : payload;

    if (allowMissing) {
      return data?.found ? (data.member || null) : null;
    }

    return data || null;
  }

  async function resolveMemberEmail(userIdOrEmail) {
    const normalizedInput = String(userIdOrEmail || '').trim();
    if (!normalizedInput) {
      throw new Error('이메일 또는 아이디를 입력해 주십시오.');
    }

    if (normalizedInput.includes('@')) {
      return normalizedInput;
    }

    const member = await searchMember({ userId: normalizedInput });
    if (!member) {
      throw new Error('입력하신 ID는 없습니다. 확인후 입력하십시오.');
    }
    if (!member.email) {
      throw new Error('이메일이 등록되지 않은 계정입니다. 관리자에게 문의하세요.');
    }

    return String(member.email || '').trim();
  }

  async function doLogin(userIdOrEmail, password) {
    if (!state.supabase) {
      throw new Error('로그인 기능이 설정되지 않았습니다.');
    }

    const resolvedEmail = await resolveMemberEmail(userIdOrEmail);
    const { data, error } = await state.supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password
    });

    if (error) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    state.token = String(data?.session?.access_token || '').trim();
    if (!state.token && typeof state.supabase.auth.getSession === 'function') {
      const { data: sessionData } = await state.supabase.auth.getSession();
      state.token = String(sessionData?.session?.access_token || '').trim();
    }

    await refreshUser();
  }

  async function requestPasswordReset(userIdOrEmail) {
    if (!state.authConfig.enabled) {
      throw new Error('비밀번호 찾기 기능이 설정되지 않았습니다.');
    }

    const passwordResetPath = getAuthLeafRoutePath('password');
    const response = await fetch('/api/members/password-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIdOrEmail,
        redirectTo: `${window.location.origin}${passwordResetPath}`
      })
    });
    const payload = await readJsonOrFallback(response, {}, 'password recovery response');
    const result = payload?.data && typeof payload.data === 'object'
      ? payload.data
      : payload;

    // [LOG: 20260509_1113] password-recovery uses the API response wrapper, so check nested data.success too.
    if (payload?.success === false || result?.success === false || !response.ok) {
      throw new Error(result?.message || payload?.message || '비밀번호 재설정 메일을 준비하지 못했습니다.');
    }
  }

  async function updatePasswordByRecovery(password, passwordConfirm) {
    if (!state.supabase) {
      throw new Error('비밀번호 변경 기능이 설정되지 않았습니다.');
    }
    if (!password) {
      throw new Error('새 비밀번호를 입력해 주십시오.');
    }
    if (String(password).length < 6) {
      throw new Error('비밀번호는 6자 이상이어야 합니다.');
    }
    if (password !== passwordConfirm) {
      throw new Error('비밀번호 확인이 일치하지 않습니다.');
    }

    const { error } = await state.supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message || '비밀번호를 변경하지 못했습니다.');
    }
  }

  async function clearSupabaseSessionLocally() {
    const authClient = state.supabase?.auth;
    if (!authClient) return;

    if (typeof authClient._removeSession === 'function') {
      await authClient._removeSession();
      return;
    }

    const storage = authClient.storage;
    const storageKey = authClient.storageKey;
    if (storage && storageKey && typeof storage.removeItem === 'function') {
      await storage.removeItem(storageKey);
      await storage.removeItem(`${storageKey}-code-verifier`);
      await storage.removeItem(`${storageKey}-user`);
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(window.localStorage)
        .filter((key) => /^sb-.*-auth-token(?:-(?:code-verifier|user))?$/.test(key))
        .forEach((key) => window.localStorage.removeItem(key));
    }
  }

  async function doLogout(options = {}) {
    if (state.supabase) {
      if (options.localOnly) {
        await clearSupabaseSessionLocally();
      } else {
        try {
          const { error } = await state.supabase.auth.signOut();
          if (error) {
            // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.warn 주석 처리
            // console.warn('[Auth] Supabase signOut failed; clearing local session:', error.message);
            await clearSupabaseSessionLocally();
          }
        } catch (error) {
          // [LOG_ID: 20260806_1512] AI 코딩 주석화 — console.warn 주석 처리
          // console.warn('[Auth] Supabase signOut threw; clearing local session:', error.message);
          await clearSupabaseSessionLocally();
        }
      }
    }

    state.token = '';
    state.user = guestUser();
    updateUserInfo();
  }

  async function startOAuthLogin(provider) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!normalizedProvider) {
      throw new Error('소셜 로그인 공급자를 확인할 수 없습니다.');
    }
    if (!state.supabase) {
      throw new Error('소셜 로그인 기능이 설정되지 않았습니다.');
    }

    const { error } = await state.supabase.auth.signInWithOAuth({
      provider: normalizedProvider,
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      throw new Error(error.message || '소셜 로그인을 시작할 수 없습니다.');
    }
  }

  // [LOG: 20260429_1803] Check member/Auth email duplicates before the agreement screen.
  async function precheckSignup(userId, nickname, email) {
    const payload = await apiFetch('/api/members/signup-precheck', {
      method: 'POST',
      silent: true,
      body: JSON.stringify({
        userId,
        nickName: nickname,
        email
      })
    });

    if (payload?.available === false) {
      const conflicts = Array.isArray(payload.conflicts)
        ? payload.conflicts.filter((conflict) => conflict?.field && conflict?.message)
        : [];
      const message = conflicts.length > 0
        ? conflicts.map((conflict) => conflict.message).join(' / ')
        : (payload.message || '이미 사용 중인 가입 정보입니다.');
      const firstConflict = conflicts[0] || payload;
      const error = new Error(message);
      error.conflicts = conflicts;
      error.fieldId = getSignupFieldId(payload.field);
      error.reason = firstConflict.reason || payload.reason || '';
      error.field = firstConflict.field || payload.field || '';
      throw error;
    }

    return payload || { available: true };
  }

  async function doSignup(userId, nickname, email, password) {
    const resolvedEmail = email || `${userId.trim().toLowerCase()}@01410.local`;

    await precheckSignup(userId, nickname, resolvedEmail);

    if (state.supabase) {
      const { data, error } = await state.supabase.auth.signUp({
        email: resolvedEmail,
        password,
        options: {
          data: {
            userId,
            nickname
          }
        }
      });

      if (error) {
        const signupError = new Error(normalizeSignupErrorMessage(error.message));
        signupError.fieldId = 'signup-email';
        throw signupError;
      }

      const signupToken = String(data?.session?.access_token || '').trim();
      if (await finalizeSignupSession(apiFetch, refreshUser, state, nickname, resolvedEmail, signupToken)) {
        return;
      }

      const { data: loginData, error: loginError } = await state.supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password
      });

      if (loginError) {
        throw new Error('가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 로그인해 주십시오.');
      }

      const loginToken = String(loginData?.session?.access_token || '').trim();
      if (!await finalizeSignupSession(apiFetch, refreshUser, state, nickname, resolvedEmail, loginToken)) {
        throw new Error('가입은 완료되었지만 로그인 세션을 확인하지 못했습니다. 다시 로그인해 주십시오.');
      }
      return;
    }

    const response = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        nickName: nickname,
        email: resolvedEmail,
        password
      })
    });

    if (!response.ok) {
      const payload = await readJsonOrFallback(response, {}, 'member register response');
      throw new Error(normalizeSignupErrorMessage(payload.message || '가입 처리에 실패했습니다.'));
    }
  }

  return {
    doLogin,
    doLogout,
    doSignup,
    precheckSignup,
    requestPasswordReset,
    resolveMemberEmail,
    searchMember,
    startOAuthLogin,
    updatePasswordByRecovery
  };
}
