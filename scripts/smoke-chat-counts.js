'use strict';

const { MemoryChatRoomRepository } = require('../src/server/ChatRoomRepositoryMemory');
const { assert } = require('./lib/scriptUtils');

async function main() {
  const repository = new MemoryChatRoomRepository({ defaultRoom: false });
  const authUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    nickName: '회원'
  };
  const guestUser = {
    userId: 'guest',
    nickName: '손님'
  };

  const created = repository.create({
    title: 'count-room',
    greeting: 'count contract smoke',
    visibility: 'public',
    maxUser: 2
  }, authUser);

  const authJoinA = repository.join(created.no, { sessionKey: 'auth-session-1' }, authUser);
  const authJoinB = repository.join(created.no, { sessionKey: 'auth-session-2' }, authUser);
  const guestJoin = repository.join(created.no, { sessionKey: 'guest-session-1' }, guestUser);
  const listedMixed = repository.list();
  const fetchedMixed = repository.get(created.no);
  let invalidSessionStatus = 0;
  try {
    repository.join(created.no, { sessionKey: 'guest session 3' }, guestUser);
  } catch (error) {
    invalidSessionStatus = error?.status || 0;
  }

  let fullErrorStatus = 0;
  try {
    repository.join(created.no, { sessionKey: 'guest-session-2' }, {
      userId: 'guest-2',
      nickName: '손님2'
    });
  } catch (error) {
    fullErrorStatus = error?.status || 0;
  }

  const leaveAuthA = repository.leave(created.no, { sessionKey: 'auth-session-1' });
  const leaveAuthB = repository.leave(created.no, { sessionKey: 'auth-session-2' });
  const leaveGuest = repository.leave(created.no, { sessionKey: 'guest-session-1' });
  const afterAllLeave = repository.list();

  assert(created.userCount === 0, 'created room should start with zero occupancy');
  assert(authJoinA.userCount === 1, 'first auth session should consume one occupancy slot');
  assert(authJoinA.authUserCount === 1, 'first auth session should increment auth occupancy count');
  assert(authJoinA.guestSessionCount === 0, 'first auth session should not increment guest session count');
  assert(authJoinA.sessionCount === 1, 'first auth session should increment session count');

  assert(authJoinB.userCount === 1, 'second session of same auth user should not consume another occupancy slot');
  assert(authJoinB.authUserCount === 1, 'same auth user should stay counted once');
  assert(authJoinB.guestSessionCount === 0, 'same auth user second session should not affect guest count');
  assert(authJoinB.sessionCount === 2, 'same auth user second session should increment session count');

  assert(guestJoin.userCount === 2, 'guest session should consume its own occupancy slot');
  assert(guestJoin.authUserCount === 1, 'mixed room should preserve auth occupancy count');
  assert(guestJoin.guestSessionCount === 1, 'mixed room should count guest sessions separately');
  assert(guestJoin.sessionCount === 3, 'mixed room should expose total live sessions');
  assert(guestJoin.countMode === 'hybrid-occupancy', 'mixed room should expose hybrid occupancy mode');

  assert(fullErrorStatus === 409, 'room should reject extra occupancy once hybrid capacity is full');
  assert(invalidSessionStatus === 400, 'room should reject malformed session keys');
  assert(listedMixed.some((room) => room.no === created.no && room.userCount === 2 && room.authUserCount === 1 && room.guestSessionCount === 1 && room.sessionCount === 3), 'list should expose mixed occupancy summary');
  assert(fetchedMixed.userCount === 2 && fetchedMixed.authUserCount === 1 && fetchedMixed.guestSessionCount === 1 && fetchedMixed.sessionCount === 3, 'get should expose mixed occupancy summary');

  assert(leaveAuthA.userCount === 2, 'leaving one auth session should keep occupancy while another auth session remains');
  assert(leaveAuthA.authUserCount === 1, 'leaving one auth session should keep auth occupancy count');
  assert(leaveAuthA.sessionCount === 2, 'leaving one auth session should reduce live sessions only');

  assert(leaveAuthB.userCount === 1, 'leaving the last auth session should release one occupancy slot');
  assert(leaveAuthB.authUserCount === 0, 'leaving the last auth session should clear auth occupancy count');
  assert(leaveAuthB.guestSessionCount === 1, 'guest occupancy should remain after auth leaves');
  assert(leaveAuthB.sessionCount === 1, 'guest session should remain as the only live session');

  assert(leaveGuest.userCount === 0, 'leaving the last guest should clear occupancy');
  assert(leaveGuest.sessionCount === 0, 'leaving the last guest should clear live sessions');
  assert(afterAllLeave.length === 0, 'empty ephemeral room should be removed after all sessions leave');

  console.log(JSON.stringify({
    ok: true,
    createdRoomNo: created.no,
    fullErrorStatus,
    listedMixedCount: listedMixed.length,
    finalRoomCount: afterAllLeave.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
