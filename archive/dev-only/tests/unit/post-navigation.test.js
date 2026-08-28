'use strict';

const assert = require('assert');
const { getNavigation } = require('../../../../src/server/SupabaseBoardRepositoryPostReads');

function makeQuery(calls) {
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
      calls.push(this.kind);
      return { data: { local_id: { latest: 99, previous: 8, next: 12 }[this.kind] }, error: null };
    }
  };
  return query;
}

module.exports = (async () => {
  const calls = [];
  const repo = {
    capabilities: { threaded: true },
    tables: { posts: 'posts' },
    client: { from() { return makeQuery(calls); } }
  };
  const knownPost = { id: 10, localId: 10, family: 4, orderby: 2, step: 0 };
  const result = await getNavigation(repo, 'plaza', knownPost.id, null, knownPost);

  assert.deepStrictEqual(result, { latestId: 99, prevId: 8, nextId: 12 });
  assert.deepStrictEqual(calls.sort(), ['latest', 'next', 'previous'].sort());
})();
