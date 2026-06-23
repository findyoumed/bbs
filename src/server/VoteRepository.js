'use strict';

// [LOG: 20260622_2301] VoteRepository 팩토리 파일 구현
const { MemoryVoteRepository } = require('./VoteRepositoryMemory');
const { SupabaseVoteRepository } = require('./VoteRepositorySupabase');

function createVoteRepositoryFromEnv(env = {}) {
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase) {
    return new SupabaseVoteRepository({
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
