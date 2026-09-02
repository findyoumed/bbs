// [LOG: 20260617_1005] Shared helpers split from apiFetch.js for QA line limits.
export const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const DEFAULT_RETRY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
export const DEFAULT_RETRY_DELAY_MS = 250;
export const DEFAULT_MAX_RETRY_DELAY_MS = 5000;
export const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(info) {
    super(info.message || 'API 요청 실패');
    this.name = 'ApiError';
    this.ok = false;
    this.type = info.type || 'unknown';
    this.path = info.path;
    this.method = info.method;
    this.requestId = info.requestId || '';
    this.status = info.status || 0;
    this.payload = info.payload || null;
    this.attempt = info.attempt || 1;
    this.maxAttempts = info.maxAttempts || 1;
    this.retryable = !!info.retryable;
    this.timestamp = info.timestamp || new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON() {
    return {
      ok: this.ok,
      name: this.name,
      type: this.type,
      message: this.message,
      path: this.path,
      method: this.method,
      requestId: this.requestId,
      status: this.status,
      payload: this.payload,
      attempt: this.attempt,
      maxAttempts: this.maxAttempts,
      retryable: this.retryable,
      timestamp: this.timestamp
    };
  }
}

export function createServerError({ path, method, status, payload, requestId, attempt, maxAttempts, retryable }) {
  return new ApiError({
    path,
    method,
    requestId,
    status: Number(status) || 0,
    payload,
    message: pickErrorMessage(payload, `서버 오류 ${status}`),
    type: 'server',
    attempt,
    maxAttempts,
    retryable
  });
}

export function createNetworkError({ path, method, err, attempt, maxAttempts, retryable, type }) {
  const isTimeout = err?._requestTimedOut === true || err?.message?.includes('timeout');
  const isParseError = err?.name === 'ApiParseError';
  return new ApiError({
    path,
    method,
    payload: isParseError ? err.rawText || null : null,
    message: isTimeout ? '요청 시간이 초과되었습니다.' : (err?.message || '네트워크 오류'),
    type: type || (isTimeout ? 'timeout' : (isParseError ? 'parse' : 'network')),
    attempt,
    maxAttempts,
    retryable
  });
}

export async function fetchWithTimeout(path, requestOptions, timeout, externalSignal = null) {
  let timeoutId = null;
  let timedOut = false;
  const controller = new AbortController();
  const abortFromExternalSignal = () => controller.abort();
  try {
    if (externalSignal?.aborted) {
      abortFromExternalSignal();
    } else if (externalSignal && typeof externalSignal.addEventListener === 'function') {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }
    return await fetch(path, { ...requestOptions, signal: controller.signal });
  } catch (error) {
    if (timedOut && error && typeof error === 'object') {
      error._requestTimedOut = true;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    externalSignal?.removeEventListener?.('abort', abortFromExternalSignal);
  }
}

export function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

export function isFormDataBody(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

export function shouldTreatAsJson(contentType = '') {
  return /(^|\/|\+)json\b/i.test(String(contentType || ''));
}

export function normalizeRetryCount(retryValue, method) {
  if (retryValue === true) return 2;
  if (retryValue === false) return 0;
  if (isFiniteNumber(retryValue)) return Math.max(0, Number(retryValue));
  return SAFE_RETRY_METHODS.has(method) ? 1 : 0;
}

export function normalizeRetryStatuses(value) {
  if (!Array.isArray(value) || !value.length) {
    return DEFAULT_RETRY_STATUS_CODES;
  }
  return new Set(
    value
      .map((status) => Number(status))
      .filter((status) => Number.isInteger(status) && status > 0)
  );
}

export function pickErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === 'object') {
    const candidate = payload.message || payload.error || payload.detail;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim().slice(0, 200);
  }
  return fallbackMessage;
}

export function waitWithBackoff(attempt, baseDelayMs) {
  if (attempt <= 0) return Promise.resolve();
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = exponentialDelay * 0.5 * Math.random();
  const finalDelay = Math.min(DEFAULT_MAX_RETRY_DELAY_MS, exponentialDelay + jitter);
  return new Promise((resolve) => setTimeout(resolve, finalDelay));
}

export function createParseError(message, rawText) {
  const error = new Error(message);
  error.name = 'ApiParseError';
  error.rawText = rawText;
  return error;
}

export async function readResponsePayload(res) {
  if (res.status === 204 || res.status === 205) {
    return null;
  }
  const rawText = await res.text();
  if (!rawText || !rawText.trim()) {
    return null;
  }
  if (shouldTreatAsJson(res.headers?.get?.('content-type'))) {
    try {
      return JSON.parse(rawText);
    } catch (error) {
      // [LOG_ID: 20260807_1648] 빈 응답/잘린 응답으로 인한 Unexpected end of input 시 파싱 에러 생성
      throw createParseError(`수신 데이터 형식 오류 (JSON 파싱 실패)`, rawText);
    }
  }
  return rawText;
}

export function translateErrorMessage(error) {
  if (error.type === 'timeout') return '요청 시간이 초과되었습니다.';
  if (error.type === 'network') return '데이터 통신망 오동작 - 네트워크 연결을 확인하세요.';
  if (error.type === 'parse' || error.message?.includes('Unexpected end of input') || error.message?.includes('JSON')) {
    return '수신 데이터 처리 불가 - 응답 형식 오류입니다.';
  }

  const status = error.status;
  if (status === 401) return '사용 권한이 없습니다. 로그인이 필요합니다.';
  if (status === 403) return '요청하신 작업에 대한 권한이 없습니다.';
  if (status === 408 || status === 425 || status === 502 || status === 503 || status === 504) {
    return '서비스 응답이 지연되었습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (status === 409) return '요청이 이미 처리되었거나 충돌했습니다. 화면을 새로 확인해 주세요.';
  if (status === 404) return '요청하신 자료를 찾을 수 없습니다.';
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '시스템 내부 오류가 발생했습니다. (호스트 응답 없음)';

  return error.message;
}
