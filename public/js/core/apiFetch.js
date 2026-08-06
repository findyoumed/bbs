// [LOG: 20260425_1915] API error object, retry, timeout, and default throw behavior.
// [LOG: 20260617_1005] [LOG_ID: 20260804_1114] Helper logic moved to apiFetchHelpers.js; public exports stay compatible.
import {
  ApiError,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  isFiniteNumber,
  isFormDataBody,
  normalizeRetryCount,
  normalizeRetryStatuses,
  pickErrorMessage,
  readResponsePayload,
  translateErrorMessage,
  waitWithBackoff
} from './apiFetchHelpers.js';
export { ApiError };
// [LOG_ID: 20260727_0700] HTTP 헤더 값은 ISO-8859-1(Latin-1)만 허용된다 — 한글 닉네임을
// 그대로 X-BBS-Nick-Name에 넣으면 브라우저 fetch()가 "String contains non ISO-8859-1
// code point"로 그 호출 하나가 아니라 이후의 모든 API 요청에서 즉시 예외를 던진다(사용자
// 실측 재현: state.token이 비어 있고 state.user가 로그인 상태로 남는 순간 — 세션 갱신 경합
// 등으로 실제 발생 가능 — 이후 메뉴/게시판 로딩까지 전부 "데이터 통신망 오동작"으로 실패해
// 어떤 명령을 눌러도 화면이 전혀 안 바뀌는 것처럼 보였다). scripts/smoke-boards.js가 이미
// 같은 이유로 "헤더엔 body.userId만 미러링하고 한글 nickName은 헤더로 안 보낸다"고 명시한
// 것과 동일한 제약이다 — encodeURIComponent로 항상 ASCII-safe하게 만든다.
function toHeaderSafe(value) {
  const text = String(value ?? '');
  try {
    return encodeURIComponent(text);
  } catch (error) {
    return '';
  }
}

function createBaseHeaders(state, fetchOptions) {
  const baseHeaders = { Accept: 'application/json' };
  if (fetchOptions.body !== undefined && !isFormDataBody(fetchOptions.body)) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (state.token) {
    baseHeaders['Authorization'] = `Bearer ${state.token}`;
  } else if (state.user && !state.user.isGuest) {
    baseHeaders['X-BBS-User-Id'] = toHeaderSafe(state.user.userId);
    baseHeaders['X-BBS-Nick-Name'] = toHeaderSafe(state.user.nickName || state.user.userId);
    baseHeaders['X-BBS-Level'] = String(state.user.level || 1);
    if (state.user.isAdmin) {
      baseHeaders['X-BBS-Admin'] = '1';
    }
  }
  return baseHeaders;
}

function reportError(error, context) {
  const { state, silent, onGlobalError, logger, method, path, logPrefix } = context;
  const payloadMessage = error.payload && typeof error.payload === 'object' ? error.payload.message : null;
  if (!(error.type === 'server' && typeof payloadMessage === 'string' && payloadMessage.trim())) {
    error.message = translateErrorMessage(error);
  }
  state.lastApiError = error;

  // [LOG: 20260620_1200] silent 요청 시 콘솔/로거/전역 알림을 모두 억제한다.
  // 호출자가 직접 처리하는 예상된 에러(예: 불완전 뉴스 기사 404)의 노이즈를 없앤다.
  if (silent) {
    return;
  }

  // [LOG_ID: 20260806_1512] /* console.error('API 오류:', path, error.message); */
  if (logger) {
    logger.error(`${logPrefix}: ${method} ${path}`, error.toJSON());
  }
  if (onGlobalError) {
    onGlobalError(error);
  }
}

function createServerError({ path, method, status, payload, attempt, maxAttempts, retryable }) {
  return new ApiError({
    path,
    method,
    status: Number(status) || 0,
    payload,
    message: pickErrorMessage(payload, `서버 오류 ${status}`),
    type: 'server',
    attempt,
    maxAttempts,
    retryable
  });
}

