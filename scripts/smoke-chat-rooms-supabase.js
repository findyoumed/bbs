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
  const sessionOwner = `smoke-owner-${Date.now()}`;
  const sessionParticipant = `smoke-participant-${Date.now()}`;

  try {
    // Owner joins first to lock ownerSessionKey
    const joinedOwner = await repository.join(created.no, {
      sessionKey: sessionOwner,
      password: '1234'
    }, {
      userId: 'guest',
      nickName: '손님'
    });

    // Participant joins next
    const joinedParticipant = await repository.join(created.no, {
      sessionKey: sessionParticipant,
      password: '1234'
    }, {
      userId: 'guest',
      nickName: '손님'
    });

    const afterJoin = await repository.list();

    // Participant leaves (room should remain)
    const leftParticipant = await repository.leave(created.no, { sessionKey: sessionParticipant });
    const afterParticipantLeave = await repository.list();

    // Owner/Host leaves (room should be auto-closed)
    const leftOwner = await repository.leave(created.no, { sessionKey: sessionOwner });
    const afterOwnerLeave = await repository.list();

    assert(created.no > 0, 'created room should expose room number');
    assert(created.roomId.startsWith('room-') || created.roomId === 'lobby', 'created room should expose public room key');
    assert(created.requiresPassword === true, 'created room should require password');
    
    assert(joinedOwner.userCount === 1, 'owner join should report 1 user');
    assert(joinedParticipant.userCount === 2, 'participant join should report 2 users');
    assert(joinedParticipant.guestSessionCount === 2, 'two guest sessions should be recorded');
    
    assert(leftParticipant.userCount === 1, 'participant leave should leave 1 user');

    assert(afterJoin.some((room) => room.no === created.no), 'created room should be present in supabase-backed list');
    assert(afterParticipantLeave.some((room) => room.no === created.no), 'room should persist after non-owner leaves');
    assert(!afterOwnerLeave.some((room) => room.no === created.no), 'room should be auto-deleted after owner leaves');

    // Verify listMessages throws a 404 for the closed room
    let throwCheck = false;
    try {
      await repository.listMessages(created.no);
    } catch (e) {
      if (e.status === 404) {
        throwCheck = true;
      }
    }
    assert(throwCheck, 'listMessages on deleted room should throw a 404 error');

    console.log(JSON.stringify({
      ok: true,
      driver: repository.getMeta().driver,
      beforeCount: before.length,
      createdRoomNo: created.no,
      createdRoomId: created.roomId,
      afterJoinCount: afterJoin.length,
      afterParticipantLeaveCount: afterParticipantLeave.length,
      afterOwnerLeaveCount: afterOwnerLeave.length
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
