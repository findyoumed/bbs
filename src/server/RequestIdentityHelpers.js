'use strict';

const { normalizeText, stripControlCharacters } = require('./httpUtils');

const LOOPBACK_ADDRS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function normalizeRequestIdentity(value, fallback = '', maxLength = 120) {
  const normalized = normalizeText(stripControlCharacters(value), fallback);
  return normalized.slice(0, Math.max(0, Number(maxLength) || 0));
}

function normalizeRequestUserId(value, fallback = 'guest') {
  return normalizeRequestIdentity(value, fallback, 120);
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
  const requestedUserId = allowOverride ? (body?.userId || headers['x-bbs-user-id']) : undefined;
  const requestedNickName = allowOverride ? (body?.nickName || headers['x-bbs-nick-name']) : undefined;
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


