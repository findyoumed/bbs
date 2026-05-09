'use strict';

const { MemoryMemberRepository } = require('./MemberRepositoryMemory');
const { SupabaseMemberRepository } = require('./MemberRepositorySupabase');
const {
  createHttpError,
  isMissingMembersTableError
} = require('./MemberRepositoryShared');

function createMemberRepositoryFromEnv(env = {}) {
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase) {
    return new SupabaseMemberRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      table: env.SUPABASE_MEMBERS_TABLE || 'members'
    });
  }
  return new MemoryMemberRepository();
}

module.exports = {
  MemoryMemberRepository,
  SupabaseMemberRepository,
  createMemberRepositoryFromEnv,
  createHttpError,
  isMissingMembersTableError
};
