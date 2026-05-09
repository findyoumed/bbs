'use strict';

const logger = require('./logger');
const { MemoryBoardRepository } = require('./MemoryBoardRepository');
const { SupabaseBoardRepository } = require('./SupabaseBoardRepository');
const { createHttpError } = require('./BoardRepositoryShared');
const { resolveLegacyPaths } = require('./projectPaths');

function createBoardRepositoryFromEnv(env = process.env, options = {}) {
  const requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  const hasSupabaseConfig = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const menuFilePath = resolveLegacyPaths(env).menuFilePath;

  try {
    if ((requestedDriver === 'supabase' || (!requestedDriver && hasSupabaseConfig)) && hasSupabaseConfig) {
      logger.info('Initializing Supabase driver...', { component: 'BoardRepository' });
      return new SupabaseBoardRepository({
        url: env.SUPABASE_URL,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        menuFilePath,
        levelAliases: options.levelAliases,
        boardsTable: env.SUPABASE_BOARDS_TABLE,
        postsTable: env.SUPABASE_POSTS_TABLE,
        recommendationsTable: env.SUPABASE_RECOMMENDATIONS_TABLE
      });
    }

    logger.info('Initializing Memory driver...', { component: 'BoardRepository' });
    return new MemoryBoardRepository({
      menuFilePath,
      levelAliases: options.levelAliases
    });
  } catch (error) {
    logger.error('Failed to initialize repository driver:', { component: 'BoardRepository', error: error.message });
    // Fallback to memory even if it might fail later, but with a warning
    return new MemoryBoardRepository({
      menuFilePath,
      levelAliases: options.levelAliases
    });
  }
}

module.exports = {
  createBoardRepositoryFromEnv,
  MemoryBoardRepository,
  SupabaseBoardRepository,
  createHttpError
};
