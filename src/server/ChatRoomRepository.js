'use strict';

const { MemoryChatRoomRepository } = require('./ChatRoomRepositoryMemory');
const { SupabaseChatRoomRepository } = require('./ChatRoomRepositorySupabase');
const { createHttpError } = require('./ChatRoomRepositoryShared');

function createChatRoomRepository(options = {}) {
  return new MemoryChatRoomRepository(options);
}

function createChatRoomRepositoryFromEnv(env = process.env, options = {}) {
  const requestedDriver = String(env.CHAT_ROOM_REPOSITORY_DRIVER || env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase) {
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
