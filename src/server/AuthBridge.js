'use strict';

const { createClient } = require('@supabase/supabase-js');
const {
  buildManualRequestIdentity,
  normalizeRequestLevel,
  normalizeRequestNickName,
  normalizeRequestUserId
} = require('./RequestIdentityHelpers');
const { requestPasswordRecovery, throwRecoveryError } = require('./AuthBridgeRecovery');
const { AuthMemberProfileService } = require('./AuthMemberProfileService');
const {
  extractAuthMemberUserId,
  findAuthUser,
  resolveAuthUser,
  syncMemberAuthProfile,
  throwAdminError
} = require('./AuthBridgeSync');
const { maybeUuid } = require('./httpUtils');

function guestUser() {
  return {
    authUserId: '',
    userId: 'guest',
    nickName: '손님',
    level: 1,
    isAdmin: false,
    isGuest: true,
    email: ''
  };
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isTruthyAuthFlag(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function resolveAuthProvider(user) {
  const provider = String(user?.app_metadata?.provider || '').trim().toLowerCase();
  if (provider) {
    return provider;
  }

  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const identity = identities.find((entry) => String(entry?.provider || '').trim());
  return String(identity?.provider || '').trim().toLowerCase();
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

function extractBearerToken(req) {
  const authHeader = String(req?.headers?.authorization || '').trim();
  if (!/^Bearer\s+/i.test(authHeader)) {
    return '';
  }
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

class AuthBridge {
  constructor(options = {}) {
    this.url = String(options.url || '').trim();
    this.publishableKey = String(options.publishableKey || '').trim();
    this.adminUserIds = new Set(parseCsv(options.adminUserIds));
    this.adminEmails = new Set(parseCsv(options.adminEmails).map((item) => item.toLowerCase()));
    this.memberRepository = options.memberRepository || null;
    this.memberProfileService = options.memberProfileService || new AuthMemberProfileService({
      memberRepository: this.memberRepository
    });
    this.client = this.url && options.serviceRoleKey
      ? createClient(this.url, options.serviceRoleKey, { auth: { persistSession: false } })
      : null;
    this.recoveryClient = this.url && (this.publishableKey || options.serviceRoleKey)
      ? createClient(this.url, this.publishableKey || options.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'implicit' // [LOG: 20260509_1314] 메일 링크가 서버 PKCE verifier에 묶이지 않고 브라우저 hash recovery로 돌아오게 고정한다.
        }
      })
      : null;
  }

  getClientConfig() {
    return {
      enabled: Boolean(this.client && this.publishableKey),
      url: this.url,
      publishableKey: this.publishableKey
    };
  }

  async getSessionFromRequest(req) {
    const token = extractBearerToken(req);
    const fallback = { enabled: this.getClientConfig().enabled, user: guestUser() };

    if (!this.client || !token) {
      return fallback;
    }

    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data?.user) {
      return fallback;
    }

    const enriched = await this.memberProfileService.enrichUser(this._mapUser(data.user));
    return {
      enabled: this.getClientConfig().enabled,
      user: enriched
    };
  }

  async resolveContext(req, body) {
    const session = await this.getSessionFromRequest(req);
    if (!session.user.isGuest) {
      return session.user;
    }
    return this._manualContext(req, body);
  }

  async syncMemberAuthProfile(member, options = {}) {
    return syncMemberAuthProfile(this, member, options);
  }

  async requestPasswordRecovery(email, options = {}) {
    return requestPasswordRecovery(this, email, options);
  }

  async _manualContext(req, body) {
    return this.memberProfileService.enrichUser(buildManualRequestIdentity(req, body, {
      env: process.env,
      fallback: guestUser(),
      isAdminResolver: (userId, email) => this._isAdmin(userId, email)
    }));
  }

  _mapUser(user) {
    const metadata = user?.user_metadata || {};
    const email = String(user?.email || '').trim();
    const authProvider = resolveAuthProvider(user);
    const nickName = normalizeRequestNickName(
      metadata.nickname ||
      metadata.nick_name ||
      metadata.name ||
      metadata.username ||
      (email ? email.split('@')[0] : '') ||
      '회원',
      '회원'
    );
    const userId = normalizeRequestUserId(metadata.userId || metadata.username || user?.id || 'guest', 'guest');
    const isAdmin = this._isAdmin(userId, email) || metadata.is_admin === true || user?.app_metadata?.is_admin === true;
    return {
      authUserId: maybeUuid(user?.id) || String(user?.id || '').trim(),
      userId,
      nickName,
      level: isAdmin ? 99 : normalizeRequestLevel(metadata.level || metadata.user_level || user?.app_metadata?.level, 1),
      isAdmin,
      isGuest: false,
      email,
      authProvider,
      emailVerified: hasVerifiedAuthEmail(user),
      // [LOG_ID: 20260731_2030] Supabase Auth가 로그인마다 자동으로 갱신하는 last_sign_in_at을
      // 실어 보낸다 — members.lastlogin_datetime 컬럼은 마이그레이션에서 DEFAULT now()로만
      // 채워지고 그 뒤로 어떤 코드도 갱신하지 않아(가입 시각에 영구 고정) "최근 접속"이 실제
      // 로그인 이력과 무관하게 가입일에 멈춰 있었다(사용자 보고: myinfo/account 최근 접속 오표시).
      lastLoginDateTime: String(user?.last_sign_in_at || '').trim()
    };
  }

  async _resolveAuthUser(options = {}) {
    return resolveAuthUser(this, options);
  }

  async _findAuthUser(predicate) {
    return findAuthUser(this, predicate);
  }

  _extractAuthMemberUserId(user) {
    return extractAuthMemberUserId(user);
  }

  _isAdmin(userId, email) {
    return this.adminUserIds.has(String(userId || '').trim()) || this.adminEmails.has(String(email || '').trim().toLowerCase());
  }

  _throwAdminError(action, error) {
    return throwAdminError(action, error);
  }

  _throwRecoveryError(error) {
    return throwRecoveryError(error);
  }
}

module.exports = AuthBridge;
// [LOG_ID: 20260731_2000] isTruthyAuthFlag/hasVerifiedAuthEmail은 authRoutes.js가 문자
// 그대로 복제해 갖고 있었다 — Supabase Auth user 객체 판독 로직의 원본은 이 파일이므로
// 여기서 함께 내보내고 authRoutes는 이를 가져다 쓴다.
module.exports.isTruthyAuthFlag = isTruthyAuthFlag;
module.exports.hasVerifiedAuthEmail = hasVerifiedAuthEmail;
