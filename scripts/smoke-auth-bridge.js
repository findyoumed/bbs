'use strict';

// [LOG: 20260619_1230] package.json의 "smoke:auth-bridge"가 존재하지 않는 파일을 참조해
// 실행 즉시 "Cannot find module"로 깨져 있었다. (CLAUDE.md도 이 명령을 도메인 테스트로 문서화)
// smoke-rss-services가 fakeFetch를 쓰듯, 여기서는 mock Supabase admin client로 AuthBridge의
// 인증 동기화 로직을 라이브 연결 없이 결정적으로 검증한다.

const assert = require('assert');
const {
  extractAuthMemberUserId,
  findAuthUser,
  resolveAuthUser,
  syncMemberAuthProfile,
  throwAdminError
} = require('../src/server/AuthBridgeSync');
const { createBridgeError, normalizeAuthEmail } = require('../src/server/AuthBridgeUtils');

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

let checks = 0;
function check(label, condition) {
  if (!condition) {
    throw new Error(`auth-bridge smoke failed: ${label}`);
  }
  checks += 1;
}

function makeUser(overrides = {}) {
  return {
    id: overrides.id || VALID_UUID,
    email: overrides.email || '',
    user_metadata: overrides.user_metadata || {},
    ...overrides
  };
}

// perPage(200, AuthBridgeSync 내부 고정값)에 따라 페이지를 잘라 돌려주는 in-memory admin client.
function makeMockClient(users) {
  const calls = { listUsers: 0, getUserById: 0, updateUserById: 0 };
  return {
    calls,
    auth: {
      admin: {
        async listUsers({ page = 1, perPage = 200 } = {}) {
          calls.listUsers += 1;
          const start = (page - 1) * perPage;
          const slice = users.slice(start, start + perPage);
          const lastPage = Math.max(1, Math.ceil(users.length / perPage));
          return { data: { users: slice, lastPage }, error: null };
        },
        async getUserById(id) {
          calls.getUserById += 1;
          const user = users.find((u) => u.id === id) || null;
          return { data: { user }, error: null };
        },
        async updateUserById(id, attrs) {
          calls.updateUserById += 1;
          const user = users.find((u) => u.id === id);
          if (!user) {
            return { data: { user: null }, error: { message: 'not found' } };
          }
          if (attrs.email) user.email = attrs.email;
          if (attrs.user_metadata) {
            user.user_metadata = { ...user.user_metadata, ...attrs.user_metadata };
          }
          return { data: { user }, error: null };
        }
      }
    }
  };
}

function expectStatus(label, fn, status) {
  let actual = null;
  try {
    fn();
  } catch (error) {
    actual = error.status;
  }
  check(`${label} -> status ${status} (got ${actual})`, actual === status);
}

