'use strict';

const assert = require('assert');
const { getNavigation, invalidateReadCache } = require('../src/server/SupabaseBoardRepositoryPostReads');

function createQuery(callLog) {
  const query = {
    kind: 'latest',
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    or(expression) {
      this.kind = expression.includes('family_id.gt.') ? 'previous' : 'next';
      return this;
    },
    order() { return this; },
    limit() { return this; },
    async maybeSingle() {
      callLog.push(this.kind);
      await new Promise((resolve) => setTimeout(resolve, 25));
      const rows = {
        latest: { local_id: 99, id: 99 },
        previous: { local_id: 8, id: 8 },
        next: { local_id: 12, id: 12 }
      };
      return { data: rows[this.kind], error: null };
    }
  };
  return query;
}

(async () => {
  const callLog = [];
  const repo = {
    capabilities: {
      threaded: true,
      family: 'family_id',
      orderby: 'sort_order',
      columns: { family_id: true, sort_order: true, depth: true }
    },
    tables: { posts: 'posts' },
    client: { from() { return createQuery(callLog); } }
  };
  const knownPost = { id: 10, localId: 10, family: 4, orderby: 2, step: 0 };
  const startedAt = Date.now();
  const navigation = await getNavigation(repo, 'plaza', knownPost.id, null, knownPost);
  const elapsedMs = Date.now() - startedAt;

  assert.deepStrictEqual(navigation, { latestId: 99, prevId: 8, nextId: 12 });
  assert.strictEqual(callLog.length, 3);
  assert(elapsedMs < 65, `navigation queries should run in parallel (elapsed ${elapsedMs}ms)`);

  const cachedNavigation = await getNavigation(repo, 'plaza', knownPost.id, null, knownPost);
  assert.deepStrictEqual(cachedNavigation, navigation);
  assert.strictEqual(callLog.length, 3, 'cached navigation should avoid another query batch');

  invalidateReadCache(repo);
  await getNavigation(repo, 'plaza', knownPost.id, null, knownPost);
  assert.strictEqual(callLog.length, 6, 'cache invalidation should refresh navigation');
  console.log(JSON.stringify({ ok: true, queryCount: callLog.length, elapsedMs }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
