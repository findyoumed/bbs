'use strict';

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_TIMEOUT_MS = 60000;

function resolveTimeout(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(500, Math.floor(numeric)));
}

function createTimeoutError(timeoutMs) {
  const error = new Error(`Supabase request timed out after ${timeoutMs}ms`);
  error.name = 'SupabaseTimeoutError';
  error.code = 'SUPABASE_TIMEOUT';
  error.status = 504;
  error.retryable = true;
  return error;
}

function createSupabaseFetch(options = {}) {
  const timeoutMs = resolveTimeout(options.timeoutMs ?? options.env?.SUPABASE_REQUEST_TIMEOUT_MS);
  const baseFetch = options.fetch || globalThis.fetch;
  if (typeof baseFetch !== 'function') {
    throw new Error('Global fetch is unavailable for Supabase client');
  }

  return async function supabaseFetch(input, init = {}) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    let timedOut = false;
    let timer = null;

    const abortFromExternal = () => controller.abort();
    if (externalSignal?.aborted) {
      controller.abort();
    } else if (externalSignal && typeof externalSignal.addEventListener === 'function') {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }

    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw createTimeoutError(timeoutMs);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', abortFromExternal);
    }
  };
}

function createSupabaseClient(options = {}) {
  const customFetch = createSupabaseFetch(options);
  return createClient(options.url, options.serviceRoleKey || options.key, {
    auth: { persistSession: false },
    global: { fetch: customFetch }
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  createSupabaseClient,
  createSupabaseFetch,
  createTimeoutError,
  resolveTimeout
};
