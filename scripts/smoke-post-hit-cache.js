'use strict';

const assert = require('assert');
const { fetchPost, getPost } = require('../src/server/SupabaseBoardRepositoryPostReads');

const updateValues = [];
const postRow = {
  id: 10,
  local_id: 7,
  board_id: 'plaza',
  title: 'hit cache test',
  content: 'content',
  user_id: 'author',
  hit: 0
};

function createQuery(kind = 'read') {
  return {
    kind,
    updatePayload: null,
    select() { return this; },
    update(payload) { this.kind = 'update'; this.updatePayload = payload; return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    gt() { return this; },
    lt() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
    async single() {
      updateValues.push(this.updatePayload.hit);
      return { data: { hit: this.updatePayload.hit }, error: null };
    },
    then(resolve) {
      if (this.kind === 'update') return Promise.resolve({ data: { hit: this.updatePayload.hit }, error: null }).then(resolve);
      return Promise.resolve({ data: [postRow], error: null }).then(resolve);
    }
  };
}

(async () => {
  const repo = {
    levelAliases: {},
    capabilities: { threaded: false, localId: 'local_id', hit: 'hit' },
    tables: { boards: 'boards', posts: 'posts' },
    _boardCache: new Map([['plaza', {
      at: Date.now(),
      board: { boardId: 'plaza', accessLevel: 1 }
    }]]),
    client: { from() { return createQuery(); } }
  };

  await getPost(repo, 'plaza', 7, {
    incrementHit: true,
    viewerId: 'reader',
    context: { level: 1 }
  });
  const globalIdPost = await fetchPost(repo, 'plaza', 10);
  assert.strictEqual(globalIdPost.hit, 1, 'global-id detail cache should receive the incremented hit count');

  await getPost(repo, 'plaza', 7, {
    incrementHit: true,
    viewerId: 'reader',
    context: { level: 1 }
  });

  assert.deepStrictEqual(updateValues, [1, 2], 'cached detail reads must carry forward the latest hit count');
  console.log(JSON.stringify({ ok: true, hitUpdates: updateValues }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
