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
  const rateLimitWindow = Number(env.RATE_LIMIT_WINDOW_MS) || 60000;
  // [LOG: 20260428_1600] Increase rate limit during tests to prevent 429 failures in CI/Smoke tests
  const isTest = (env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test');
  const isDev = (env.NODE_ENV === 'development' || !env.NODE_ENV); // 기본값 혹은 개발 모드
  const rateLimitMax = (isTest || isDev) ? 1000 : (Number(env.RATE_LIMIT_MAX_REQUESTS) || 60);
  const trustProxy = Boolean(env.VERCEL || env.TRUST_PROXY);
  const checkRateLimit = createRateLimiter({
    windowMs: rateLimitWindow,
    maxRequests: rateLimitMax,
    trustProxy
  });

  return {
    allowedOrigins,
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

  const corsHeaders = buildCorsHeaders(req.headers['origin'] || '', guards.allowedOrigins);
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
