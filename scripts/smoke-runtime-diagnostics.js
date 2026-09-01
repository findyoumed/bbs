'use strict';

const http = require('http');
const path = require('path');
const { assert } = require('./lib/scriptUtils');
const { createAppRuntime } = require('../src/server/createAppRuntime');

function assertThrows(factory, pattern, message) {
  try {
    factory();
  } catch (error) {
    if (!pattern.test(String(error.message || ''))) {
      throw new Error(`${message}: ${error.message || error}`);
    }
    return error;
  }
  throw new Error(message);
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(baseUrl + pathname, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname} -> ${JSON.stringify(payload)}`);
  }
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

// [LOG_ID: 20260725_1900] /api/system/info가 ensureAdmin으로 잠기면서(20260721_0400 보안 수정)
// 익명 fetch가 403을 받아 이 스모크가 통째로 깨져 있었다 — 보안 수정 당시 이 스크립트 갱신이
// 누락된 것. 개발환경 루프백에서만 허용되는 수동 신원 헤더(RequestIdentityHelpers의
// allowManualRequestIdentity)로 관리자 컨텍스트를 만들어 호출한다.
const ADMIN_HEADERS = {
  'x-bbs-user-id': 'smoke-diagnostics-admin',
  'x-bbs-nick-name': 'smoke-admin',
  'x-bbs-admin': '1'
};

async function expectForbidden(baseUrl, pathname) {
  const response = await fetch(baseUrl + pathname);
  if (response.status !== 403) {
    throw new Error(`anonymous ${pathname} should be 403 (got ${response.status})`);
  }
}

async function withServer(requestHandler, callback) {
  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');

  const invalidSupabaseError = assertThrows(
    () => createAppRuntime({
      rootDir,
      env: { BOARD_REPOSITORY_DRIVER: 'supabase' },
      loadEnvFile: false
    }),
    /SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/,
    'explicit supabase driver should fail without core supabase config'
  );

  const invalidDriverError = assertThrows(
    () => createAppRuntime({
      rootDir,
      env: { CHAT_ROOM_REPOSITORY_DRIVER: 'bogus' },
      loadEnvFile: false
    }),
    /CHAT_ROOM_REPOSITORY_DRIVER/,
    'invalid chat room driver should fail fast'
  );

  const invalidCredentialError = assertThrows(
    () => createAppRuntime({
      rootDir,
      env: {
        BOARD_REPOSITORY_DRIVER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_wrong_slot'
      },
      loadEnvFile: false
    }),
    /publishable|anon|service-role/i,
    'publishable key in the service-role slot should fail fast'
  );

  const legacyAnonJwt = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'),
    'signature'
  ].join('.');
  assertThrows(
    () => createAppRuntime({
      rootDir,
      env: {
        BOARD_REPOSITORY_DRIVER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: legacyAnonJwt
      },
      loadEnvFile: false
    }),
    /publishable|anon|service-role/i,
    'legacy anon JWT in the service-role slot should fail fast'
  );

  const runtime = createAppRuntime({
    rootDir,
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_only_smoke'
    },
    loadEnvFile: false
  });

  assert(runtime.boardRepository.getMeta().driver === 'memory', 'partial supabase config should keep board repository in memory');
  assert(runtime.chatRoomRepository.getMeta().driver === 'memory', 'partial supabase config should keep chat room repository in memory');
  assert(runtime.repositoryDiagnostics.hasPartialSupabaseConfig === true, 'partial supabase config should be reported');
  assert(runtime.repositoryDiagnostics.warnings.length > 0, 'partial supabase config should emit warnings');
  assert(runtime.repositoryDiagnostics.hasSupabaseConfig === false, 'publishable-only config must not enable server supabase repositories');

  const systemInfo = await withServer(runtime.requestHandler, async (baseUrl) => {
    // 보안 동작 자체도 함께 잠근다: 익명 요청은 403이어야 한다(20260721_0400).
    await expectForbidden(baseUrl, '/api/system/info');
    return requestJson(baseUrl, '/api/system/info', { headers: ADMIN_HEADERS });
  });

  const guestProfile = await withServer(runtime.requestHandler, async (baseUrl) => (
    requestJson(baseUrl, '/api/members/guest')
  ));
  assert(guestProfile.userId === 'guest', 'guest profile should resolve without a repository lookup');

  const health = await withServer(runtime.requestHandler, async (baseUrl) => (
    requestJson(baseUrl, '/api/health')
  ));
  assert(health.status === 'healthy', 'health probe should report a healthy runtime');
  assert(health.services?.database?.memberProbe === 'ok', 'health probe should include the member repository result');

  assert(systemInfo.requestedRepositoryMode === 'auto(memory)', 'system info should expose auto(memory) mode for partial config');
  assert(systemInfo.supabaseReady === false, 'system info should report supabaseReady=false for partial config');
  assert(systemInfo.supabasePartialConfig === true, 'system info should report partial supabase config');
  assert(systemInfo.repositoryDrivers.board === 'memory', 'system info should expose memory board driver');
  assert(systemInfo.repositoryDrivers.chatRooms === 'memory', 'system info should expose memory chat room driver');
  assert(Array.isArray(systemInfo.repositoryWarnings) && systemInfo.repositoryWarnings.length > 0, 'system info should surface repository warnings');

  console.log(JSON.stringify({
    ok: true,
    invalidSupabaseError: invalidSupabaseError.code || 'error',
    invalidDriverError: invalidDriverError.code || 'error',
    invalidCredentialError: invalidCredentialError.code || 'error',
    partialWarningCount: runtime.repositoryDiagnostics.warnings.length,
    requestedRepositoryMode: systemInfo.requestedRepositoryMode,
    boardDriver: systemInfo.repositoryDrivers.board,
    chatRoomDriver: systemInfo.repositoryDrivers.chatRooms,
    guestProfile: guestProfile.userId,
    healthStatus: health.status,
    memberProbe: health.services.database.memberProbe
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
