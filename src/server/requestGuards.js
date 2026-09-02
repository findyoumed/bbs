'use strict';

const crypto = require('crypto');
const { buildCorsHeaders, parseAllowedOrigins, sendJson } = require('./httpUtils');
const { createRateLimiter } = require('./rateLimiter');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function createRequestGuards(env = process.env) {
  const allowedOrigins = parseAllowedOrigins(env.BBS_ALLOWED_ORIGINS);
  const vercelRuntime = ['1', 'true'].includes(String(env.VERCEL || '').trim().toLowerCase());
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const processNodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const isProduction = nodeEnv === 'production' || vercelRuntime;
  // Keep the permissive wildcard fallback for local development, but never
  // emit it from a production deployment whose allowlist was omitted.
  const corsFailClosed = isProduction && allowedOrigins.length === 0;
  const rateLimitWindow = Number(env.RATE_LIMIT_WINDOW_MS) || 60000;
  // [LOG: 20260428_1600] Increase rate limit during tests to prevent 429 failures in CI/Smoke tests
  const isTest = (nodeEnv === 'test' || processNodeEnv === 'test');
  const isDev = (nodeEnv === 'development' || !nodeEnv); // 기본값 혹은 개발 모드
  const configuredRateLimitMax = Number(env.RATE_LIMIT_MAX_REQUESTS);
  const rateLimitMax = configuredRateLimitMax > 0
    ? configuredRateLimitMax
    : ((isTest || isDev) ? 1000 : 60);
  const trustProxy = Boolean(env.VERCEL || env.TRUST_PROXY);
  const checkRateLimit = createRateLimiter({
    windowMs: rateLimitWindow,
    maxRequests: rateLimitMax,
    trustProxy
  });

  return {
    allowedOrigins,
    corsFailClosed,
    checkRateLimit
  };
}

function initializeRequest(req, res) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  return requestId;
}

function handleCorsPreflight(req, res, requestUrl, guards) {
  if (req.method !== 'OPTIONS' || !requestUrl.pathname.startsWith('/api/')) {
    return false;
  }

  const corsHeaders = guards.corsFailClosed
    ? { Vary: 'Origin' }
    : buildCorsHeaders(req.headers['origin'] || '', guards.allowedOrigins);
  res.writeHead(204, corsHeaders);
  res.end();
  return true;
}

function handleRateLimit(req, res, requestUrl, guards) {
  if (!requestUrl.pathname.startsWith('/api/')) {
    return false;
  }
  if (guards.checkRateLimit(req)) {
    return false;
  }

  sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
  return true;
}

module.exports = {
  SECURITY_HEADERS,
  createRequestGuards,
  handleCorsPreflight,
  handleRateLimit,
  initializeRequest
};
