'use strict';

// [LOG_ID: 20260719_1600] 토론의 광장(CONF) 저장소 팩토리 — env 기반 Supabase/Memory 분기.
const { MemoryConfRepository } = require('./ConfRepositoryMemory');
const { SupabaseConfRepository } = require('./ConfRepositorySupabase');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

function createConfRepositoryFromEnv(env = {}) {
  if (shouldUseSupabaseDriver(env.BOARD_REPOSITORY_DRIVER, hasSupabaseConfig(env))) {
    return new SupabaseConfRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
    });
  }
  return new MemoryConfRepository();
}

module.exports = {
  MemoryConfRepository,
  SupabaseConfRepository,
  createConfRepositoryFromEnv
};
