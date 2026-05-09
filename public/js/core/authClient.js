export function createAuthClient(deps) {
  const {
    fetchImpl = fetch,
    getAuthLeafRoutePath,
    guestUser,
    refreshUser,
    state,
    updateUserInfo,
    windowObject = window
  } = deps;

  // [LOG: 20260410_1105] 인증 API/세션 동작을 app.js에서 분리
  async function searchMember(criteria = {}, { allowMissing = true } = {}) {
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

    const res = await fetchImpl(`/api/members/search?${params.toString()}`);
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.message || '회원 정보를 조회하지 못했습니다.');
    }
    if (allowMissing) {
      return payload?.found ? (payload.member || null) : null;
    }
    return payload || null;
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
    if (!member?.email) {
      throw new Error('존재하지 않는 이메일 또는 아이디입니다.');
    }
    return String(member.email || '').trim();
  }

  async function doLogin(userIdOrEmail, password) {
    if (!state.supabase) {
      throw new Error('로그인 기능이 설정되지 않았습니다.');
    }
    const resolvedEmail = await resolveMemberEmail(userIdOrEmail);

    const { error } = await state.supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password
    });
    if (error) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    await refreshUser();
  }

  async function requestPasswordReset(userIdOrEmail) {
    if (!state.authConfig.enabled) {
      throw new Error('비밀번호 찾기 기능이 설정되지 않았습니다.');
    }
    const passwordResetPath = getAuthLeafRoutePath('password');
    const response = await fetchImpl('/api/members/password-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIdOrEmail,
        redirectTo: `${windowObject.location.origin}${passwordResetPath}`
      })
    });
    const data = await response.json().catch(() => ({}));
    const result = data?.data && typeof data.data === 'object'
      ? data.data
      : data;
    // [LOG: 20260509_1113] password-recovery uses the API response wrapper, so check nested data.success too.
    if (data?.success === false || result?.success === false) {
      throw new Error(result.message || data.message || '비밀번호 재설정 메일을 준비하지 못했습니다.');
    }
    if (!response.ok) {
      throw new Error(result.message || data.message || '비밀번호 재설정 메일을 준비하지 못했습니다.');
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

  async function doLogout() {
    if (state.supabase) {
      await state.supabase.auth.signOut();
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
        redirectTo: `${windowObject.location.origin}/`
      }
    });
    if (error) {
      throw new Error(error.message || '소셜 로그인을 시작할 수 없습니다.');
    }
  }

  return {
    doLogin,
    doLogout,
    requestPasswordReset,
    resolveMemberEmail,
    searchMember,
    startOAuthLogin,
    updatePasswordByRecovery
  };
}
