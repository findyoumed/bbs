'use strict';

const fs = require('fs');
const path = require('path');
const { loadEnv, assert } = require('./lib/scriptUtils');
const { createClient } = require('@supabase/supabase-js');
const { createAttachmentRepositoryFromEnv } = require('../src/server/AttachmentRepository');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');
const { createChatRoomRepositoryFromEnv } = require('../src/server/ChatRoomRepository');
const { createMemberRepositoryFromEnv } = require('../src/server/MemberRepository');
const { createMemoRepositoryFromEnv } = require('../src/server/MemoRepository');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');
const {
  applyRuntimeRepositoryMeta,
  createRuntimeRepositoryDiagnostics
} = require('../src/server/RuntimeRepositoryDiagnostics');

const rootDir = path.resolve(__dirname, '..');
const readinessTimeoutMs = Math.max(5000, Number(process.env.READINESS_TIMEOUT_MS) || 45000);

function hasPackage(name) {
  try {
    require.resolve(name, { paths: [rootDir] });
    return true;
  } catch (error) {
    return false;
  }
}

function envStatus(key) {
  const value = process.env[key];
  return { key, present: Boolean(value && String(value).trim()) };
}

function fileStatus(relPath) {
  const absPath = path.join(rootDir, relPath);
  return { path: relPath, present: fs.existsSync(absPath) };
}

function isRequiredEnvKey(key) {
  return key === 'SUPABASE_URL' || key === 'SUPABASE_SERVICE_ROLE_KEY';
}

