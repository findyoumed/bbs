'use strict';

const { createActivityRepository } = require('../src/server/ActivityRepository');
const { buildTrackedContext } = require('../src/server/requestContext');

async function testActivityEvolution() {
  console.log('--- Testing ActivityRepository Evolution ---');
  
  const repo = createActivityRepository({ ttlMs: 1000 }); // 1 second TTL for testing
  
  // 1. Test getMeta()
  const meta = repo.getMeta();
  console.log('Meta:', JSON.stringify(meta, null, 2));
  if (meta.driver !== 'memory' || meta.ready !== true) throw new Error('Invalid meta');

  // 2. Test touch() and getStats()
  repo.touch({ userId: 'user1', nickName: 'User One' }, { path: '/api/boards/free/posts' });
  repo.touch({ userId: 'user2', nickName: 'User Two' }, { path: '/api/chat' });
  repo.touch({ userId: 'guest', nickName: 'Guest 1' }, { path: '/home' });
  
  const stats = repo.getStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));
  if (stats.totalConnections !== 3) throw new Error('Expected 3 connections');
  if (stats.activeMembers !== 2) throw new Error('Expected 2 members');
  if (stats.activeGuests !== 1) throw new Error('Expected 1 guest');

  // 3. Test list() and action hint
  const context1 = await buildTrackedContext({ socket: { remoteAddress: '127.0.0.1' } }, null, null, repo, '/api/boards/free/posts/123');
  const list = repo.list();
  console.log('List entry 0:', JSON.stringify(list[0], null, 2));
  if (list[0].action !== 'read_post') throw new Error('Invalid action hint');

  // 4. Test throttled cleanup
  console.log('Waiting for TTL...');
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  // repo.list() triggers cleanup
  const emptyList = repo.list();
  console.log('List after TTL:', emptyList.length);
  if (emptyList.length !== 0) throw new Error('Cleanup failed');

  console.log('--- ActivityRepository Evolution Test Passed! ---');
}

testActivityEvolution().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
