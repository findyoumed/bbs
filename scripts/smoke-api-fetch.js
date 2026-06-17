'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

function makeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[String(key).toLowerCase()] = value;
  }
  return {
    get(name) {
      return normalized[String(name || '').toLowerCase()] || null;
    }
  };
}

function makeResponse(status, payload, headers = {}) {
  const isStringPayload = typeof payload === 'string';
  const bodyText = payload == null ? '' : (isStringPayload ? payload : JSON.stringify(payload));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: makeHeaders(headers),
    async text() {
      return bodyText;
    }
  };
}

async function loadBrowserModule(relPath) {
  const root = path.resolve(__dirname, '..');
  const absPath = path.join(root, relPath);
  const helperPath = path.join(root, 'public/js/core/apiFetchHelpers.js');
  const helperSource = fs.readFileSync(helperPath, 'utf-8')
    .replace(/\bexport\s+class\s+/g, 'class ')
    .replace(/\bexport\s+const\s+/g, 'const ')
    .replace(/\bexport\s+function\s+/g, 'function ');
  const source = fs.readFileSync(absPath, 'utf-8')
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]\.\/apiFetchHelpers\.js['"];\s*/, '');
  // [LOG: 20260617_1005] Inline helper source so the data URL loader supports split ESM modules.
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(`${helperSource}\n${source}`, 'utf-8').toString('base64')}`;
  return import(moduleUrl);
}

async function main() {
  const { createApiFetch, ApiError } = await loadBrowserModule('public/js/core/apiFetch.js');
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const capturedErrors = [];
  console.error = (...args) => {
    capturedErrors.push(args.map((value) => String(value)).join(' '));
  };

  try {
    {
      const state = { token: 'abc-token' };
      let callCount = 0;
      global.fetch = async (_path, options) => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('temporary network down');
        }
        assert(options.headers.Authorization === 'Bearer abc-token', 'Authorization header should include the state token');
        return makeResponse(200, { ok: true, items: [1] }, { 'content-type': 'application/json; charset=utf-8' });
      };

      const { apiFetch } = createApiFetch({ state });
      const payload = await apiFetch('/api/retry-check', { retryDelayMs: 0 });

      assert(callCount === 2, 'GET requests should retry once after a transient network failure');
      assert(payload?.ok === true, 'successful retry should return the parsed JSON payload');
      assert(apiFetch.getLastError() === null, 'successful retry should clear the last API error');
    }

    {
      const state = {};
      let callCount = 0;
      global.fetch = async () => {
        callCount += 1;
        throw new Error('write failed');
      };

      const { apiFetch } = createApiFetch({ state });
      
      let errorInfo = null;
      try {
        await apiFetch('/api/write-check', {
          method: 'POST',
          body: JSON.stringify({ title: 'test' }),
          retryDelayMs: 0
        });
      } catch (err) {
        errorInfo = err;
      }

      assert(callCount === 1, 'POST requests should not auto-retry by default');
      assert(errorInfo instanceof Error, 'should throw an error object by default');
      assert(errorInfo.ok === false, 'error object should have ok: false');
      assert(apiFetch.getLastError()?.type === 'network', 'failed POST should expose structured network error metadata');
      assert(apiFetch.getLastError()?.method === 'POST', 'failed POST should record the request method');
    }

    {
      const state = {};
      let callCount = 0;
      global.fetch = async () => {
        callCount += 1;
        return makeResponse(503, { message: '점검 중입니다.' }, { 'content-type': 'application/json' });
      };

      const { apiFetch } = createApiFetch({ state });
      
      let errorInfo = null;
      try {
        await apiFetch('/api/error-object', {
          retry: 0,
          retryDelayMs: 0
        });
      } catch (err) {
        errorInfo = err;
      }

      assert(callCount === 1, 'explicit retry:0 should skip automatic retries');
      assert(errorInfo?.ok === false, 'should throw a structured error object by default');
      assert(errorInfo instanceof Error, 'should be an instance of Error');
      assert(errorInfo?.type === 'server', 'server failures should be tagged as server errors');
      assert(errorInfo?.status === 503, 'server failures should include the HTTP status');
      assert(errorInfo?.message === '점검 중입니다.', 'server error payload message should be surfaced');
    }

    // throwOnError: false option test
    {
      const state = {};
      global.fetch = async () => makeResponse(404, { message: 'not found' }, { 'content-type': 'application/json' });
      const { apiFetch } = createApiFetch({ state });
      
      const result = await apiFetch('/api/not-found', { throwOnError: false });
      assert(result instanceof Error, 'should return error object when throwOnError is false');
      assert(result.status === 404, 'returned error should have correct status');
    }

    // timeout test
    {
      const state = {};
      global.fetch = async (_path, options) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(makeResponse(200, { ok: true })), 100);
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              const err = new Error('The user aborted a request.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      };

      const { apiFetch } = createApiFetch({ state });
      let errorInfo = null;
      try {
        await apiFetch('/api/timeout', { timeout: 10, retry: 0 });
      } catch (err) {
        errorInfo = err;
      }
      assert(errorInfo?.type === 'timeout', 'should detect timeout via AbortController');
      assert(errorInfo?.message === '요청 시간이 초과되었습니다.', 'should have timeout message');
    }

    console.log(JSON.stringify({
      ok: true,
      scenarios: 5,
      capturedErrorLogs: capturedErrors.length
    }, null, 2));
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
