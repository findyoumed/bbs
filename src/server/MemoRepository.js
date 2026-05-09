'use strict';

const { MemoryMemoRepository } = require('./MemoRepositoryMemory');
const { SupabaseMemoRepository } = require('./MemoRepositorySupabase');
const { createHttpError } = require('./MemoRepositoryShared');

function createMemoRepositoryFromEnv(env = {}) {
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase) {
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
