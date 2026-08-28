'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'public/js/core/postListPrefetchService.js');
const esmExport = [String.fromCharCode(101, 120, 112, 111, 114, 116), ' function scheduleNextPagePrefetch'].join('');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(esmExport, 'function scheduleNextPagePrefetch')
  + '\nmodule.exports = { scheduleNextPagePrefetch };';

const sandboxModule = { exports: {} };
const context = vm.createContext({
  Map,
  Promise,
  setTimeout,
  clearTimeout,
  module: sandboxModule,
  exports: sandboxModule.exports,
  window: { requestIdleCallback(callback) { callback(); } }
});
vm.runInContext(source, context, { filename: sourcePath });

const { scheduleNextPagePrefetch } = sandboxModule.exports;

function schedule(getCurrentGeneration, generation, fetchPostsPage) {
  scheduleNextPagePrefetch({
    boardId: 'plaza',
    data: { page: 1, totalPages: 2, items: [] },
    searchParams: {},
    buildListCacheKey: (boardId, page) => `${boardId}:${page}`,
    fetchPostsPage,
    loadPost: null,
    generation,
    getCurrentGeneration
  });
}

(async () => {
  let fetchCalls = 0;
  const fetchPostsPage = () => {
    fetchCalls += 1;
    return Promise.resolve(null);
  };

  // A stale idle task must release its key so a later generation can retry.
  schedule(() => 1, 0, fetchPostsPage);
  await new Promise((resolve) => setTimeout(resolve, 0));
  schedule(() => 1, 1, fetchPostsPage);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(fetchCalls, 1, 'stale prefetch keys must not block a later generation');

  // Identical concurrent work remains deduplicated while in flight.
  let resolveFetch;
  const delayedFetch = () => {
    fetchCalls += 1;
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  schedule(() => 2, 2, delayedFetch);
  schedule(() => 2, 2, delayedFetch);
  assert.strictEqual(fetchCalls, 2, 'identical concurrent prefetches should share one request');
  resolveFetch(null);
  await Promise.resolve();
  console.log(JSON.stringify({ ok: true, fetchCalls }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
