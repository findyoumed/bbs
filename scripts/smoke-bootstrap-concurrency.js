'use strict';

const assert = require('assert');
const handleSystemRoutes = require('./../src/server/routeHandlers/systemRoutes');

const statsCalls = {
  members: 0,
  activeUsers: 0,
  totalPosts: 0,
  todayPosts: 0
};
const assetStatsCache = {};

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), 15));
}

function createResponse() {
  return {
    headersSent: false,
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
    }
  };
}

function createDependencies() {
  return {
    req: { method: 'GET', url: '/api/bootstrap' },
    res: createResponse(),
    requestUrl: new URL('http://localhost/api/bootstrap'),
    assetStatsCache,
    boardRepository: {
      async listBoards() {
        return [];
      },
      async countPosts() {
        statsCalls.totalPosts += 1;
        return delay(120);
      },
      async countPostsSince() {
        statsCalls.todayPosts += 1;
        return delay(4);
      }
    },
    memberRepository: {
      async countMembers() {
        statsCalls.members += 1;
        return delay(10);
      }
    },
    activityRepository: {
      async getStats() {
        statsCalls.activeUsers += 1;
        return delay({ totalConnections: 3 });
      }
    },
    menuResolver: {
      getTree() {
        return { key: 'top', children: [] };
      }
    },
    runtimeConfig: { hostName: '01410' }
  };
}

async function requestBootstrap() {
  const dependencies = createDependencies();
  await handleSystemRoutes(dependencies);
  assert.strictEqual(dependencies.res.statusCode, 200);
  return JSON.parse(dependencies.res.body);
}

function resetStatsCalls() {
  for (const key of Object.keys(statsCalls)) statsCalls[key] = 0;
}

function assertSingleStatsRefresh() {
  for (const [name, count] of Object.entries(statsCalls)) {
    assert.strictEqual(count, 1, `${name} should be queried once, got ${count}`);
  }
}

(async () => {
  const [first, second] = await Promise.all([requestBootstrap(), requestBootstrap()]);
  assertSingleStatsRefresh();
  assert.strictEqual(first.data.stats.numarticles, '120');
  assert.deepStrictEqual(first.data.stats, second.data.stats);

  assetStatsCache.expiresAt = 0;
  resetStatsCalls();
  await Promise.all([requestBootstrap(), requestBootstrap()]);
  assertSingleStatsRefresh();

  console.log(JSON.stringify({ ok: true, coldRefreshes: 1, staleRefreshes: 1 }));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
