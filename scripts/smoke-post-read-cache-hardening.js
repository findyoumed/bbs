'use strict';

const assert = require('assert');
const { fetchPagedPosts, listBoardCounts, listHotPosts, invalidateReadCache } = require('../src/server/SupabaseBoardRepositoryPostReads');

let queryCount = 0;
let countQueryCount = 0;

function createQuery() {
  const query = {
    kind: 'posts', recent: false,
    select(_columns, options) { if (options?.head) this.kind = 'counts'; return this; },
    eq() { return this; }, in() { return this; }, gt() { return this; }, lt() { return this; }, or() { return this; },
    gte() { this.recent = true; return this; }, order() { return this; }, limit() { return this; }, range() { return this; },
    then(resolve) {
      if (this.kind === 'counts') {
        countQueryCount += 1;
        return Promise.resolve({ count: this.recent ? 2 : 5, error: null }).then(resolve);
      }
      queryCount += 1;
      return Promise.resolve({ data: [{ id: queryCount, local_id: queryCount, board_id: 'plaza', title: `post-${queryCount}` }], count: 1, error: null }).then(resolve);
    }
  };
  return query;
}

function createRepo() {
  return {
    capabilities: { threaded: false, localId: 'local_id', hit: 'hit' },
    tables: { posts: 'posts' },
    boards: [{ boardId: 'plaza' }, { boardId: 'humor' }],
    client: { from() { return createQuery(); } }
  };
}

(async () => {
  const repo = createRepo();
  await Promise.all([
    fetchPagedPosts(repo, 'plaza', 1, 15, null),
    fetchPagedPosts(repo, 'plaza', 1, 15, null)
  ]);
  assert.strictEqual(queryCount, 1, 'identical concurrent reads should share one query');
  for (let page = 2; page <= 520; page += 1) await fetchPagedPosts(repo, 'plaza', page, 15, null);
  assert(repo._readCache.size <= 500, 'read cache should remain bounded');

  const defaultCounts = await listBoardCounts(repo);
  assert.deepStrictEqual(defaultCounts.plaza, { total: 5, recent: 2 });
  const countCallsAfterDefault = countQueryCount;
  await listBoardCounts(repo);
  assert.strictEqual(countQueryCount, countCallsAfterDefault, 'same count window should use cache');
  const wideCounts = await listBoardCounts(repo, { recentDays: 30 });
  assert.deepStrictEqual(wideCounts.humor, { total: 5, recent: 2 });
  assert.strictEqual(countQueryCount, countCallsAfterDefault + 4, 'different count windows should not share cache');

  const hotQueryCount = queryCount;
  await Promise.all([listHotPosts(repo, { limit: 5, days: 7 }), listHotPosts(repo, { limit: 5, days: 7 })]);
  assert.strictEqual(queryCount, hotQueryCount + 1, 'identical hot-post reads should share one query');
  await listHotPosts(repo, { limit: 5, days: 7 });
  assert.strictEqual(queryCount, hotQueryCount + 1, 'hot-post reads should use the short cache');

  invalidateReadCache(repo);
  assert.strictEqual(repo._boardCountsCache, null, 'invalidation should clear count cache');
  assert.strictEqual(repo._boardCountsRequests.size, 0, 'invalidation should detach count refreshes');
  console.log(JSON.stringify({ ok: true, countQueries: countQueryCount }));
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
