'use strict';

const assert = require('assert');
const { MemoryMemberRepository } = require('../../../../src/server/MemberRepositoryMemory');

async function testMemberEvolution() {
  console.log('--- Testing Member Repository Evolution (Sorting/Filtering) ---');
  
  const repo = new MemoryMemberRepository();
  
  // Setup data
  await repo.ensureMember({ userId: 'user1', nickName: 'Alpha', level: 1 });
  await repo.ensureMember({ userId: 'user2', nickName: 'Gamma', level: 2 });
  await repo.ensureMember({ userId: 'user3', nickName: 'Beta', level: 1 });
  
  // Test Filtering by level
  const filtered = await repo.listMembers({ level: 1 });
  assert.strictEqual(filtered.totalCount, 2);
  assert.strictEqual(filtered.items.length, 2);
  assert(filtered.items.every(m => m.level === 1));
  console.log('✅ Level filtering passed');

  // Test Search
  const searched = await repo.listMembers({ search: 'am' }); // G-am-ma
  assert.strictEqual(searched.items.length, 1);
  assert.strictEqual(searched.items[0].userId, 'user2');
  console.log('✅ Search filtering passed');

  // Test Sorting (nickName asc)
  const sortedAsc = await repo.listMembers({ orderBy: 'nickName', orderDirection: 'asc' });
  // sysop(시스옵), user1(Alpha), user3(Beta), user2(Gamma)
  // alphabetical: Alpha, Beta, Gamma, 시스옵 (depending on locale, but Alpha < Beta < Gamma)
  const names = sortedAsc.items.map(m => m.nickName);
  assert(names.indexOf('Alpha') < names.indexOf('Beta'));
  assert(names.indexOf('Beta') < names.indexOf('Gamma'));
  console.log('✅ Ascending sorting passed');

  // Test Sorting (nickName desc)
  const sortedDesc = await repo.listMembers({ orderBy: 'nickName', orderDirection: 'desc' });
  const namesDesc = sortedDesc.items.map(m => m.nickName);
  assert(namesDesc.indexOf('Gamma') < namesDesc.indexOf('Beta'));
  assert(namesDesc.indexOf('Beta') < namesDesc.indexOf('Alpha'));
  console.log('✅ Descending sorting passed');

  console.log('--- Member Evolution Tests Passed ---');
}

module.exports = testMemberEvolution();
