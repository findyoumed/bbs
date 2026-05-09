export function createSignupClient(deps) {
  const {
    apiFetch,
    refreshUser,
    searchMember,
    state
  } = deps;

  function buildSignupEmail(userId) {
    return `${String(userId || '').trim().toLowerCase()}@01410.local`;
  }

  async function doSignup(userId, nickName, email, password) {
    const resolvedEmail = String(email || '').trim() || buildSignupEmail(userId);

    const existingUser = await searchMember({ userId });
    if (existingUser) {
      throw new Error('\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 ID\uc785\ub2c8\ub2e4.');
    }

    const existingNick = await searchMember({ nickName });
    if (existingNick) {
      throw new Error('\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uc774\uc6a9\uc790\uba85\uc785\ub2c8\ub2e4.');
    }

    const existingEmail = await searchMember({ email: resolvedEmail });
    if (existingEmail) {
      throw new Error('\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uc774\uba54\uc77c\uc785\ub2c8\ub2e4.');
    }

    if (state.supabase) {
      const { data, error } = await state.supabase.auth.signUp({
        email: resolvedEmail,
        password,
        options: { data: { userId, nickname: nickName } }
      });
      if (error) {
        throw new Error(error.message);
      }
      if (data?.session?.access_token) {
        state.token = data.session.access_token;
        await apiFetch('/api/members/profile', {
          method: 'POST',
          body: JSON.stringify({ nickName, email: resolvedEmail })
        });
        await refreshUser();
      }
      return;
    }

    const response = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nickName, email: resolvedEmail, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || '\uac00\uc785 \uc2e4\ud328');
    }
  }

  return {
    doSignup
  };
}
