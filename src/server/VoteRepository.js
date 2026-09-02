'use strict';

// [LOG: 20260622_2301] VoteRepository 팩토리 파일 구현
const { MemoryVoteRepository } = require('./VoteRepositoryMemory');
const { SupabaseVoteRepository } = require('./VoteRepositorySupabase');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createVoteRepositoryFromEnv(env = {}) {
  if (shouldUseSupabaseDriver(env.BOARD_REPOSITORY_DRIVER, hasSupabaseConfig(env))) {
    return new SupabaseVoteRepository({
      env,
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      table: env.SUPABASE_VOTES_TABLE || 'votes',
      recordsTable: env.SUPABASE_VOTE_RECORDS_TABLE || 'vote_records'
    });
  }
  return new MemoryVoteRepository();
}

module.exports = {
  MemoryVoteRepository,
  SupabaseVoteRepository,
  createVoteRepositoryFromEnv
};
