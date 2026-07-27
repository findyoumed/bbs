'use strict';

const fs = require('fs');
const path = require('path');
const BbsResponse = require('./BbsResponse');

const JSON_BODY_PROMISE = Symbol('jsonBodyPromise');

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const createHttpError = createError;

function createValidationError(message) {
  return createError(400, message || 'Invalid request data');
}

function createUnauthorizedError(message) {
  return createError(401, message || 'Authentication required');
}

function createForbiddenError(message) {
  return createError(403, message || 'Access denied');
}

function createNotFoundError(message) {
  return createError(404, message || 'Resource not found');
}

function createConflictError(message) {
  return createError(409, message || 'Resource conflict');
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function maybeUuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function normalizeMultilineText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripControlCharacters(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ');
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase();
  const normalizedTable = String(tableName || '').trim().toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    message.includes(`could not find the table 'public.${normalizedTable}'`) ||
    message.includes(`could not find the table '${normalizedTable}'`) ||
    message.includes(`relation "public.${normalizedTable}" does not exist`) ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    message.includes('schema cache')
  );
}

function readJsonBody(req) {
  if (!req || typeof req.on !== 'function') {
    return Promise.resolve(null);
  }

  if (req[JSON_BODY_PROMISE]) {
    return req[JSON_BODY_PROMISE];
  }

  req[JSON_BODY_PROMISE] = new Promise((resolve, reject) => {
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
      resolve(null);
      return;
    }

    // [LOG_ID: 20260727_1225] 첨부파일(AttachmentRepositoryShared.js maxBytes=1MB)은 이 JSON 본문
    // 안에 base64로 인코딩되어 실려 온다 — base64는 원본보다 ~33% 커지므로, 원본 1MB 파일은
    // 본문이 약 1.4MB가 되어 여기 1MB 상한에 먼저 걸려 첨부 자체의 "1024KB 이하" 안내보다
    // 훨씬 낮은 실효 한도(약 750KB)에서 알아보기 힘든 일반 "Request body too large" 오류로
    // 막혔다(첨부 업로드 UI 신설 중 실측 확인). base64 팽창 + JSON 오버헤드를 감안해
    // 첨부 상한(1MB)보다 넉넉히 위인 2MB로 올린다.
    const maxBytes = 2 * 1024 * 1024;
    let raw = '';
    let receivedBytes = 0;
    let settled = false;

    function cleanup() {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    }

    function settleSuccess(payload) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(payload);
    }

    function settleError(error, shouldDrain = false) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (shouldDrain) {
        req.on('data', () => {});
        req.resume?.();
      }
      reject(error);
    }

    function onData(chunk) {
      if (settled) {
        return;
      }
      const chunkText = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      receivedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunkText);
      if (receivedBytes > maxBytes) {
        raw = '';
        settleError(createError(413, 'Request body too large'), true);
        return;
      }
      raw += chunkText;
    }

    function onEnd() {
      if (settled) {
        return;
      }
      if (!raw) {
        settleSuccess(null);
        return;
      }

      try {
        settleSuccess(JSON.parse(raw));
      } catch (error) {
        settleError(createError(400, 'Invalid JSON body'));
      }
    }

    function onError(error) {
      settleError(error);
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });

  return req[JSON_BODY_PROMISE];
}

function streamFile(res, filePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf'
    }[ext] || 'text/plain; charset=utf-8';

    const headers = { 'Content-Type': mimeType };
    if (['.html', '.js', '.css'].includes(ext)) {
      // [LOG: 20260611_1540] Revalidate UI assets so prompt/cursor fixes are not hidden by stale browser cache.
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
}

function pickExistingFile(...candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) {
      return candidate;
    }
  }
  return '';
}

function safeResolve(basePath, requestPath) {
  const normalizedBasePath = String(basePath || '').trim() ? path.resolve(String(basePath)) : '';
  if (!normalizedBasePath) {
    return '';
  }
  // [LOG: 20260425_2031] Normalize the base path first so trailing separators do not break subtree checks.
  const relativePath = String(requestPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(normalizedBasePath, relativePath);
  // [LOG_ID: 20260721_1720] 윈도우 환경 드라이브 문자 대소문자 불일치(d:\ vs D:\) 방지를 위해 소문자화 후 매칭
  const lowerResolved = resolved.toLowerCase();
  const lowerBase = normalizedBasePath.toLowerCase();
  if (lowerResolved === lowerBase || lowerResolved.startsWith(`${lowerBase}${path.sep}`)) {
    return resolved;
  }
  return '';
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload).normalize('NFC'));
}

function sendApiResponse(res, statusCode, data, message = 'Success') {
  return new BbsResponse(res).status(statusCode).data(data).message(message).send();
}

function sendApiError(res, statusCode, message, error = null) {
  return BbsResponse.error(res, statusCode, message, error);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function buildCorsHeaders(origin, allowedOrigins) {
  const normalizedOrigin = String(origin || '').trim();
  const hasAllowlist = Array.isArray(allowedOrigins) && allowedOrigins.length > 0;
  const originHeader = hasAllowlist
    ? (allowedOrigins.includes(normalizedOrigin) ? normalizedOrigin : allowedOrigins[0])
    : '*';
  const headers = {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Article-Key, X-Article-Link, X-BBS-User-Id, X-BBS-Nick-Name, X-BBS-Level, X-BBS-Admin',
    'Access-Control-Max-Age': '86400'
  };
  if (hasAllowlist) {
    headers.Vary = 'Origin';
  }
  return headers;
}

function parseAllowedOrigins(envValue) {
  if (!envValue) return [];
  const seen = new Set();
  return String(envValue)
    .split(',')
    .map((s) => s.trim())
    .filter((origin) => {
      if (!origin || seen.has(origin)) {
        return false;
      }
      seen.add(origin);
      return true;
    });
}

const NICK_MIN = 2;
const NICK_MAX = 20;

function validateNickName(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length < NICK_MIN) {
    throw createError(400, `닉네임은 ${NICK_MIN}자 이상이어야 합니다.`);
  }
  if (trimmed.length > NICK_MAX) {
    throw createError(400, `닉네임은 ${NICK_MAX}자 이하여야 합니다.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw createError(400, '닉네임에 허용되지 않는 문자가 포함되어 있습니다.');
  }
  return trimmed;
}

function validateEmail(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw createError(400, '이메일 형식이 올바르지 않습니다.');
  }
  if (trimmed.length > 254) {
    throw createError(400, '이메일 주소가 너무 깁니다.');
  }
  return trimmed.toLowerCase();
}

module.exports = {
  buildCorsHeaders,
  createError,
  createHttpError,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  isMissingTableError,
  maybeUuid,
  normalizeMultilineText,
  normalizeText,
  parseAllowedOrigins,
  pickExistingFile,
  readJsonBody,
  safeResolve,
  sendApiResponse,
  sendApiError,
  sendJson,
  sendText,
  streamFile,
  stripControlCharacters,
  validateEmail,
  validateNickName
};
