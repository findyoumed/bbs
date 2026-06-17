// [LOG: 20260425_1915] API error object, retry, timeout, and default throw behavior.
// [LOG: 20260617_1005] Helper logic moved to apiFetchHelpers.js; public exports stay compatible.
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

function createBaseHeaders(state, fetchOptions) {
  const baseHeaders = { Accept: 'application/json' };
  if (fetchOptions.body !== undefined && !isFormDataBody(fetchOptions.body)) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (state.token) {
    baseHeaders['Authorization'] = `Bearer ${state.token}`;
  } else if (state.user && !state.user.isGuest) {
    baseHeaders['X-BBS-User-Id'] = String(state.user.userId || '');
    baseHeaders['X-BBS-Nick-Name'] = String(state.user.nickName || state.user.userId || '');
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
  console.error('API 오류:', path, error.message);

  if (logger) {
    logger.error(`${logPrefix}: ${method} ${path}`, error.toJSON());
  }
  if (!silent && onGlobalError) {
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
              console.warn(`API 재시도 중 (${attempt}/${maxAttempts - 1}): ${path}`, error.message);
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
            console.warn(`API 재시도 중 (${attempt}/${maxAttempts - 1}): ${path}`, error.message);
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
  apiFetch.clearLastError = () => {
    state.lastApiError = null;
  };

  return { apiFetch };
}
