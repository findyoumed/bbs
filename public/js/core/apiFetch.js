// [LOG: 20260425_1915] API 에러 객체화, 재시도 로직 개선(지수 백오프/지터), 타임아웃(AbortController) 및 기본 throw 동작 추가
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_RETRY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 5000;
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * API 요청 중 발생하는 오류를 정의하는 클래스
 */
export class ApiError extends Error {
  constructor(info) {
    super(info.message || 'API 요청 실패');
    this.name = 'ApiError';
    this.ok = false;
    this.type = info.type || 'unknown'; // 'server', 'network', 'parse', 'timeout'
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

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isFormDataBody(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function shouldTreatAsJson(contentType = '') {
  return /(^|\/|\+)json\b/i.test(String(contentType || ''));
}

function normalizeRetryCount(retryValue, method) {
  if (retryValue === true) return 2; 
  if (retryValue === false) return 0;
  if (isFiniteNumber(retryValue)) return Math.max(0, Number(retryValue));
  return SAFE_RETRY_METHODS.has(method) ? 1 : 0;
}

function normalizeRetryStatuses(value) {
  if (!Array.isArray(value) || !value.length) {
    return DEFAULT_RETRY_STATUS_CODES;
  }
  return new Set(
    value
      .map((status) => Number(status))
      .filter((status) => Number.isInteger(status) && status > 0)
  );
}

function pickErrorMessage(payload, fallbackMessage) {
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

function waitWithBackoff(attempt, baseDelayMs) {
  if (attempt <= 0) return Promise.resolve();
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = exponentialDelay * 0.5 * Math.random();
  const finalDelay = Math.min(DEFAULT_MAX_RETRY_DELAY_MS, exponentialDelay + jitter);
  return new Promise((resolve) => setTimeout(resolve, finalDelay));
}

function createParseError(message, rawText) {
  const error = new Error(message);
  error.name = 'ApiParseError';
  error.rawText = rawText;
  return error;
}

async function readResponsePayload(res) {
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

/**
 * [LOG: 20260426_1420] Human-friendly error message resolver for BBS
 */
function translateErrorMessage(error) {
  if (error.type === 'timeout') return '데이터 응답 지연 - 잠시 후 다시 시도해 주세요.';
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

export function createApiFetch(deps) {
  const { state, onActivity, onGlobalError, onLatency, logger, performanceService } = deps;

  async function apiFetch(path, options = {}) {
    const startTime = performance.now();
    const {
      retry,
      retryDelayMs,
      retryOnStatus,
      timeout = DEFAULT_TIMEOUT_MS,
      throwOnError = true,
      silent = false, // [LOG: 20260426_2010] Added silent option to suppress global error UI
      ...fetchOptions
    } = options || {};

    const method = String(fetchOptions.method || 'GET').trim().toUpperCase() || 'GET';
    
    if (logger) {
      logger.info(`API Request: ${method} ${path}`, { method, path, retry });
    }

    const maxAttempts = normalizeRetryCount(retry, method) + 1;
    const retryStatuses = normalizeRetryStatuses(retryOnStatus);
    const delayBaseMs = isFiniteNumber(retryDelayMs) ? Math.max(0, Number(retryDelayMs)) : DEFAULT_RETRY_DELAY_MS;
    
    const baseHeaders = { Accept: 'application/json' };
    if (fetchOptions.body !== undefined && !isFormDataBody(fetchOptions.body)) {
      baseHeaders['Content-Type'] = 'application/json';
    }
    if (state.token) {
      baseHeaders['Authorization'] = `Bearer ${state.token}`;
    } else if (state.user && !state.user.isGuest) {
      // [LOG: 20260507_1712] Local PC통신-style sessions do not always have a Supabase token.
      // The server accepts these headers only for loopback non-production requests.
      baseHeaders['X-BBS-User-Id'] = String(state.user.userId || '');
      baseHeaders['X-BBS-Nick-Name'] = String(state.user.nickName || state.user.userId || '');
      baseHeaders['X-BBS-Level'] = String(state.user.level || 1);
      if (state.user.isAdmin) {
        baseHeaders['X-BBS-Admin'] = '1';
      }
    }

    state.lastApiError = null;
    if (onActivity) onActivity(true);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let timeoutId = null;
        const controller = new AbortController();
        
        try {
          if (timeout > 0) {
            timeoutId = setTimeout(() => controller.abort(), timeout);
          }

          const res = await fetch(path, {
            ...fetchOptions,
            method,
            headers: { ...baseHeaders, ...(fetchOptions.headers || {}) },
            signal: controller.signal,
          });
          
          if (timeoutId) clearTimeout(timeoutId);

          const payload = await readResponsePayload(res);

          if (!res.ok) {
            const isRetryableStatus = retryStatuses.has(Number(res.status) || 0);
            const shouldRetry = attempt < maxAttempts && isRetryableStatus;

            const error = new ApiError({
              path,
              method,
              status: Number(res.status) || 0,
              payload,
              message: pickErrorMessage(payload, `서버 오류 ${res.status}`),
              type: 'server',
              attempt,
              maxAttempts,
              retryable: shouldRetry,
            });

            if (shouldRetry) {
              console.warn(`API 재시도 중 (${attempt}/${maxAttempts - 1}): ${path}`, error.message);
              await waitWithBackoff(attempt, delayBaseMs);
              continue;
            }

            error.message = translateErrorMessage(error);
            state.lastApiError = error;
            console.error('API 오류:', path, error.message);
            
            if (logger) {
              logger.error(`API Error: ${method} ${path} (${res.status})`, error.toJSON());
            }

            // [LOG: 20260426_2015] Notify global error handler if not silent
            if (!silent && onGlobalError) onGlobalError(error);

            if (throwOnError) throw error;
            return error;
          }

          state.lastApiError = null;

          // [LOG: 20260425_2145] Unpack data from standard API envelope if present
          if (payload && typeof payload === 'object' && payload.success === true && payload.data !== undefined) {
            return payload.data;
          }

          return payload;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);

          if (err instanceof ApiError) {
            if (err.retryable && attempt < maxAttempts) {
              await waitWithBackoff(attempt, delayBaseMs);
              continue;
            }
            err.message = translateErrorMessage(err);
            state.lastApiError = err;
            
            if (!silent && onGlobalError) onGlobalError(err);
            
            if (throwOnError) throw err;
            return err;
          }

          const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
          const isParseError = err?.name === 'ApiParseError';
          const shouldRetry = !isParseError && attempt < maxAttempts;

          const error = new ApiError({
            path,
            method,
            payload: isParseError ? err.rawText || null : null,
            message: isTimeout ? '요청 시간이 초과되었습니다.' : (err?.message || '네트워크 오류'),
            type: isTimeout ? 'timeout' : (isParseError ? 'parse' : 'network'),
            attempt,
            maxAttempts,
            retryable: shouldRetry,
          });

          if (shouldRetry) {
            console.warn(`API 재시도 중 (${attempt}/${maxAttempts - 1}): ${path}`, error.message);
            await waitWithBackoff(attempt, delayBaseMs);
            continue;
          }

          error.message = translateErrorMessage(error);
          state.lastApiError = error;
          console.error('API 오류:', path, error.message);
          
          if (logger) {
            logger.error(`API Exception: ${method} ${path}`, error.toJSON());
          }

          if (!silent && onGlobalError) onGlobalError(error);

          if (throwOnError) throw error;
          return error;
        }
      }

      const finalError = new ApiError({
        path,
        method,
        message: '요청이 완료되지 않았습니다.',
        type: 'unknown',
        attempt: maxAttempts,
        maxAttempts
      });
      state.lastApiError = finalError;
      
      if (!silent && onGlobalError) onGlobalError(finalError);

      if (throwOnError) throw finalError;
      return finalError;
    } finally {
      if (onActivity) onActivity(false);
      const duration = Math.round(performance.now() - startTime);
      if (onLatency) {
        onLatency(duration);
      }
      if (performanceService) {
        performanceService.recordApiLatency(duration, path);
      }
    }
  }


  apiFetch.getLastError = () => state.lastApiError || null;
  apiFetch.clearLastError = () => {
    state.lastApiError = null;
  };

  return { apiFetch };
}
