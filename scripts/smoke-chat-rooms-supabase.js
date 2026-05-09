'use strict';

const path = require('path');
const { loadEnv, assert } = require('./lib/scriptUtils');
const { createClient } = require('@supabase/supabase-js');
const { createChatRoomRepositoryFromEnv } = require('../src/server/ChatRoomRepository');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  loadEnv(path.join(rootDir, '.env'));

  const repository = createChatRoomRepositoryFromEnv(process.env, { defaultRoom: false });
  assert(repository.getMeta().driver === 'supabase', 'chat room repository should resolve to supabase');

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  const tempName = `smoke-room-${Date.now()}`;

  const before = await repository.list();
  const created = await repository.create({
    title: tempName,
    greeting: 'Supabase room metadata smoke',
    visibility: 'private',
    password: '1234',
    maxUser: 3
  }, {
    userId: 'guest',
    nickName: '손님'
  });
  const sessionKey = `smoke-session-${Date.now()}`;

  try {
    const joined = await repository.join(created.no, {
      sessionKey,
      password: '1234'
    }, {
      userId: 'guest',
      nickName: '손님'
    });
    const afterJoin = await repository.list();
    const left = await repository.leave(created.no, { sessionKey });
    const afterLeave = await repository.list();

    assert(created.no > 0, 'created room should expose room number');
    assert(created.roomId.startsWith('room-') || created.roomId === 'lobby', 'created room should expose public room key');
    assert(created.requiresPassword === true, 'created room should require password');
    assert(joined.userCount === 1, 'joined room should report hybrid occupancy count');
    assert(joined.authUserCount === 0, 'guest join should not increment auth occupancy');
    assert(joined.guestSessionCount === 1, 'guest join should increment guest session count');
    assert(joined.sessionCount === 1, 'guest join should increment session count');
    assert(joined.countMode === 'hybrid-occupancy', 'joined room should expose hybrid occupancy mode');
    assert(left.userCount === 0, 'leave should clear hybrid occupancy count');
    assert(left.guestSessionCount === 0, 'leave should clear guest session count');
    assert(left.sessionCount === 0, 'leave should clear session count');
    assert(afterJoin.some((room) => room.no === created.no), 'created room should be present in supabase-backed list');
    assert(afterLeave.some((room) => room.no === created.no), 'room metadata should persist after leave');

    console.log(JSON.stringify({
      ok: true,
      driver: repository.getMeta().driver,
      beforeCount: before.length,
      createdRoomNo: created.no,
      createdRoomId: created.roomId,
      afterJoinCount: afterJoin.length,
      afterLeaveCount: afterLeave.length
    }, null, 2));
  } finally {
    await client
      .from(process.env.SUPABASE_CHAT_ROOMS_TABLE || 'chat_rooms')
      .delete()
      .eq('room_no', created.no);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
