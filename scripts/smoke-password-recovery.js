'use strict';

const assert = require('assert');
const {
  normalizeRecoveryRedirect,
  requestPasswordRecovery
} = require('../src/server/AuthBridgeRecovery');

function expectStatus(fn, status) {
  assert.throws(fn, (error) => Number(error?.status) === status);
}

async function main() {
  assert.strictEqual(normalizeRecoveryRedirect('/reset-password'), '/reset-password');
  assert.strictEqual(normalizeRecoveryRedirect('/reset-password?token=abc'), '/reset-password?token=abc');

  expectStatus(() => normalizeRecoveryRedirect('//evil.example/reset'), 400);
  expectStatus(() => normalizeRecoveryRedirect('https://evil.example/reset', {
    BBS_PUBLIC_ORIGIN: 'https://bbs.example.com'
  }), 400);
  expectStatus(() => normalizeRecoveryRedirect('javascript:alert(1)', {
    BBS_PUBLIC_ORIGIN: 'https://bbs.example.com'
  }), 400);
  expectStatus(() => normalizeRecoveryRedirect('https://user:password@bbs.example.com/reset-password', {
    BBS_PUBLIC_ORIGIN: 'https://bbs.example.com'
  }), 400);
  assert.strictEqual(
    normalizeRecoveryRedirect('https://bbs.example.com/reset-password', {
      BBS_PUBLIC_ORIGIN: 'https://bbs.example.com'
    }),
    'https://bbs.example.com/reset-password'
  );

  const calls = [];
  const bridge = {
    env: {},
    recoveryClient: {
      auth: {
        async resetPasswordForEmail(email, options) {
          calls.push({ email, options });
          return { error: null };
        }
      }
    }
  };

  const result = await requestPasswordRecovery(bridge, ' USER@EXAMPLE.COM ', {
    redirectTo: '/reset-password'
  });
  assert.strictEqual(result.email, 'user@example.com');
  assert.strictEqual(result.redirectTo, '/reset-password');
  assert.deepStrictEqual(calls[0], {
    email: 'user@example.com',
    options: { redirectTo: '/reset-password' }
  });

  console.log(JSON.stringify({ ok: true, message: 'Password recovery redirect smoke passed' }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
