'use strict';

const handleSystemRoutes = require('../../../../src/server/routeHandlers/systemRoutes');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
  }
}

function createRouteContext(method, url) {
  const req = {
    method,
    headers: {},
    socket: {
      remoteAddress: '127.0.0.1'
    }
  };
  const res = {
    statusCode: 0,
    headers: null,
    payload: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(payload) {
      this.payload = String(payload ?? '');
    }
  };

  return {
    req,
    res,
    requestUrl: new URL(url)
  };
}

function parseJsonPayload(res) {
  return JSON.parse(String(res.payload || '{}'));
}

function createBaseDeps(overrides = {}) {
  return {
    projectRoot: process.cwd(),
    assetManager: {
      getAsset: async () => ''
    },
    boardRepository: {
      getMeta: () => ({ driver: 'memory' })
    },
    memberRepository: {},
    activityRepository: {
      list: () => [],
      touch: () => {}
    },
    menuResolver: {
      getTree: () => []
    },
    authBridge: {
      getClientConfig: () => ({ enabled: false, url: '', publishableKey: '' })  
    },
    runtimeConfig: {
      hostName: '01410'
    },
    assetStatsCache: {},
    repositoryDiagnostics: {},
    errorTracker: {
      getClientConfig: () => ({ enabled: false, dsn: '', environment: '', release: '' })
    },
    ...overrides
  };
}

module.exports = (async () => {
  console.log('Running systemRoutes tests...');

  const statsCache = {};
  let memberCalls = 0;
  let activeUserListCalls = 0;
  let countPostsCalls = 0;
  let countPostsSinceCalls = 0;
  let sinceArgument = null;

  const statsContext = createRouteContext('GET', 'https://bbs.example/api/system/stats');
  const statsDeps = createBaseDeps({
    memberRepository: {
      countMembers: async () => {
        memberCalls += 1;
        return '1234';
      }
    },
    boardRepository: {
      getMeta: () => ({ driver: 'memory' }),
      countPosts: async () => {
        countPostsCalls += 1;
        return 3456.9;
      },
      countPostsSince: async (since) => {
        countPostsSinceCalls += 1;
        sinceArgument = since;
        return 12.9;
      }
    },
    activityRepository: {
      list: () => {
        activeUserListCalls += 1;
        return [{}, {}, {}];
      },
      touch: () => {}
    },
    runtimeConfig: {
      hostName: 'BBS-01410'
    },
    assetStatsCache: statsCache
  });

  assertEqual(
    await handleSystemRoutes({ ...statsDeps, ...statsContext }),
    true,
    'systemRoutes should handle the stats endpoint'
  );
  const firstStatsPayload = parseJsonPayload(statsContext.res);
  assertEqual(firstStatsPayload.data.hostname, 'BBS-01410', 'stats should expose the configured host name');
  assertEqual(firstStatsPayload.data.nummembers, '1,234', 'stats should format the member count with separators');
  assertEqual(firstStatsPayload.data.numconns, '3', 'stats should count active users from a single list scan');
  assertEqual(firstStatsPayload.data.numarticles, '3,456', 'stats should floor and format the total article count');
  assertEqual(firstStatsPayload.data.todaynumarticles, '12', 'stats should floor and format today article counts');
  assert(memberCalls === 1, 'stats should load the member count once');
  assert(activeUserListCalls === 1, 'stats should scan active users once per uncached request');
  assert(countPostsCalls === 1, 'stats should load total post count once');     
  assert(countPostsSinceCalls === 1, 'stats should load today post count once');
  assert(sinceArgument instanceof Date, 'stats should pass a Date to countPostsSince');
  assertEqual(sinceArgument.getHours(), 0, 'stats should normalize the start-of-day hour');
  assertEqual(sinceArgument.getMinutes(), 0, 'stats should normalize the start-of-day minute');
  assertEqual(sinceArgument.getSeconds(), 0, 'stats should normalize the start-of-day second');
  assert(statsCache.data, 'stats should cache the computed payload');
  assert(Number(statsCache.expiresAt || 0) > Date.now(), 'stats cache should receive a future expiry');

  const cachedContext = createRouteContext('GET', 'https://bbs.example/api/system/stats');
  assertEqual(
    await handleSystemRoutes({ ...statsDeps, ...cachedContext }),
    true,
    'stats should still be handled when served from cache'
  );
  const cachedStatsPayload = parseJsonPayload(cachedContext.res);
  assertEqual(
    JSON.stringify(cachedStatsPayload.data),
    JSON.stringify(firstStatsPayload.data),
    'cached stats responses should reuse the stored payload data'
  );
  assert(memberCalls === 1, 'cached stats should not recount members');
  assert(activeUserListCalls === 1, 'cached stats should not rescan active users');
  assert(countPostsCalls === 1, 'cached stats should not recount total posts'); 
  assert(countPostsSinceCalls === 1, 'cached stats should not recount today posts');

  const fallbackContext = createRouteContext('GET', 'https://bbs.example/api/system/stats');
  const fallbackDeps = createBaseDeps({
    memberRepository: {
      countMembers: async () => {
        throw new Error('member store unavailable');
      }
    },
    boardRepository: {
      getMeta: () => ({ driver: 'memory' }),
      countPosts: async () => {
        throw new Error('post count unavailable');
      },
      countPostsSince: async () => '-5'
    },
    activityRepository: {
      list: () => {
        throw new Error('activity list unavailable');
      },
      touch: () => {}
    },
    assetStatsCache: {}
  });

  assertEqual(
    await handleSystemRoutes({ ...fallbackDeps, ...fallbackContext }),
    true,
    'stats should stay available when repositories fail'
  );
  const fallbackPayload = parseJsonPayload(fallbackContext.res);
  // [LOG: 20260425_2048] Lock the zero-fallback path so diagnostics failures do not break the stats endpoint.
  assertEqual(fallbackPayload.data.hostname, '01410', 'stats should fall back to the default host name');
  assertEqual(fallbackPayload.data.nummembers, '0', 'stats should fall back to zero members on loader errors');
  assertEqual(fallbackPayload.data.numconns, '0', 'stats should fall back to zero active users on loader errors');
  assertEqual(fallbackPayload.data.numarticles, '0', 'stats should fall back to zero total articles on loader errors');
  assertEqual(fallbackPayload.data.todaynumarticles, '0', 'stats should clamp negative today article counts to zero');

  console.log('systemRoutes tests passed!');
})();
