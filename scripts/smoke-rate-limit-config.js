/**
 * Regression checks for request rate-limit defaults and explicit overrides.
 * The checks exercise the public guard factory without starting a server.
 */
'use strict';

const assert = require('assert');
const { createRequestGuards } = require('../src/server/requestGuards');

function request(ip) {
  return { headers: {}, socket: { remoteAddress: ip } };
}

function countAllowed(checkRateLimit, ip, attempts) {
  const req = request(ip);
  let allowed = 0;
  for (let index = 0; index < attempts; index += 1) {
    if (checkRateLimit(req)) allowed += 1;
  }
  return allowed;
}

// Production remains fail-closed at the 60-request default.
const production = createRequestGuards({ NODE_ENV: 'production' });
assert.strictEqual(countAllowed(production.checkRateLimit, 'rate-prod-default', 61), 60);

// An explicit production setting is honored when an operator deliberately
// configures it; this is separate from the production default.
const configuredProduction = createRequestGuards({ NODE_ENV: 'production', RATE_LIMIT_MAX_REQUESTS: '5' });
assert.strictEqual(countAllowed(configuredProduction.checkRateLimit, 'rate-prod-configured', 6), 5);

// Test/development defaults stay generous enough for browser smoke runs.
const testGuards = createRequestGuards({ NODE_ENV: 'test' });
assert.strictEqual(countAllowed(testGuards.checkRateLimit, 'rate-test-default', 1001), 1000);
const configuredTest = createRequestGuards({ NODE_ENV: 'test', RATE_LIMIT_MAX_REQUESTS: '10000' });
assert.strictEqual(countAllowed(configuredTest.checkRateLimit, 'rate-test-configured', 1001), 1001);

console.log('Rate-limit configuration contract smoke checks passed.');