async function probeBoardRepository(repository) {
  try {
    const boards = await repository.listBoards();
    const plaza = await repository.listPosts('plaza', { page: 1, pageSize: 5 });
    return {
      ok: true,
      boardCount: boards.length,
      plazaTotal: plaza.pagination.totalCount,
      plazaFirstId: plaza.items[0]?.id || null
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function probeMemberRepository(repository) {
  try {
    const guest = await repository.getMember('guest');
    return {
      ok: true,
      memberCount: await repository.countMembers(),
      guestPresent: Boolean(guest)
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function probeMemoRepository(repository) {
  try {
    const memos = await repository.listForUser({
      userId: '00000000-0000-0000-0000-000000000000',
      isAdmin: false
    });
    return {
      ok: true,
      memoCount: Array.isArray(memos) ? memos.length : 0
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function probeAttachmentRepository(repository) {
  try {
    const attachments = await repository.list('plaza', 0);
    return {
      ok: true,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function probeChatRoomRepository(repository) {
  try {
    const rooms = await repository.list();
    return {
      ok: true,
      roomCount: Array.isArray(rooms) ? rooms.length : 0,
      firstRoomId: rooms[0]?.roomId || null
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function probeRssCacheStore(store) {
  if (!store) {
    return {
      ok: true,
      skipped: true,
      reason: 'rss cache store is not configured'
    };
  }

  const cacheKey = `check-rss-cache-${Date.now()}`;
  const payload = {
    probe: true,
    createdAt: new Date().toISOString()
  };

  try {
    const written = await store.set(cacheKey, payload, 60 * 1000);
    const restored = await store.get(cacheKey);
    await store.delete(cacheKey);

    if (!written) {
      throw new Error('rss cache write probe failed');
    }

    if (!restored || restored.probe !== true) {
      throw new Error('rss cache read probe failed');
    }

    return {
      ok: true,
      cacheKey,
      restoredProbe: restored.probe === true
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

async function selectChatProbeAuthUser(client) {
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
    return null;
  }

  return {
    userId: data.id,
    nickName: data.nickname || data.username || data.name || '회원'
  };
}

async function cleanupChatProbeRoom(client, env, roomNo) {
  if (!client || !roomNo) {
    return;
  }

  const roomsTable = env.SUPABASE_CHAT_ROOMS_TABLE || 'chat_rooms';
  const membersTable = env.SUPABASE_CHAT_ROOM_MEMBERS_TABLE || 'chat_room_members';
  const { data: roomRows, error: roomError } = await client
    .from(roomsTable)
    .select('id')
    .eq('room_no', roomNo);

  if (roomError) {
    throw roomError;
  }

  for (const room of roomRows || []) {
    const { error: memberDeleteError } = await client
      .from(membersTable)
      .delete()
      .eq('room_id', room.id);
    if (memberDeleteError) {
      throw memberDeleteError;
    }
  }

  const { error: roomDeleteError } = await client
    .from(roomsTable)
    .delete()
    .eq('room_no', roomNo);

  if (roomDeleteError) {
    throw roomDeleteError;
  }
}

async function probeChatRoomContract(repository, env) {
  const driver = String(repository?.getMeta?.().driver || '').trim().toLowerCase();
  if (driver !== 'supabase' || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: true,
      skipped: true,
      reason: 'chat room contract probe requires supabase driver'
    };
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  const authUser = await selectChatProbeAuthUser(client);
  if (!authUser) {
    return {
      ok: true,
      skipped: true,
      reason: 'profiles table has no auth-backed rows'
    };
  }

  const timestamp = Date.now();
  const sessionAuthA = `check-auth-a-${timestamp}`;
  const sessionAuthB = `check-auth-b-${timestamp}`;
  const sessionGuest = `check-guest-${timestamp}`;
  let roomNo = 0;

  try {
    const created = await repository.create({
      title: `check-chat-${timestamp}`,
      greeting: 'chat contract probe',
      visibility: 'public',
      maxUser: 2
    }, authUser);
    roomNo = Number(created.no || 0);

    const joinedAuthA = await repository.join(roomNo, { sessionKey: sessionAuthA }, authUser);
    const joinedAuthB = await repository.join(roomNo, { sessionKey: sessionAuthB }, authUser);
    const joinedGuest = await repository.join(roomNo, { sessionKey: sessionGuest }, {
      userId: 'guest',
      nickName: '손님'
    });
    const mixedList = await repository.list();
    const mixedRoom = mixedList.find((room) => room.no === roomNo) || null;

    let fullErrorStatus = 0;
    try {
      await repository.join(roomNo, { sessionKey: `check-guest-extra-${timestamp}` }, {
        userId: 'guest-extra',
        nickName: '손님2'
      });
    } catch (error) {
      fullErrorStatus = error?.status || 0;
    }

    const leftAuthA = await repository.leave(roomNo, { sessionKey: sessionAuthA }, authUser);
    const leftAuthB = await repository.leave(roomNo, { sessionKey: sessionAuthB }, authUser);
    const leftGuest = await repository.leave(roomNo, { sessionKey: sessionGuest }, {
      userId: 'guest',
      nickName: '손님'
    });
    const afterLeaveList = await repository.list();

    assert(created.userCount === 0, 'chat contract probe room should start with zero occupancy');
    assert(joinedAuthA.userCount === 1, 'chat contract probe first auth session should consume one occupancy slot');
    assert(joinedAuthA.authUserCount === 1, 'chat contract probe first auth session should increment auth occupancy');
    assert(joinedAuthA.sessionCount === 1, 'chat contract probe first auth session should increment live sessions');

    assert(joinedAuthB.userCount === 1, 'chat contract probe second auth session should not consume another occupancy slot');
    assert(joinedAuthB.authUserCount === 1, 'chat contract probe second auth session should keep auth occupancy at one');
    assert(joinedAuthB.guestSessionCount === 0, 'chat contract probe second auth session should not affect guest occupancy');
    assert(joinedAuthB.sessionCount === 2, 'chat contract probe second auth session should increase live sessions');

    assert(joinedGuest.userCount === 2, 'chat contract probe guest session should consume remaining occupancy slot');
    assert(joinedGuest.authUserCount === 1, 'chat contract probe mixed room should preserve auth occupancy');
    assert(joinedGuest.guestSessionCount === 1, 'chat contract probe mixed room should count guest occupancy separately');
    assert(joinedGuest.sessionCount === 3, 'chat contract probe mixed room should expose total live sessions');
    assert(fullErrorStatus === 409, 'chat contract probe should reject extra occupancy after capacity is full');

    assert(mixedRoom?.userCount === 2, 'chat contract probe list should expose hybrid occupancy');
    assert(mixedRoom?.authUserCount === 1, 'chat contract probe list should expose auth occupancy count');
    assert(mixedRoom?.guestSessionCount === 1, 'chat contract probe list should expose guest occupancy count');
    assert(mixedRoom?.sessionCount === 3, 'chat contract probe list should expose live session count');

    assert(leftAuthA.userCount === 2, 'chat contract probe partial auth leave should keep occupancy');
    assert(leftAuthA.authUserCount === 1, 'chat contract probe partial auth leave should keep auth occupancy');
    assert(leftAuthA.sessionCount === 2, 'chat contract probe partial auth leave should reduce live sessions only');

    assert(leftAuthB.userCount === 1, 'chat contract probe final auth leave should release auth occupancy');
    assert(leftAuthB.authUserCount === 0, 'chat contract probe final auth leave should clear auth occupancy');
    assert(leftAuthB.guestSessionCount === 1, 'chat contract probe guest occupancy should remain after auth leaves');
    assert(leftAuthB.sessionCount === 1, 'chat contract probe guest session should remain as the only live session');

    assert(leftGuest.userCount === 0, 'chat contract probe final guest leave should clear occupancy');
    assert(leftGuest.sessionCount === 0, 'chat contract probe final guest leave should clear live sessions');
    assert(afterLeaveList.some((room) => room.no === roomNo), 'chat contract probe supabase room metadata should persist after leave');

    return {
      ok: true,
      roomNo,
      authUserId: authUser.userId,
      fullErrorStatus,
      mixedOccupancy: mixedRoom?.userCount ?? null,
      mixedAuthUsers: mixedRoom?.authUserCount ?? null,
      mixedGuestSessions: mixedRoom?.guestSessionCount ?? null,
      mixedLiveSessions: mixedRoom?.sessionCount ?? null,
      partialLeaveOccupancy: leftAuthA.userCount,
      finalAuthLeaveOccupancy: leftAuthB.userCount,
      finalGuestLeaveOccupancy: leftGuest.userCount,
      metadataPersistsAfterLeave: afterLeaveList.some((room) => room.no === roomNo),
      contract: {
        authJoinOccupancy: joinedAuthA.userCount,
        authSecondSessionOccupancy: joinedAuthB.userCount,
        authSecondSessionLive: joinedAuthB.sessionCount,
        guestJoinOccupancy: joinedGuest.userCount
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  } finally {
    await cleanupChatProbeRoom(client, env, roomNo);
  }
}

async function main() {
  loadEnv(path.join(rootDir, '.env'));

  const envKeys = [
    'BOARD_REPOSITORY_DRIVER',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_BOARDS_TABLE',
    'SUPABASE_POSTS_TABLE',
    'SUPABASE_MEMBERS_TABLE',
    'SUPABASE_MEMOS_TABLE',
    'SUPABASE_ATTACHMENTS_TABLE',
    'SUPABASE_CHAT_ROOMS_TABLE',
    'SUPABASE_CHAT_ROOM_MEMBERS_TABLE',
    'SUPABASE_RECOMMENDATIONS_TABLE',
    'READINESS_TIMEOUT_MS',
    'RSS_CACHE_DRIVER',
    'RSS_CACHE_TABLE'
  ];

  const files = [
    'server.js',
    'src/server/BoardRepository.js',
    'src/server/AttachmentRepository.js',
    'src/server/ChatRoomRepository.js',
    'src/server/AuthBridge.js',
    'src/server/MenuResolver.js',
    'src/server/createRequestHandler.js',
    'src/server/RssCacheStore.js',
    'supabase/migrations/0001_initial_schema.sql',
    'supabase/migrations/0002_attachment_storage_columns.sql',
    'supabase/migrations/0003_memo_schema_alignment.sql',
    'supabase/migrations/0004_members_table_bootstrap.sql',
    'supabase/migrations/0005_members_attachments_rls.sql',
    'supabase/migrations/0006_security_hardening.sql',
    'supabase/migrations/0007_chat_room_repository_alignment.sql',
    'supabase/migrations/0008_rss_cache.sql'
  ];

  const repository = createBoardRepositoryFromEnv(process.env);
  const memberRepository = createMemberRepositoryFromEnv(process.env);
  const memoRepository = createMemoRepositoryFromEnv(process.env);
  const attachmentRepository = createAttachmentRepositoryFromEnv(rootDir, process.env);
  const chatRoomRepository = createChatRoomRepositoryFromEnv(process.env, { defaultRoom: false });
  const rssCacheStore = createRssCacheStoreFromEnv(process.env);
  const diagnostics = applyRuntimeRepositoryMeta(createRuntimeRepositoryDiagnostics(process.env), {
    board: repository,
    member: memberRepository,
    memo: memoRepository,
    attachment: attachmentRepository,
    chatRooms: chatRoomRepository
  });
  const report = {
    requestedDriver: diagnostics.modeLabel,
    effectiveDriver: repository.getMeta().driver,
    repositoryDrivers: Object.fromEntries(
      Object.entries(diagnostics.repositories).map(([key, entry]) => [key, entry.effectiveDriver || entry.predictedDriver])
    ),
    package: {
      name: '@supabase/supabase-js',
      installed: hasPackage('@supabase/supabase-js')
    },
    env: envKeys.map(envStatus),
    files: files.map(fileStatus),
    diagnostics: {
      warnings: diagnostics.warnings.slice(),
      errors: diagnostics.errors.slice(),
      hasSupabaseConfig: diagnostics.hasSupabaseConfig,
      hasPartialSupabaseConfig: diagnostics.hasPartialSupabaseConfig
    }
  };

  if (report.effectiveDriver === 'supabase' && report.package.installed) {
    report.liveProbe = {
      boards: await probeBoardRepository(repository),
      members: await probeMemberRepository(memberRepository),
      memos: await probeMemoRepository(memoRepository),
      attachments: await probeAttachmentRepository(attachmentRepository),
      chatRooms: await probeChatRoomRepository(chatRoomRepository),
      rssCache: await probeRssCacheStore(rssCacheStore),
      chatRoomContract: await probeChatRoomContract(chatRoomRepository, process.env)
    };
  }

  report.liveReady = !report.liveProbe || Object.values(report.liveProbe).every((probe) => probe.ok);
  if (!report.liveReady && report.liveProbe) {
    report.warnings = Object.entries(report.liveProbe)
      .filter(([, probe]) => !probe.ok)
      .map(([name, probe]) => `${name}: ${probe.error}`);
  }

  report.ok =
    report.package.installed &&
    report.files.every((item) => item.present) &&
    diagnostics.errors.length === 0 &&
    report.liveReady !== false &&
    (report.effectiveDriver !== 'supabase' || report.env.every((item) => item.present || !isRequiredEnvKey(item.key)));

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

const timeoutHandle = setTimeout(() => {
  console.error(JSON.stringify({
    ok: false,
    error: `check-supabase-ready timed out after ${readinessTimeoutMs}ms`,
    timeoutMs: readinessTimeoutMs
  }, null, 2));
  process.exit(1);
}, readinessTimeoutMs);

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    clearTimeout(timeoutHandle);
  });
