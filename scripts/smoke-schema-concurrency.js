'use strict';

const assert = require('assert');
const { ensureCapabilities } = require('../src/server/SupabaseBoardRepositorySchema');

let schemaReads = 0;

function createQuery() {
  return {
    select() { return this; },
    limit() { return this; },
    then(resolve) {
      schemaReads += 1;
      setTimeout(() => resolve({
        data: [{
          id: 1,
          local_id: 1,
          board_id: 'plaza',
          family_id: 1,
          sort_order: 0,
          depth: 0,
          user_id: 'tester',
          nick_name: 'Tester',
          hit: 0,
          recommend: 0
        }],
        error: null
      }), 20);
    }
  };
}

(async () => {
  const repo = {
    tables: { posts: 'posts' },
    client: { from() { return createQuery(); } }
  };
  const first = ensureCapabilities(repo);
  const second = ensureCapabilities(repo);
  const [firstCapabilities, secondCapabilities] = await Promise.all([first, second]);

  assert.strictEqual(schemaReads, 1, 'concurrent capability reads should share one schema query');
  assert.strictEqual(firstCapabilities, secondCapabilities, 'shared capability reads should resolve the same object');
  assert.strictEqual(firstCapabilities.threaded, true, 'threaded capability should be detected');
  console.log(JSON.stringify({ ok: true, sharedSchemaReads: schemaReads }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