async function main() {
  // 1. 순수 유틸리티
  check('normalizeAuthEmail trims/lowercases', normalizeAuthEmail('  Foo@Bar.COM ') === 'foo@bar.com');
  check('normalizeAuthEmail null -> ""', normalizeAuthEmail(null) === '');
  const bridgeError = createBridgeError(409, 'dup');
  check('createBridgeError status', bridgeError.status === 409);
  check('createBridgeError message', bridgeError.message === 'dup');

  check('extractAuthMemberUserId from userId', extractAuthMemberUserId({ user_metadata: { userId: 'member01' } }) === 'member01');
  check('extractAuthMemberUserId from username', extractAuthMemberUserId({ user_metadata: { username: 'member02' } }) === 'member02');
  check('extractAuthMemberUserId null -> ""', extractAuthMemberUserId(null) === '');

  // 2. throwAdminError 상태 매핑
  expectStatus('email_exists code', () => throwAdminError('동기화', { code: 'email_exists' }), 409);
  expectStatus('already registered message', () => throwAdminError('동기화', { message: 'has already been registered' }), 409);
  expectStatus('email_address_invalid code', () => throwAdminError('동기화', { code: 'email_address_invalid' }), 400);
  expectStatus('email invalid message', () => throwAdminError('동기화', { message: 'Email address "x" is invalid' }), 400);
  expectStatus('generic error -> 502', () => throwAdminError('동기화', { message: 'boom' }), 502);

  // 3. findAuthUser 페이지네이션 (perPage=200, 250명 → 2페이지)
  const manyUsers = [];
  for (let i = 1; i <= 250; i += 1) {
    manyUsers.push(makeUser({ id: `id-${i}`, user_metadata: { userId: `m${i}` } }));
  }
  const pageClient = makeMockClient(manyUsers);
  const foundOnPage2 = await findAuthUser({ client: pageClient }, (u) => extractAuthMemberUserId(u) === 'm230');
  check('findAuthUser finds match on page 2', foundOnPage2 && foundOnPage2.id === 'id-230');
  check('findAuthUser used 2 list pages', pageClient.calls.listUsers === 2);

  const missClient = makeMockClient(manyUsers);
  const notFound = await findAuthUser({ client: missClient }, () => false);
  check('findAuthUser returns null when absent', notFound === null);

  check('findAuthUser ignores non-function predicate', (await findAuthUser({ client: makeMockClient(manyUsers) }, null)) === null);

  // 4. resolveAuthUser 캐스케이드 (authUserId → userId → lookupEmail → targetEmail)
  const profile = makeUser({ id: VALID_UUID, email: 'a@b.com', user_metadata: { userId: 'alice' } });
  const byId = await resolveAuthUser({ client: makeMockClient([profile]) }, { authUserId: VALID_UUID });
  check('resolveAuthUser by authUserId', byId && byId.id === VALID_UUID);

  const byUserId = await resolveAuthUser({ client: makeMockClient([profile]) }, { userId: 'alice' });
  check('resolveAuthUser by metadata userId', byUserId && byUserId.user_metadata.userId === 'alice');

  const byLookup = await resolveAuthUser({ client: makeMockClient([profile]) }, { lookupEmail: 'A@B.com' });
  check('resolveAuthUser by lookupEmail (case-insensitive)', byLookup && byLookup.email === 'a@b.com');

  const byTarget = await resolveAuthUser({ client: makeMockClient([profile]) }, { allowTargetEmailLookup: 'a@b.com' });
  check('resolveAuthUser by target email', byTarget && byTarget.email === 'a@b.com');

  const resolveMiss = await resolveAuthUser({ client: makeMockClient([profile]) }, { userId: 'nobody' });
  check('resolveAuthUser returns null when nothing matches', resolveMiss === null);

  // 5. syncMemberAuthProfile 분기
  const disabled = await syncMemberAuthProfile({ client: null }, { userId: 'alice', email: 'x@y.com' });
  check('sync disabled when no client', disabled.synced === false && disabled.reason === 'disabled');

  const missingId = await syncMemberAuthProfile({ client: makeMockClient([]) }, { userId: '', email: 'x@y.com' });
  check('sync missing-user-id', missingId.reason === 'missing-user-id');

  const missingEmail = await syncMemberAuthProfile({ client: makeMockClient([]) }, { userId: 'alice', email: '' });
  check('sync missing-email', missingEmail.reason === 'missing-email');

  const notFoundAllowed = await syncMemberAuthProfile(
    { client: makeMockClient([]) },
    { userId: 'ghost', email: 'g@h.com' },
    { allowMissingAuthUser: true }
  );
  check('sync not_found when allowed', notFoundAllowed.reason === 'not_found');

  let sync404 = null;
  try {
    await syncMemberAuthProfile({ client: makeMockClient([]) }, { userId: 'ghost', email: 'g@h.com' });
  } catch (error) {
    sync404 = error.status;
  }
  check('sync throws 404 when missing and not allowed', sync404 === 404);

  const matched = makeUser({ id: VALID_UUID, email: 'a@b.com', user_metadata: { userId: 'alice', nickname: 'Al' } });
  const noop = await syncMemberAuthProfile({ client: makeMockClient([matched]) }, { userId: 'alice', email: 'a@b.com', nickName: 'Al' });
  check('sync noop when nothing changed', noop.synced === false && noop.reason === 'noop');

  const stale = makeUser({ id: VALID_UUID, email: 'old@b.com', user_metadata: { userId: 'alice' } });
  const updateClient = makeMockClient([stale]);
  const updated = await syncMemberAuthProfile({ client: updateClient }, { userId: 'alice', email: 'new@b.com', nickName: 'Al' });
  check('sync updates when email differs', updated.synced === true);
  check('sync called updateUserById once', updateClient.calls.updateUserById === 1);
  check('sync returns updated email', updated.user && updated.user.email === 'new@b.com');

  // 6. findAuthUser maxPages 한도 소진 시 경고 (AuthBridgeSync 50페이지 한도 가드)
  let warned = '';
  const originalWarn = console.warn;
  console.warn = (message) => { warned = String(message); };
  try {
    const floodClient = {
      auth: {
        admin: {
          async listUsers() {
            // 항상 가득 찬 페이지 + 매우 큰 lastPage → 조기 종료 조건을 우회해 50페이지 한도까지 소진.
            return {
              data: {
                users: Array.from({ length: 200 }, (_, i) => makeUser({ id: `flood-${i}` })),
                lastPage: 99999
              },
              error: null
            };
          }
        }
      }
    };
    const flooded = await findAuthUser({ client: floodClient }, () => false);
    check('findAuthUser returns null after maxPages', flooded === null);
  } finally {
    console.warn = originalWarn;
  }
  check('findAuthUser warns on maxPages exhaustion', /한도 도달/.test(warned));

  console.log(JSON.stringify({ ok: true, message: 'Auth bridge smoke passed', checks }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
