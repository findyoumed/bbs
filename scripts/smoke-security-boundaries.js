'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const { buildCorsHeaders, parseAllowedOrigins, readJsonBody } = require('../src/server/httpUtils');

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
  assert.deepStrictEqual(parseAllowedOrigins(' https://bbs.example.com,https://bbs.example.com, https://admin.example.com '), ['https://bbs.example.com', 'https://admin.example.com']);

  const validRequest = createRequest({ headers: { 'content-length': '11' }, body: '{"ok":true}' });
  assert.deepStrictEqual(await readJsonBody(validRequest), { ok: true });
  const oversizedRequest = createRequest({ headers: { 'content-length': String(2 * 1024 * 1024 + 1) } });
  await assert.rejects(readJsonBody(oversizedRequest), (error) => error.status === 413);
  assert.strictEqual(oversizedRequest.resumed, true);
  console.log(JSON.stringify({ ok: true, corsCases: 3, bodyCases: 2 }));
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
