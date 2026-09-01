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
  return Boolean(
    user?.email_confirmed_at ||
    user?.confirmed_at ||
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

function isLikelyJwt(token) {
  const value = String(token || '').trim();
  // Supabase access tokens are three-part JWTs. This is only a cheap shape
  // check to avoid sending obviously malformed/stale values upstream; the
  // Auth service remains responsible for signature and claim validation.
  return value.split('.').length === 3 && value.split('.').every(Boolean);
}

class AuthBridge {
  constructor(options = {}) {
    this.url = String(options.url || '').trim();
    this.publishableKey = String(options.publishableKey || '').trim();
    // [LOG: 20260802_1700] adminUserIds must be lowercased at construction time:
    // _isAdmin() receives userId from normalizeRequestUserId() which always lowercases,
    // so a mixed-case value like BBS_ADMIN_USER_IDS=SysOp would never match 'sysop'.
    // adminEmails was already lowercased here — apply the same normalization to adminUserIds.
    this.adminUserIds = new Set(parseCsv(options.adminUserIds).map((item) => item.toLowerCase()));
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

    if (!this.client || !token || !isLikelyJwt(token)) {
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
    const appMetadata = user?.app_metadata || {};
    const email = String(user?.email || '').trim();
    const authUserId = maybeUuid(user?.id) || String(user?.id || '').trim();
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
    // raw_user_meta_data is editable by the account holder and must never
    // grant elevated privileges.  Keep display/identity fields from
    // user_metadata for compatibility, but derive authorization only from
    // server-side configuration or trusted app_metadata.
    const emailVerified = hasVerifiedAuthEmail(user);
    // For an Auth session, BBS_ADMIN_USER_IDS must match the immutable Auth
    // subject, not editable user_metadata.userId. Legacy userId allowlists are
    // still honored by _manualContext() for loopback development requests.
    const configuredAuthAdmin = this._isAuthAdmin(authUserId, email, emailVerified);
    const isAdmin = configuredAuthAdmin || appMetadata.is_admin === true;
    return {
      authUserId,
      userId,
      nickName,
      level: isAdmin ? 99 : normalizeRequestLevel(appMetadata.level, 1),
      isAdmin,
      isGuest: false,
      email,
      authProvider,
      emailVerified,
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

  // [LOG: 20260802_1800] adminUserIds.has() 조회 시 toLowerCase() 추가 — 방어적 대칭성 확보.
  // 생성자에서 adminUserIds는 이미 소문자로 저장(round 35 수정)되고, _isAdmin()에 도달하는
  // userId도 normalizeRequestUserId()를 거쳐 항상 소문자이므로 현재는 실질적 버그가 없다.
  // 그러나 adminEmails.has()는 lookup 시에도 명시적으로 toLowerCase()를 적용하는 반면
  // adminUserIds.has()는 적용하지 않아 두 형제 필드의 처리가 비대칭이었다.
  // 새로운 호출 경로가 추가될 경우를 대비해 lookup 쪽도 소문자 정규화를 명시적으로 통일한다.
  _isAdmin(userId, email) {
    return this.adminUserIds.has(String(userId || '').trim().toLowerCase()) || this.adminEmails.has(String(email || '').trim().toLowerCase());
  }

  _isAuthAdmin(authUserId, email, emailVerified = false) {
    return this.adminUserIds.has(String(authUserId || '').trim().toLowerCase())
      || (emailVerified && this.adminEmails.has(String(email || '').trim().toLowerCase()));
  }

  _throwAdminError(action, error) {
    return throwAdminError(action, error);
  }

  _throwRecoveryError(error) {
    return throwRecoveryError(error);
  }
}

module.exports = AuthBridge;
module.exports.isLikelyJwt = isLikelyJwt;
// [LOG_ID: 20260731_2000] isTruthyAuthFlag/hasVerifiedAuthEmail은 authRoutes.js가 문자
// 그대로 복제해 갖고 있었다 — Supabase Auth user 객체 판독 로직의 원본은 이 파일이므로
// 여기서 함께 내보내고 authRoutes는 이를 가져다 쓴다.
module.exports.isTruthyAuthFlag = isTruthyAuthFlag;
module.exports.hasVerifiedAuthEmail = hasVerifiedAuthEmail;
