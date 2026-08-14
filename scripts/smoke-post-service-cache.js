'use strict';

const assert = require('assert');
const path = require('path');
const { loadBrowserHarnessModule } = require('./smoke/common-utils');

const moduleCache = new Map();
const { createPostService } = loadBrowserHarnessModule(
  path.join(__dirname, '..', 'public/js/core/postService.js'),
  moduleCache
);

(async () => {
  const calls = [];
  const state = { envVars: {} };
  const apiFetch = async (url, options = {}) => {
    calls.push({ url, options });
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (options.method === 'POST') return { post: { localId: 7, title: 'updated' } };
    return { board: { id: 'plaza' }, post: { localId: 7, title: 'cached' } };
  };
  const service = createPostService({ apiFetch, state });

  const first = service.loadPost('plaza', 7);
  const second = service.loadPost('plaza', 7);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.strictEqual(calls.length, 1, 'concurrent detail reads should share one API request');
  assert.deepStrictEqual(firstResult, secondResult, 'shared detail reads should return the same payload');

  await service.loadPost('plaza', 7);
  assert.strictEqual(calls.length, 1, 'a successful detail read should be cached');

  await service.recommendPost('plaza', 7);
  assert.strictEqual(calls.length, 2, 'recommendation should issue exactly one write request');

  await service.loadPost('plaza', 7);
  assert.strictEqual(calls.length, 3, 'recommendation should invalidate the detail cache');

  service.clearCache();
  await service.loadPost('plaza', 7);
  assert.strictEqual(calls.length, 4, 'clearCache should invalidate detail reads');

  console.log(JSON.stringify({ ok: true, sharedDetailReads: 1, totalApiCalls: calls.length }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
