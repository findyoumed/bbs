'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const { buildCorsHeaders, parseAllowedOrigins, readJsonBody } = require('../src/server/httpUtils');
const { createRequestGuards, handleCorsPreflight } = require('../src/server/requestGuards');

function createRequest({ method = 'POST', headers = {}, body = '' } = {}) {
  const request = new EventEmitter();
  request.method = method; request.headers = headers; request.resumed = false;
  request.resume = () => { request.resumed = true; };
  process.nextTick(() => {
    if (!request.resumed) { request.emit('data', Buffer.from(body)); request.emit('end'); }
  });
  return request;
}

(async () => {
  const allowlisted = buildCorsHeaders('https://bbs.example.com', ['https://bbs.example.com', 'https://admin.example.com']);
  assert.strictEqual(allowlisted['Access-Control-Allow-Origin'], 'https://bbs.example.com');
  assert.strictEqual(allowlisted.Vary, 'Origin');
  const denied = buildCorsHeaders('https://untrusted.example.com', ['https://bbs.example.com']);
  assert(!Object.prototype.hasOwnProperty.call(denied, 'Access-Control-Allow-Origin'));
  assert.strictEqual(buildCorsHeaders('', [])['Access-Control-Allow-Origin'], '*');
  const productionGuards = createRequestGuards({ NODE_ENV: 'production' });
  assert.strictEqual(productionGuards.corsFailClosed, true);
  const productionResponse = { headers: null, statusCode: null, ended: false, writeHead(status, headers) { this.statusCode = status; this.headers = headers; }, end() { this.ended = true; } };
  const productionRequest = { method: 'OPTIONS', headers: { origin: 'https://evil.example' } };
  assert.strictEqual(handleCorsPreflight(productionRequest, productionResponse, new URL('http://localhost/api/boards'), productionGuards), true);
  assert.strictEqual(productionResponse.statusCode, 204);
  assert.strictEqual(productionResponse.ended, true);
  assert(!Object.prototype.hasOwnProperty.call(productionResponse.headers, 'Access-Control-Allow-Origin'));
  const vercelGuards = createRequestGuards({ NODE_ENV: 'development', VERCEL: '1' });
  assert.strictEqual(vercelGuards.corsFailClosed, true);
  const wildcardProductionGuards = createRequestGuards({ NODE_ENV: 'production', BBS_ALLOWED_ORIGINS: '*' });
  assert.strictEqual(wildcardProductionGuards.allowedOrigins.length, 0);
  assert.strictEqual(wildcardProductionGuards.corsFailClosed, true);
  const mixedCaseProductionGuards = createRequestGuards({ NODE_ENV: 'Production' });
  assert.strictEqual(mixedCaseProductionGuards.corsFailClosed, true);
  const configuredProductionGuards = createRequestGuards({ NODE_ENV: 'production', BBS_ALLOWED_ORIGINS: 'https://bbs.example.com' });
  assert.strictEqual(configuredProductionGuards.corsFailClosed, false);
  const configuredResponse = { headers: null, writeHead(_status, headers) { this.headers = headers; }, end() {} };
  handleCorsPreflight({ method: 'OPTIONS', headers: { origin: 'https://bbs.example.com' } }, configuredResponse, new URL('http://localhost/api/boards'), configuredProductionGuards);
  assert.strictEqual(configuredResponse.headers['Access-Control-Allow-Origin'], 'https://bbs.example.com');
  assert.deepStrictEqual(parseAllowedOrigins(' https://bbs.example.com,https://bbs.example.com, https://admin.example.com '), ['https://bbs.example.com', 'https://admin.example.com']);
  assert.deepStrictEqual(
    parseAllowedOrigins('https://bbs.example.com/, ftp://legacy.example, *, https://bbs.example.com/path, https://admin.example.com'),
    ['https://bbs.example.com', 'https://admin.example.com']
  );

  const validRequest = createRequest({ headers: { 'content-length': '11' }, body: '{"ok":true}' });
  assert.deepStrictEqual(await readJsonBody(validRequest), { ok: true });
  const oversizedRequest = createRequest({ headers: { 'content-length': String(2 * 1024 * 1024 + 1) } });
  await assert.rejects(readJsonBody(oversizedRequest), (error) => error.status === 413);
  assert.strictEqual(oversizedRequest.resumed, true);
  console.log(JSON.stringify({ ok: true, corsCases: 11, bodyCases: 2 }));
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
