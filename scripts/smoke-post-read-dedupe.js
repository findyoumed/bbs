'use strict';

const assert = require('assert');
const {
  fetchPagedPosts,
  invalidateReadCache
} = require('../src/server/SupabaseBoardRepositoryPostReads');

let queryCount = 0;

function createQuery() {
  return {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    order() { return this; },
    range() { return this; },
    then(resolve) {
      queryCount += 1;
      setTimeout(() => resolve({ data: [], count: 0, error: null }), 25);
    }
  };
}

function createRepo() {
  return {
    capabilities: {
      threaded: true,
      columns: { family_id: true, sort_order: true, depth: true }
    },
    tables: { posts: 'posts' },
    client: { from() { return createQuery(); } }
  };
}

(async () => {
  const repo = createRepo();
  const first = fetchPagedPosts(repo, 'plaza', 1, 15, null);
  const second = fetchPagedPosts(repo, 'plaza', 1, 15, null);
  await Promise.all([first, second]);
  assert.strictEqual(queryCount, 1, 'concurrent identical list reads should share one query');

  invalidateReadCache(repo);
  const staleRequest = fetchPagedPosts(repo, 'plaza', 1, 15, null);
  await new Promise((resolve) => setTimeout(resolve, 5));
  invalidateReadCache(repo);
  const freshRequest = fetchPagedPosts(repo, 'plaza', 1, 15, null);
  await Promise.all([staleRequest, freshRequest]);
  assert.strictEqual(queryCount, 3, 'a mutation should detach the old in-flight request');

  await fetchPagedPosts(repo, 'plaza', 1, 15, null);
  assert.strictEqual(queryCount, 3, 'the fresh request should repopulate the cache');
  console.log(JSON.stringify({ ok: true, sharedConcurrentQueries: 1, postMutationQueries: 2 }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
