'use strict';

const BaseRouter = require('./BaseRouter');
const { validateEmail } = require('../httpUtils');
const {
  getReservedNicknameMessage,
  getReservedUserIdMessage,
  getReservedEmailMessage,
  validateReservedNickname,
  validateReservedUserId,
  validateReservedEmail
} = require('../ReservedNicknamePolicy');
const logger = require('../logger');

function isTruthyAuthFlag(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function isOAuthAuthUser(user) {
  const provider = String(user?.app_metadata?.provider || '').trim().toLowerCase();
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return (
    (provider && provider !== 'email') ||
    identities.some((identity) => {
      const identityProvider = String(identity?.provider || '').trim().toLowerCase();
      return identityProvider && identityProvider !== 'email';
    })
  );
}

function hasVerifiedAuthEmail(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const metadata = user?.user_metadata && typeof user.user_metadata === 'object'
    ? user.user_metadata
    : {};

  return Boolean(
    user?.email_confirmed_at ||
    user?.confirmed_at ||
    isTruthyAuthFlag(metadata.email_verified) ||
    isTruthyAuthFlag(metadata.emailVerified) ||
    identities.some((identity) => {
      const identityData = identity?.identity_data && typeof identity.identity_data === 'object'
        ? identity.identity_data
        : {};
      return (
        isTruthyAuthFlag(identityData.email_verified) ||
        isTruthyAuthFlag(identityData.emailVerified) ||
        isTruthyAuthFlag(identityData.verified_email) ||
        isTruthyAuthFlag(identityData.verifiedEmail)
      );
    })
  );
}

/**
 * [LOG: 20260426_1905] Modularized AuthRoutes from MemberRouter (Evolution Mode: Structural Optimization)
 */
class AuthRouter extends BaseRouter {
  get routes() {
    return [
      { 
        method: 'POST', 
        pattern: '/api/members/password-recovery', 
        handler: 'requestPasswordRecovery', 
        needContext: true,
        validate: {
          body: {
            userIdOrEmail: { required: true },
            redirectTo: { required: true }
          }
        }
      },
      { 
        method: 'POST', 
        pattern: '/api/members/register', 
        handler: 'register',
        validate: {
          body: {
            userId: { required: true, pattern: /^[a-zA-Z0-9_]{3,20}$/ },
            nickName: { required: true, minLength: 2, maxLength: 20 },
            // [LOG_ID: 20260721_1900] 가입 시에만 4자 이상으로 느슨해서, 브라우저 UI(6자 이상,
            // signupFlowSubmit.js)를 우회해 API를 직접 호출하면 비밀번호 변경(memberRoutes.js,
            // 6자 이상)보다 약한 4~5자 비밀번호로 가입할 수 있었다 — 정책을 6자로 통일.
            password: { required: true, minLength: 6 }
          }
        }
      },
      {
        method: 'POST',
        pattern: '/api/members/signup-precheck',
        handler: 'signupPrecheck',
        validate: {
          body: {
            // [LOG_ID: 20260721_1900] {3,40}이라 21~40자 아이디는 사전 확인(precheck)에서
            // "사용 가능"으로 뜨지만 실제 가입(register, 위 {3,20})에서는 거절됐다 — 실제 제한과
            // 통일.
            userId: { pattern: /^[a-zA-Z0-9_]{3,20}$/ },
            nickName: { minLength: 2, maxLength: 20 },
            email: {}
          }
        }
      },
      {
        method: 'POST',
        pattern: '/api/members/oauth-register',
        handler: 'oauthRegister',
        validate: {
          body: {
            userId: { required: true, pattern: /^[a-zA-Z0-9_]{3,20}$/ },
            nickName: { required: true, minLength: 2, maxLength: 20 }
          }
        }
      }
    ];
  }

  async requestPasswordRecovery() {
    const { authBridge } = this.deps;
    const body = await this.getBody();
    
    try {
      const userIdOrEmail = String(body.userIdOrEmail).trim();
      const redirectTo = String(body.redirectTo).trim();

      const member = await this.findMemberByIdentifier(userIdOrEmail);
      if (!member) this.notFound('존재하지 않는 이메일 또는 아이디입니다.');

      const resolvedEmail = validateEmail(String(member.email || '').trim());
      if (!resolvedEmail) this.validationError('비밀번호 재설정용 이메일 주소가 등록되어 있지 않습니다.');

      if (authBridge?.syncMemberAuthProfile) {
        await authBridge.syncMemberAuthProfile({
          userId: member.userId,
          nickName: member.nickName,
          email: resolvedEmail
        }, {
          lookupEmail: resolvedEmail,
          allowTargetEmailLookup: true,
          forceValidateEmail: true
        });
      }

      if (authBridge?.requestPasswordRecovery) {
        await authBridge.requestPasswordRecovery(resolvedEmail, { redirectTo });
      } else {
        this.error(503, '비밀번호 찾기 기능이 설정되지 않았습니다.');
      }

      return this.send(200, { success: true, userId: member.userId, email: resolvedEmail });
    } catch (error) {
      if ([400, 404, 409, 429, 503].includes(Number(error?.status))) {
        return this.send(200, { success: false, message: error.message || '요청을 처리하지 못했습니다.' });
      }
      throw error;
    }
  }

  async register() {
    const { memberRepository } = this.deps;
    const body = await this.getBody();
    const { userId, nickName, email, password } = body;
    const rawUserId = String(userId).trim();
    const rawNickName = String(nickName).trim();
    const rawPassword = String(password).trim();

    this.assertUserIdAllowed(rawUserId);
    this.assertNicknameAllowed(rawNickName, rawUserId);
    if (email) {
      this.assertEmailAllowed(email);
    }

    const existing = await memberRepository.getMember(rawUserId);
    if (existing) this.conflict('이미 사용 중인 아이디입니다.');

    if (rawNickName && typeof memberRepository.findByNickName === 'function') {
      const duplicateNick = await memberRepository.findByNickName(rawNickName);
      if (duplicateNick) this.conflict('이미 사용 중인 닉네임입니다.');
    }

    const member = await memberRepository.ensureMember({
      userId: rawUserId,
      nickName: rawNickName,
      email: email ? validateEmail(email) : '',
      level: 1,
      isAdmin: false,
      isOpen: true,
      registrationDateTime: new Date().toISOString()
    });
    await memberRepository.setPassword(rawUserId, rawPassword, {
      nickName: member.nickName,
      email: member.email
    });
    return this.send(201, { success: true, userId: member.userId });
  }

  async signupPrecheck() {
    const { memberRepository } = this.deps;
    const body = await this.getBody();
    const rawUserId = String(body.userId).trim();
    const rawNickName = String(body.nickName).trim();
    const email = validateEmail(body.email || '');

    if (!rawUserId && !rawNickName && !email) {
      this.validationError('확인할 가입 정보를 입력해 주세요.');
    }

    const reservedUserId = rawUserId ? validateReservedUserId(rawUserId) : { allowed: true };
    const reservedNickName = rawNickName ? validateReservedNickname(rawNickName, rawUserId) : { allowed: true };
    const reservedEmail = email ? validateReservedEmail(email) : { allowed: true };

    const [
      existingById,
      existingByNickName,
      existingByEmail,
      existingAuthUser
    ] = await Promise.all([
      rawUserId
        ? memberRepository.getMember(rawUserId)
        : Promise.resolve(null),
      rawNickName && typeof memberRepository.findByNickName === 'function'
        ? memberRepository.findByNickName(rawNickName)
        : Promise.resolve(null),
      email && typeof memberRepository.findByEmail === 'function'
        ? memberRepository.findByEmail(email)
        : Promise.resolve(null),
      // [LOG: 20260429_1803] Catch Supabase Auth-only email duplicates before the agreement/signUp step.
      email
        ? this.findAuthUserByEmail(email)
        : Promise.resolve(null)
    ]);

    const conflicts = [];
    if (!reservedUserId.allowed) {
      conflicts.push({
        field: 'userId',
        reason: 'reserved-user-id',
        message: getReservedUserIdMessage(reservedUserId.keyword)
      });
    }
    if (!reservedNickName.allowed) {
      conflicts.push({
        field: 'nickName',
        reason: 'reserved-nickname',
        message: getReservedNicknameMessage(reservedNickName.keyword)
      });
    }
    if (!reservedEmail.allowed) {
      conflicts.push({
        field: 'email',
        reason: 'reserved-email',
        message: getReservedEmailMessage(reservedEmail.keyword)
      });
    }
    if (existingById) {
      conflicts.push({
        field: 'userId',
        reason: 'member-user-id',
        message: '이미 사용 중인 ID입니다.'
      });
    }
    if (existingByNickName) {
      conflicts.push({
        field: 'nickName',
        reason: 'member-nickname',
        message: '이미 사용 중인 닉네임입니다.'
      });
    }
    if (existingByEmail || existingAuthUser) {
      conflicts.push({
        field: 'email',
        reason: existingByEmail ? 'member-email' : 'auth-email',
        message: '이미 가입된 이메일입니다. 로그인 또는 비밀번호 찾기를 이용해 주십시오.'
      });
    }

    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      return this.send(200, {
        available: false,
        field: firstConflict.field,
        reason: firstConflict.reason,
        message: conflicts.map((conflict) => conflict.message).join(' / '),
        conflicts
      });
    }

    return this.send(200, { available: true });
  }

  async oauthRegister() {
    const { authBridge, memberRepository } = this.deps;
    const authHeader = String(this.req.headers?.authorization || '').trim();
    const token = /^Bearer\s+/i.test(authHeader) ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';

    if (!token || !authBridge?.client) this.unauthorized('OAuth 인증이 필요합니다.');

    const { data: authData, error: authError } = await authBridge.client.auth.getUser(token);
    if (authError || !authData?.user) this.unauthorized('유효하지 않은 인증 토큰입니다.');

    const body = await this.getBody();
    const rawUserId = String(body.userId).trim();
    const rawNickName = String(body.nickName).trim();
    const authUser = authData.user;
    const email = validateEmail(authUser.email || '');
    const authUserId = String(authUser.id || '').trim();
    const isVerifiedOAuthEmail = Boolean(email && isOAuthAuthUser(authUser) && hasVerifiedAuthEmail(authUser));

    this.assertUserIdAllowed(rawUserId);
    this.assertNicknameAllowed(rawNickName, rawUserId);
    if (email) {
      this.assertEmailAllowed(email);
    }

    if (email && typeof memberRepository.findByEmail === 'function') {
      const existingByEmail = await memberRepository.findByEmail(email);
      if (existingByEmail) {
        // [LOG: 20260429_1745] Existing members may be signed in through OAuth only when the provider verified the same email.
        if (!isVerifiedOAuthEmail) {
          this.conflict('소셜 계정 이메일 확인이 필요합니다. 기존 로그인 방식으로 로그인해 주십시오.');
        }

        const linkedAuthUserId = String(existingByEmail.authUserId || '').trim();
        if (linkedAuthUserId && linkedAuthUserId !== authUserId) {
          this.conflict('이미 다른 인증 계정과 연결된 이메일입니다. 기존 로그인 방식으로 로그인해 주십시오.');
        }

        // Keep the existing member row intact; syncMemberAuthProfile records the BBS userId on the current auth user.
        const linkedMember = existingByEmail;

        if (authBridge?.syncMemberAuthProfile) {
          try {
            await authBridge.syncMemberAuthProfile(
              {
                userId: linkedMember.userId,
                nickName: linkedMember.nickName,
                email
              },
              { authUserId, allowMissingAuthUser: true }
            );
          } catch (_syncErr) { /* non-fatal */ }
        }

        return this.send(200, {
          success: true,
          userId: linkedMember.userId,
          linkedExisting: true
        });
      }
    }

    const existingById = await memberRepository.getMember(rawUserId);
    if (existingById) this.conflict('이미 사용 중인 아이디입니다.');
    
    if (typeof memberRepository.findByNickName === 'function') {
      const dupNick = await memberRepository.findByNickName(rawNickName);
      if (dupNick) this.conflict('이미 사용 중인 닉네임입니다.');
    }

    const member = await memberRepository.ensureMember({
      userId: rawUserId,
      nickName: rawNickName,
      email,
      authUserId,
      level: 1,
      isAdmin: false,
      isOpen: true,
      registrationDateTime: new Date().toISOString()
    });

    if (authBridge?.syncMemberAuthProfile && email) {
      try {
        await authBridge.syncMemberAuthProfile(
          { userId: rawUserId, nickName: member.nickName, email },
          { authUserId, allowMissingAuthUser: true }
        );
      } catch (_syncErr) { /* non-fatal */ }
    }

    return this.send(201, { success: true, userId: member.userId });
  }

  // --- Helpers ---

  assertUserIdAllowed(userId) {
    const reservedUserId = validateReservedUserId(userId);
    if (!reservedUserId.allowed) {
      this.conflict(getReservedUserIdMessage(reservedUserId.keyword));
    }
  }

  assertNicknameAllowed(nickName, userId) {
    const reservedNickName = validateReservedNickname(nickName, userId);
    if (!reservedNickName.allowed) {
      this.conflict(getReservedNicknameMessage(reservedNickName.keyword));
    }
  }

  assertEmailAllowed(email) {
    const reservedEmail = validateReservedEmail(email);
    if (!reservedEmail.allowed) {
      this.conflict(getReservedEmailMessage(reservedEmail.keyword));
    }
  }

  async findMemberByIdentifier(identifier) {
    const { memberRepository } = this.deps;
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;
    if (normalized.includes('@') && typeof memberRepository.findByEmail === 'function') {
      return memberRepository.findByEmail(normalized);
    }
    return memberRepository.getMember(normalized);
  }

  async findAuthUserByEmail(email) {
    const { authBridge } = this.deps;
    const normalizedEmail = validateEmail(email || '');
    if (!normalizedEmail || typeof authBridge?._findAuthUser !== 'function') {
      return null;
    }

    try {
      return await authBridge._findAuthUser((user) => (
        String(user?.email || '').trim().toLowerCase() === normalizedEmail
      ));
    } catch (error) {
      logger.error('Signup auth email precheck failed', { component: 'AuthRouter', error: error.message });
      return null;
    }
  }
}

async function handleAuthRoutes(deps) {
  const router = new AuthRouter(deps);
  return await router.handle();
}

module.exports = handleAuthRoutes;
