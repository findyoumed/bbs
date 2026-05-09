'use strict';

const path = require('path');
const { loadEnv, assert } = require('./lib/scriptUtils');
const { createClient } = require('@supabase/supabase-js');
const { createChatRoomRepositoryFromEnv } = require('../src/server/ChatRoomRepository');

async function selectFirstProfile(client) {
  const { data, error } = await client
    .from('profiles')
    .select('id, nickname, username, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('profiles table should contain at least one auth-backed user');
  }

  return {
    userId: data.id,
    nickName: data.nickname || data.username || data.name || '회원'
  };
}

async function listActiveMemberRows(client, membersTable, roomId, userId) {
  const { data, error } = await client
    .from(membersTable)
    .select('id, nickname, left_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .is('left_at', null)
    .order('joined_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  loadEnv(path.join(rootDir, '.env'));

  const repository = createChatRoomRepositoryFromEnv(process.env, { defaultRoom: false });
  assert(repository.getMeta().driver === 'supabase', 'chat room repository should resolve to supabase');

  const roomsTable = process.env.SUPABASE_CHAT_ROOMS_TABLE || 'chat_rooms';
  const membersTable = process.env.SUPABASE_CHAT_ROOM_MEMBERS_TABLE || 'chat_room_members';
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  const authUser = await selectFirstProfile(client);
  const roomTitle = `member-room-${Date.now()}`;
  const sessionKeyA = `member-session-a-${Date.now()}`;
  const sessionKeyB = `member-session-b-${Date.now()}`;
  const guestSessionKey = `guest-session-${Date.now()}`;
  let roomRow = null;

  const created = await repository.create({
    title: roomTitle,
    greeting: 'Supabase auth member persistence smoke',
    visibility: 'public',
    maxUser: 2
  }, authUser);

  try {
    const { data: fetchedRoom, error: roomError } = await client
      .from(roomsTable)
      .select('id, room_no')
      .eq('room_no', created.no)
      .maybeSingle();

    if (roomError) {
      throw roomError;
    }
    roomRow = fetchedRoom;
    assert(roomRow?.id, 'created room row should be queryable by room_no');

    const joinedA = await repository.join(created.no, { sessionKey: sessionKeyA }, authUser);
    const joinedB = await repository.join(created.no, { sessionKey: sessionKeyB }, authUser);
    const joinedGuest = await repository.join(created.no, {
      sessionKey: guestSessionKey
    }, {
      userId: 'guest',
      nickName: '손님'
    });

    const activeAfterJoin = await listActiveMemberRows(client, membersTable, roomRow.id, authUser.userId);
    const joinedMember = activeAfterJoin[0] || null;

    assert(joinedMember?.id, 'auth member join should create or refresh an active chat_room_members row');
    assert(joinedMember.nickname === authUser.nickName, 'persisted member nickname should match auth context');
    assert(activeAfterJoin.length === 1, 'same auth user should keep a single active chat_room_members row across sessions');

    let fullErrorStatus = 0;
    try {
      await repository.join(created.no, { sessionKey: `guest-session-extra-${Date.now()}` }, {
        userId: 'guest-extra',
        nickName: '손님2'
      });
    } catch (error) {
      fullErrorStatus = error?.status || 0;
    }

    const leftA = await repository.leave(created.no, { sessionKey: sessionKeyA }, authUser);
    const activeAfterPartialLeave = await listActiveMemberRows(client, membersTable, roomRow.id, authUser.userId);
    const leftB = await repository.leave(created.no, { sessionKey: sessionKeyB }, authUser);
    const leftGuest = await repository.leave(created.no, { sessionKey: guestSessionKey }, {
      userId: 'guest',
      nickName: '손님'
    });

    const activeRows = await listActiveMemberRows(client, membersTable, roomRow.id, authUser.userId);

    const { data: latestRow, error: latestError } = await client
      .from(membersTable)
      .select('left_at')
      .eq('room_id', roomRow.id)
      .eq('user_id', authUser.userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    assert(joinedA.userCount === 1, 'auth join should increment hybrid occupancy count');
    assert(joinedA.authUserCount === 1, 'auth join should increment auth occupancy count');
    assert(joinedA.guestSessionCount === 0, 'auth join should not increment guest session count');
    assert(joinedA.sessionCount === 1, 'auth join should increment session count');

    assert(joinedB.userCount === 1, 'same auth user second session should not increment occupancy count');
    assert(joinedB.authUserCount === 1, 'same auth user second session should keep auth occupancy count at one');
    assert(joinedB.guestSessionCount === 0, 'same auth user second session should not affect guest count');
    assert(joinedB.sessionCount === 2, 'same auth user second session should increment live session count');

    assert(joinedGuest.userCount === 2, 'guest join should consume the remaining occupancy slot');
    assert(joinedGuest.authUserCount === 1, 'mixed room should preserve auth occupancy count');
    assert(joinedGuest.guestSessionCount === 1, 'mixed room should count guest session occupancy');
    assert(joinedGuest.sessionCount === 3, 'mixed room should expose total live sessions');
    assert(fullErrorStatus === 409, 'extra guest should be rejected once hybrid occupancy reaches capacity');

    assert(leftA.userCount === 2, 'leaving one auth session should keep occupancy while another auth session remains');
    assert(leftA.authUserCount === 1, 'partial auth leave should keep auth occupancy count');
    assert(leftA.guestSessionCount === 1, 'partial auth leave should keep guest occupancy count');
    assert(leftA.sessionCount === 2, 'partial auth leave should reduce live sessions only');
    assert(activeAfterPartialLeave.length === 1, 'partial auth leave should keep the active member row open');

    assert(leftB.userCount === 1, 'leaving the last auth session should release auth occupancy');
    assert(leftB.authUserCount === 0, 'leaving the last auth session should clear auth occupancy count');
    assert(leftB.guestSessionCount === 1, 'guest occupancy should remain after auth leaves');
    assert(leftB.sessionCount === 1, 'guest session should remain as the only live session');

    assert(leftGuest.userCount === 0, 'leaving the last guest should clear occupancy');
    assert(leftGuest.guestSessionCount === 0, 'leaving the last guest should clear guest occupancy count');
    assert(leftGuest.sessionCount === 0, 'leaving the last guest should clear live sessions');

    assert(Array.isArray(activeRows) && activeRows.length === 0, 'leave should clear active auth member rows');
    assert(latestRow?.left_at, 'leave should stamp left_at on the latest auth member row');

    console.log(JSON.stringify({
      ok: true,
      roomNo: created.no,
      roomId: created.roomId,
      authUserId: authUser.userId,
      membersTable,
      fullErrorStatus
    }, null, 2));
  } finally {
    if (roomRow?.id) {
      await client.from(membersTable).delete().eq('room_id', roomRow.id);
    }
    await client.from(roomsTable).delete().eq('room_no', created.no);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