function createNetworkError({ path, method, err, attempt, maxAttempts, retryable, type }) {
  const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
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

async function fetchWithTimeout(path, requestOptions, timeout, externalSignal = null) {
  let timeoutId = null;
  const controller = new AbortController();
  const abortFromExternalSignal = () => controller.abort();
  try {
    if (externalSignal?.aborted) {
      abortFromExternalSignal();
    } else if (externalSignal && typeof externalSignal.addEventListener === 'function') {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
    if (timeout > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }
    return await fetch(path, { ...requestOptions, signal: controller.signal });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (externalSignal && typeof externalSignal.removeEventListener === 'function') {
      externalSignal.removeEventListener('abort', abortFromExternalSignal);
    }
  }
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
      silent = false,
      ...fetchOptions
    } = options || {};

    const method = String(fetchOptions.method || 'GET').trim().toUpperCase() || 'GET';
    if (logger) {
      logger.info(`API Request: ${method} ${path}`, { method, path, retry });
    }

    const maxAttempts = normalizeRetryCount(retry, method) + 1;
    const retryStatuses = normalizeRetryStatuses(retryOnStatus);
    const delayBaseMs = isFiniteNumber(retryDelayMs) ? Math.max(0, Number(retryDelayMs)) : DEFAULT_RETRY_DELAY_MS;
    const baseHeaders = createBaseHeaders(state, fetchOptions);

    state.lastApiError = null;
    if (onActivity) onActivity(true);

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const res = await fetchWithTimeout(path, {
            cache: fetchOptions.cache || 'no-cache',
            ...fetchOptions,
            method,
            headers: { ...baseHeaders, ...(fetchOptions.headers || {}) }
          }, timeout, fetchOptions.signal || state._commandAbortController?.signal || null);
          const payload = await readResponsePayload(res);

          if (!res.ok) {
            const shouldRetry = attempt < maxAttempts && retryStatuses.has(Number(res.status) || 0);
            const error = createServerError({
              path,
              method,
              status: res.status,
              payload,
              attempt,
              maxAttempts,
              retryable: shouldRetry
            });

            if (shouldRetry) {
              // [LOG_ID: 20260806_1512] /* console.warn(`API 재시도 중...`); */
              await waitWithBackoff(attempt, delayBaseMs);
              continue;
            }

            reportError(error, { state, silent, onGlobalError, logger, method, path, logPrefix: `API Error (${res.status})` });
            if (throwOnError) throw error;
            return error;
          }

          state.lastApiError = null;
          if (payload && typeof payload === 'object' && payload.success === true && payload.data !== undefined) {
            return payload.data;
          }
          return payload;
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.retryable && attempt < maxAttempts) {
              await waitWithBackoff(attempt, delayBaseMs);
              continue;
            }
            reportError(err, { state, silent, onGlobalError, logger, method, path, logPrefix: 'API Error' });
            if (throwOnError) throw err;
            return err;
          }

          const isParseError = err?.name === 'ApiParseError';
          const isCommandCancel = err?.name === 'AbortError' && state._commandCancelActive === true;
          if (isCommandCancel) {
            throw createNetworkError({ path, method, err, attempt, maxAttempts, retryable: false, type: 'cancelled' });
          }
          const shouldRetry = !isParseError && attempt < maxAttempts;
          const error = createNetworkError({ path, method, err, attempt, maxAttempts, retryable: shouldRetry });

          if (shouldRetry) {
            // [LOG_ID: 20260806_1512] /* console.warn(`API 재시도 중...`); */
            await waitWithBackoff(attempt, delayBaseMs);
            continue;
          }

          reportError(error, { state, silent, onGlobalError, logger, method, path, logPrefix: 'API Exception' });
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
      if (onLatency) onLatency(duration);
      if (performanceService) performanceService.recordApiLatency(duration, path);
    }
  }

  apiFetch.getLastError = () => state.lastApiError || null;
  apiFetch.clearLastError = () => { state.lastApiError = null; };

  return { apiFetch };
}
