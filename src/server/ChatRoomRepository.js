'use strict';

const { MemoryChatRoomRepository } = require('./ChatRoomRepositoryMemory');
const { SupabaseChatRoomRepository } = require('./ChatRoomRepositorySupabase');
const { createHttpError } = require('./ChatRoomRepositoryShared');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createChatRoomRepository(options = {}) {
  return new MemoryChatRoomRepository(options);
}

function createChatRoomRepositoryFromEnv(env = process.env, options = {}) {
  // 채팅방만 자체 오버라이드(CHAT_ROOM_REPOSITORY_DRIVER)를 두고, 없으면 전역
  // BOARD_REPOSITORY_DRIVER로 폴백한다 — 의도된 도메인별 예외라 여기 남겨둔다.
  const requestedDriver = env.CHAT_ROOM_REPOSITORY_DRIVER || env.BOARD_REPOSITORY_DRIVER;

  if (shouldUseSupabaseDriver(requestedDriver, hasSupabaseConfig(env))) {
    return new SupabaseChatRoomRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      table: env.SUPABASE_CHAT_ROOMS_TABLE || 'chat_rooms',
      membersTable: env.SUPABASE_CHAT_ROOM_MEMBERS_TABLE || 'chat_room_members',
      participantTtlMs: options.participantTtlMs,
      roomTtlMs: options.roomTtlMs,
      defaultRoom: options.defaultRoom
    });
  }

  return new MemoryChatRoomRepository(options);
}

module.exports = {
  MemoryChatRoomRepository,
  SupabaseChatRoomRepository,
  createChatRoomRepository,
  createChatRoomRepositoryFromEnv,
  createHttpError
};
