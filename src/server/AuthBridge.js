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
      emailVerified: hasVerifiedAuthEmail(user)
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
