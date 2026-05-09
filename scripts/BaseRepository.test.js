'use strict';

const assert = require('assert').strict;
const BaseRepository = require('../src/server/BaseRepository');

async function testBaseRepository() {
  console.log('--- Testing BaseRepository ---');

  // Test construction and metadata
  const repo = new BaseRepository({ driverName: 'test-driver' });
  const meta = repo.getMeta();
  
  assert.strictEqual(meta.driver, 'test-driver');
  assert.strictEqual(meta.ready, true);
  assert.ok(meta.timestamp);
  console.log('✅ BaseRepository metadata passed');

  // Test error handling (missing table)
  try {
    repo._throwError('Action', { message: 'relation "test_table" does not exist' }, { table: 'test_table' });
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.strictEqual(err.status, 502);
    assert.ok(err.message.includes('데이터 테이블(test_table)을 찾을 수 없습니다'));
    console.log('✅ Missing table error translation passed');
  }

  // Test error handling (conflict)
  try {
    repo._throwError('Action', { code: '23505', message: 'duplicate key' });
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.strictEqual(err.status, 409);
    assert.ok(err.message.includes('중복된 데이터가 발견되었습니다'));
    console.log('✅ Conflict error translation passed');
  }

  // Test default error
  try {
    repo._throwError('Action', { message: 'Some weird error' });
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.strictEqual(err.status, 502);
    assert.ok(err.message.includes('Action 중 오류가 발생했습니다'));
    console.log('✅ Default error handling passed');
  }

  console.log('--- BaseRepository Tests Passed ---');
}

testBaseRepository().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
