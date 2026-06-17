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
      status: this.status,
      payload: this.payload,
      attempt: this.attempt,
      maxAttempts: this.maxAttempts,
      retryable: this.retryable,
      timestamp: this.timestamp
    };
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
  if (!rawText) {
    return null;
  }
  if (shouldTreatAsJson(res.headers?.get?.('content-type'))) {
    try {
      return JSON.parse(rawText);
    } catch (error) {
      throw createParseError(`응답 JSON 파싱 실패: ${error.message}`, rawText);
    }
  }
  return rawText;
}

export function translateErrorMessage(error) {
  if (error.type === 'timeout') return '요청 시간이 초과되었습니다.';
  if (error.type === 'network') return '데이터 통신망 오동작 - 네트워크 연결을 확인하세요.';
  if (error.type === 'parse') return '수신 데이터 처리 불가 - 시스템 관리자에게 문의하세요.';

  const status = error.status;
  if (status === 401) return '사용 권한이 없습니다. 로그인이 필요합니다.';
  if (status === 403) return '요청하신 작업에 대한 권한이 없습니다.';
  if (status === 404) return '요청하신 자료를 찾을 수 없습니다.';
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  if (status >= 500) return '시스템 내부 오류가 발생했습니다. (호스트 응답 없음)';

  return error.message;
}
