'use strict';

const assert = require('assert');
const {
  fetchPagedPosts,
  fetchPostByLocalId,
  invalidateReadCache
} = require('../src/server/SupabaseBoardRepositoryPostReads');

let queryCount = 0;
let localReadData = [];

function createQuery() {
  return {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    order() { return this; },
    limit() { return this; },
    range() { return this; },
    then(resolve) {
      queryCount += 1;
      setTimeout(() => resolve({ data: localReadData, count: 0, error: null }), 25);
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

  localReadData = [{ id: 77, local_id: 7, board_id: 'plaza', title: 'cached local read' }];
  const localFirst = fetchPostByLocalId(repo, 'plaza', 7);
  const localSecond = fetchPostByLocalId(repo, 'plaza', 7);
  const [firstPost, secondPost] = await Promise.all([localFirst, localSecond]);
  assert.strictEqual(queryCount, 4, 'concurrent local-id detail reads should share one query');
  assert.strictEqual(firstPost.id, 77, 'local-id detail read should map the returned post');
  assert.deepStrictEqual(firstPost, secondPost, 'shared local-id reads should return the same post');
  await fetchPostByLocalId(repo, 'plaza', 7);
  assert.strictEqual(queryCount, 4, 'local-id detail reads should use the server read cache');

  invalidateReadCache(repo);
  await fetchPostByLocalId(repo, 'plaza', 7);
  assert.strictEqual(queryCount, 5, 'cache invalidation should force a fresh local-id read');
  console.log(JSON.stringify({ ok: true, sharedConcurrentQueries: 2, postMutationQueries: 3 }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
