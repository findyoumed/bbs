'use strict';

const {
  allowManualRequestIdentity,
  buildManualRequestIdentity,
  isLoopbackAddress,
  isLoopbackRequest,
  normalizeRequestIdentity,
  normalizeRequestLevel,
  normalizeRequestNickName,
  normalizeRequestUserId
} = require('../../../../src/server/RequestIdentityHelpers');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
  }
}

console.log('Running RequestIdentityHelpers tests...');

assert(isLoopbackAddress('127.0.0.1'), 'isLoopbackAddress should accept IPv4 loopback');
assert(isLoopbackAddress('::1'), 'isLoopbackAddress should accept IPv6 loopback');
assert(!isLoopbackAddress('10.0.0.1'), 'isLoopbackAddress should reject non-loopback addresses');

const loopbackReq = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
assert(isLoopbackRequest(loopbackReq), 'isLoopbackRequest should detect loopback sockets');
assertEqual(
  normalizeRequestIdentity('  alpha\u0000beta  ', '', 20),
  'alpha beta',
  'normalizeRequestIdentity should strip control characters and trim whitespace'
);
assertEqual(normalizeRequestUserId('  sysop  '), 'sysop', 'normalizeRequestUserId should trim user IDs');
assertEqual(
  normalizeRequestNickName(` ${'x'.repeat(50)} `).length,
  40,
  'normalizeRequestNickName should cap nicknames at 40 characters'
);
assertEqual(normalizeRequestLevel('120', 1), 99, 'normalizeRequestLevel should clamp levels to the maximum');
assertEqual(normalizeRequestLevel('-5', 7), 1, 'normalizeRequestLevel should clamp levels to the minimum');
assertEqual(normalizeRequestLevel('oops', 7), 7, 'normalizeRequestLevel should keep the fallback for invalid numbers');

assertEqual(
  allowManualRequestIdentity(loopbackReq, { NODE_ENV: 'development', VERCEL: '' }),
  true,
  'allowManualRequestIdentity should allow local overrides outside production'
);
assertEqual(
  allowManualRequestIdentity(loopbackReq, { NODE_ENV: 'production', VERCEL: '' }),
  false,
  'allowManualRequestIdentity should reject overrides in production'
);
assertEqual(
  allowManualRequestIdentity({ socket: { remoteAddress: '10.0.0.1' } }, { NODE_ENV: 'development', VERCEL: '' }),
  false,
  'allowManualRequestIdentity should reject non-loopback requests'
);

const devIdentity = buildManualRequestIdentity(
  {
    socket: { remoteAddress: '::1' },
    headers: {
      'x-bbs-user-id': 'header-admin',
      'x-bbs-nick-name': '헤더관리자',
      'x-bbs-level': '4'
    }
  },
  {
    userId: '  admin-user  ',
    nickName: ' 운영자\u0000닉 ',
    level: '7',
    isAdmin: true
  },
  {
    env: { NODE_ENV: 'development', VERCEL: '' },
    fallback: {
      userId: 'guest',
      nickName: '손님',
      level: 1,
      isAdmin: false,
      isGuest: true,
      email: 'fallback@example.com'
    }
  }
);

assertEqual(devIdentity.userId, 'admin-user', 'manual identities should prefer explicit body user IDs');
assertEqual(devIdentity.nickName, '운영자 닉', 'manual identities should sanitize nicknames');
assertEqual(devIdentity.level, 99, 'admin overrides should force the highest level');
assertEqual(devIdentity.isAdmin, true, 'manual admin flags should be preserved on loopback requests');
assertEqual(devIdentity.isGuest, false, 'non-guest manual identities should not be marked as guests');
assertEqual(devIdentity.email, 'fallback@example.com', 'manual identities should preserve fallback email values');

const resolverIdentity = buildManualRequestIdentity(
  {
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      'x-bbs-user-id': 'sysop',
      'x-bbs-nick-name': '관리자'
    }
  },
  {},
  {
    env: { NODE_ENV: 'development', VERCEL: '' },
    fallback: {
      userId: 'guest',
      nickName: '손님',
      level: 1,
      isAdmin: false,
      isGuest: true,
      email: ''
    },
    isAdminResolver: (userId) => userId === 'sysop'
  }
);

assertEqual(resolverIdentity.userId, 'sysop', 'header overrides should be used when body values are absent');
assertEqual(resolverIdentity.level, 99, 'admin resolvers should elevate trusted users to level 99');
assertEqual(resolverIdentity.isAdmin, true, 'admin resolvers should mark trusted users as admins');

const productionIdentity = buildManualRequestIdentity(
  loopbackReq,
  {
    userId: 'member1',
    nickName: '회원1',
    level: 8,
    isAdmin: true
  },
  {
    env: { NODE_ENV: 'production', VERCEL: '' },
    fallback: {
      userId: 'guest',
      nickName: '손님',
      level: 1,
      isAdmin: false,
      isGuest: true,
      email: ''
    }
  }
);

assertEqual(productionIdentity.userId, 'guest', 'production requests should ignore manual identity overrides');
assertEqual(productionIdentity.nickName, '손님', 'production requests should keep the fallback nickname');
assertEqual(productionIdentity.level, 1, 'production requests should keep the fallback level');
assertEqual(productionIdentity.isAdmin, false, 'production requests should ignore manual admin flags');
assertEqual(productionIdentity.isGuest, true, 'fallback guest identities should remain guests');

console.log('RequestIdentityHelpers tests passed!');
