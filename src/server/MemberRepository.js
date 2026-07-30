'use strict';

const { MemoryMemberRepository } = require('./MemberRepositoryMemory');
const { SupabaseMemberRepository } = require('./MemberRepositorySupabase');
const {
  createHttpError,
  isMissingMembersTableError
} = require('./MemberRepositoryShared');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createMemberRepositoryFromEnv(env = {}) {
  if (shouldUseSupabaseDriver(env.BOARD_REPOSITORY_DRIVER, hasSupabaseConfig(env))) {
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
