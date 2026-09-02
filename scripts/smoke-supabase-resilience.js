'use strict';

const { createSupabaseFetch, resolveTimeout } = require('../src/server/createSupabaseClient');
const BaseRepository = require('../src/server/BaseRepository');
const { RepositoryRegistry } = (() => {
  const Registry = require('../src/server/RepositoryRegistry');
  return { RepositoryRegistry: Registry };
})();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectRejected(promise, predicate, message) {
  try {
    await promise;
  } catch (error) {
    assert(predicate(error), `${message}: ${error?.message || error}`);
    return error;
  }
  throw new Error(`${message}: promise resolved unexpectedly`);
}

async function main() {
  assert(resolveTimeout(1) === 500, 'Supabase timeout should have a safe minimum');
  assert(resolveTimeout(999999) === 60000, 'Supabase timeout should be capped');

  const timeoutFetch = createSupabaseFetch({
    timeoutMs: 500,
    fetch: (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted by timeout');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    })
  });
  const timeoutError = await expectRejected(
    timeoutFetch('https://example.invalid'),
    (error) => error.code === 'SUPABASE_TIMEOUT' && error.status === 504,
    'Supabase timeout classification failed'
  );
  assert(timeoutError.retryable === true, 'Supabase timeout should be marked retryable for read recovery');

  const externalController = new AbortController();
  const externalFetch = createSupabaseFetch({
    timeoutMs: 1000,
    fetch: (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted by caller');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    })
  });
  const externalPromise = externalFetch('https://example.invalid', { signal: externalController.signal });
  externalController.abort();
  await expectRejected(
    externalPromise,
    (error) => error.name === 'AbortError' && error.code !== 'SUPABASE_TIMEOUT',
    'caller cancellation should not be relabelled as a Supabase timeout'
  );

  const repo = new BaseRepository({ driverName: 'supabase', logger: { error() {} } });
  await expectRejected(
    Promise.resolve().then(() => repo._throwError('조회', { code: 'SUPABASE_TIMEOUT', name: 'SupabaseTimeoutError' })),
    (error) => error.status === 504 && /시간이 초과/.test(error.message),
    'repository timeout mapping failed'
  );
  await expectRejected(
    Promise.resolve().then(() => repo._throwError('조회', Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' }))),
    (error) => error.status === 503 && /통신망/.test(error.message),
    'repository network mapping failed'
  );
  await expectRejected(
    Promise.resolve().then(() => repo._throwError('저장', Object.assign(new Error('rate limited'), { status: 429 }))),
    (error) => error.status === 429 && /너무 많습니다/.test(error.message),
    'repository rate-limit mapping failed'
  );

  const registry = new RepositoryRegistry({ HEALTH_CHECK_TIMEOUT_MS: '500' });
  registry.repositories = new Map([
    ['slow', { checkHealth: () => new Promise(() => {}) }]
  ]);
  const healthStartedAt = Date.now();
  const health = await registry.checkAllHealth();
  const healthElapsed = Date.now() - healthStartedAt;
  assert(health.slow.status === 'timeout', 'repository health timeout should be explicit');
  assert(health.slow.errorClass === 'timeout', 'repository health timeout should expose its class');
  assert(health.slow.latencyMs >= 450 && healthElapsed < 2000, 'repository health timeout should be bounded');

  console.log(JSON.stringify({
    ok: true,
    scenarios: 7,
    timeoutStatus: timeoutError.status,
    healthTimeoutMs: health.slow.latencyMs
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
