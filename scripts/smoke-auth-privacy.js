'use strict';

const assert = require('assert');
const { AuthRouter } = require('../src/server/routeHandlers/authRoutes');
const { MemberRouter } = require('../src/server/routeHandlers/memberRoutes');

function makeRouter() {
  return new AuthRouter({
    req: { method: 'POST', headers: {} },
    res: {},
    requestUrl: new URL('http://localhost/api/members/password-recovery'),
    authBridge: {
      async syncMemberAuthProfile() {},
      async requestPasswordRecovery() {}
    },
    memberRepository: {}
  });
}

async function exercise(member) {
  const router = makeRouter();
  router.getBody = async () => ({
    userIdOrEmail: member ? 'alice' : 'missing-account',
    redirectTo: '/log/password'
  });
  router.findMemberByIdentifier = async () => member;
  let response = null;
  router.send = (status, data) => {
    response = { status, data };
    return true;
  };
  await router.requestPasswordRecovery();
  return response;
}

async function main() {
  const known = await exercise({ userId: 'alice', nickName: 'Alice', email: 'alice@example.com' });
  assert.deepStrictEqual(known, { status: 200, data: { success: true } });

  // Unknown and known identifiers must have the same successful, non-
  // identifying response shape.
  const unknown = await exercise(null);
  assert.deepStrictEqual(unknown, known);

  const projectionRouter = new MemberRouter({
    req: { method: 'GET', headers: {} },
    res: {},
    requestUrl: new URL('http://localhost/api/members/sysop'),
    memberRepository: {}
  });
  const privateMember = {
    userId: 'sysop', nickName: '시스옵', level: 99, isAdmin: true,
    registrationDateTime: '2026-01-01T00:00:00.000Z',
    email: 'sysop@example.com', birthday: '1970-01-01', sex: 'M',
    authUserId: 'secret-auth-id', absentReason: '비공개'
  };
  const publicProfile = projectionRouter._toDirectoryMember(
    privateMember, { userId: 'guest', isGuest: true }, 'sysop'
  );
  assert.deepStrictEqual(publicProfile, {
    userId: 'sysop', nickName: '시스옵', level: 99, isAdmin: true,
    registrationDateTime: '2026-01-01T00:00:00.000Z'
  });
  const loginProjection = projectionRouter._toDirectoryMember(
    privateMember, { userId: 'guest', isGuest: true }, 'sysop', { exposeLoginEmail: true }
  );
  assert.strictEqual(loginProjection.email, 'sysop@example.com');
  assert.strictEqual(loginProjection.authUserId, undefined);

  console.log(JSON.stringify({ ok: true, message: 'Auth privacy smoke passed' }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
