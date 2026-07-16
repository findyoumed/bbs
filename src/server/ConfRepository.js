'use strict';

// [LOG_ID: 20260719_1600] 토론의 광장(CONF) 저장소 팩토리 — env 기반 Supabase/Memory 분기.
const { MemoryConfRepository } = require('./ConfRepositoryMemory');
const { SupabaseConfRepository } = require('./ConfRepositorySupabase');

function createConfRepositoryFromEnv(env = {}) {
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabase)) && hasSupabase) {
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
