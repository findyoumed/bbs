'use strict';

const { normalizeText, stripControlCharacters } = require('./httpUtils');

const LOOPBACK_ADDRS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function normalizeRequestIdentity(value, fallback = '', maxLength = 120) {
  const normalized = normalizeText(stripControlCharacters(value), fallback);
  return normalized.slice(0, Math.max(0, Number(maxLength) || 0));
}

// [LOG: 20260731_1800] 사용자 ID는 반드시 소문자여야 한다 — 이 함수가 context.userId의
// 최상위 원천이므로 여기서 정형화하면 모든 경로가 한꺼번에 일관성을 가진다.
function normalizeRequestUserId(value, fallback = 'guest') {
  return normalizeRequestIdentity(value, fallback, 120).toLowerCase();
}

function normalizeRequestNickName(value, fallback = '\uC190\uB2D8') {
  return normalizeRequestIdentity(value, fallback, 40);
}

function normalizeRequestLevel(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(99, Math.floor(parsed)));
}

function isLoopbackAddress(value) {
  return LOOPBACK_ADDRS.has(String(value || '').trim());
}

function isLoopbackRequest(req) {
  return isLoopbackAddress(req?.socket?.remoteAddress || '');
}

function allowManualRequestIdentity(req, env = process.env) {
  return env?.NODE_ENV !== 'production' && !env?.VERCEL && isLoopbackRequest(req);
}

function buildManualRequestIdentity(req, body, options = {}) {
  const env = options.env || process.env;
  const fallback = {
    userId: 'guest',
    nickName: '\uC190\uB2D8',
    level: 1,
    isAdmin: false,
    isGuest: true,
    email: '',
    ...(options.fallback || {})
  };
  const headers = req?.headers || {};
  const allowOverride = allowManualRequestIdentity(req, env);
  // [LOG_ID: 20260727_0700] HTTP 헤더는 ISO-8859-1만 허용돼 클라이언트(apiFetch.js)가 한글
  // 닉네임 등을 encodeURIComponent로 인코딩해 보낸다 — 헤더로 온 값만 여기서 되돌린다(body는
  // JSON이라 처음부터 인코딩 제약이 없어 그대로 둔다).
  const decodeHeaderValue = (value) => {
    if (typeof value !== 'string' || !value) return value;
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  };
  const requestedUserId = allowOverride ? (body?.userId || decodeHeaderValue(headers['x-bbs-user-id'])) : undefined;
  const requestedNickName = allowOverride ? (body?.nickName || decodeHeaderValue(headers['x-bbs-nick-name'])) : undefined;
  const requestedLevel = allowOverride ? (body?.level || headers['x-bbs-level']) : undefined;
  const requestedIsAdmin = allowOverride ? (body?.isAdmin === true || headers['x-bbs-admin'] === '1') : false;
  const userId = normalizeRequestUserId(requestedUserId, fallback.userId);
  const nickName = normalizeRequestNickName(requestedNickName, fallback.nickName);
  const isAdmin = requestedIsAdmin || Boolean(options.isAdminResolver?.(userId, fallback.email || ''));
  const level = isAdmin ? 99 : normalizeRequestLevel(requestedLevel, fallback.level);

  return {
    userId,
    nickName,
    level,
    isAdmin,
    isGuest: userId === fallback.userId,
    email: fallback.email || ''
  };
}

module.exports = {
  allowManualRequestIdentity,
  buildManualRequestIdentity,
  isLoopbackAddress,
  isLoopbackRequest,
  normalizeRequestIdentity,
  normalizeRequestLevel,
  normalizeRequestNickName,
  normalizeRequestUserId,
  stripControlCharacters
};


