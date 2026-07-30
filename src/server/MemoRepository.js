'use strict';

const { MemoryMemoRepository } = require('./MemoRepositoryMemory');
const { SupabaseMemoRepository } = require('./MemoRepositorySupabase');
const { createHttpError } = require('./MemoRepositoryShared');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createMemoRepositoryFromEnv(env = {}) {
  if (shouldUseSupabaseDriver(env.BOARD_REPOSITORY_DRIVER, hasSupabaseConfig(env))) {
    return new SupabaseMemoRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      table: env.SUPABASE_MEMOS_TABLE || 'memos'
    });
  }
  return new MemoryMemoRepository();
}

module.exports = {
  MemoryMemoRepository,
  SupabaseMemoRepository,
  createMemoRepositoryFromEnv,
  createHttpError
};
