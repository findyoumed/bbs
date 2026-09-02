'use strict';

const logger = require('./logger');
const { MemoryBoardRepository } = require('./MemoryBoardRepository');
const { SupabaseBoardRepository } = require('./SupabaseBoardRepository');
const { MemoryMemberRepository } = require('./MemberRepositoryMemory');
const { SupabaseMemberRepository } = require('./MemberRepositorySupabase');
const { MemoryChatRoomRepository } = require('./ChatRoomRepositoryMemory');
const { SupabaseChatRoomRepository } = require('./ChatRoomRepositorySupabase');
const { MemoryMemoRepository } = require('./MemoRepositoryMemory');
const { SupabaseMemoRepository } = require('./MemoRepositorySupabase');
const { AttachmentRepository: LocalAttachmentRepository } = require('./AttachmentRepositoryLocal');
const { SupabaseAttachmentRepository } = require('./AttachmentRepositorySupabase');
const { createActivityRepository } = require('./ActivityRepository');
const ActivityRepositorySupabase = require('./ActivityRepositorySupabase');
// [LOG: 20260623_0013] origin/main에서 vote 시스템 포팅
const { createVoteRepositoryFromEnv } = require('./VoteRepository');
// [LOG_ID: 20260719_1600] 토론의 광장(CONF) 시스템
const { createConfRepositoryFromEnv } = require('./ConfRepository');
const { resolveLegacyPaths } = require('./projectPaths');
const { hasSupabaseConfig, shouldUseSupabaseDriver } = require('./RepositoryDriverSelection');

/**
 * [LOG: 20260426_1455] Evolution: Centralized RepositoryRegistry for standardized repository creation and health monitoring.
 */
class RepositoryRegistry {
  constructor(env = process.env, rootDir = process.cwd()) {
    this.env = env;
    this.rootDir = rootDir;
    this.repositories = new Map();
    this.hasSupabase = hasSupabaseConfig(env);
    this.requestedDriver = env.BOARD_REPOSITORY_DRIVER;
  }

  /**
   * Determine if Supabase driver should be used based on config and request.
   */
  shouldUseSupabase() {
    return shouldUseSupabaseDriver(this.requestedDriver, this.hasSupabase);
  }

  /**
   * Create and register all repositories.
   */
  initialize(options = {}) {
    const useSupabase = this.shouldUseSupabase();
    const legacyPaths = resolveLegacyPaths(this.env, this.rootDir);

    logger.info(`Initializing repositories using ${useSupabase ? 'Supabase' : 'Memory/Local'} driver...`, {
      component: 'RepositoryRegistry'
    });

    // [LOG_ID: 20260901_0635] Server repositories require the service-role key. Publishable/anon keys
    // remain client-only credentials and must not be used as a DB fallback.
    const supabaseKey = this.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Board Repository
    if (useSupabase) {
      this.register('board', new SupabaseBoardRepository({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        menuFilePath: legacyPaths.menuFilePath,
        levelAliases: options.levelAliases,
        boardsTable: this.env.SUPABASE_BOARDS_TABLE,
        postsTable: this.env.SUPABASE_POSTS_TABLE,
        recommendationsTable: this.env.SUPABASE_RECOMMENDATIONS_TABLE
      }));
    } else {
      this.register('board', new MemoryBoardRepository({
        menuFilePath: legacyPaths.menuFilePath,
        levelAliases: options.levelAliases
      }));
    }

    // 2. Member Repository
    if (useSupabase) {
      this.register('member', new SupabaseMemberRepository({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        table: this.env.SUPABASE_MEMBERS_TABLE || 'members'
      }));
    } else {
      this.register('member', new MemoryMemberRepository());
    }

    // 3. ChatRoom Repository
    if (useSupabase) {
      this.register('chatRooms', new SupabaseChatRoomRepository({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        table: this.env.SUPABASE_CHAT_ROOMS_TABLE || 'chat_rooms',
        membersTable: this.env.SUPABASE_CHAT_ROOM_MEMBERS_TABLE || 'chat_room_members',
        participantTtlMs: options.chatOptions?.participantTtlMs,
        roomTtlMs: options.chatOptions?.roomTtlMs,
        defaultRoom: options.chatOptions?.defaultRoom
      }));
    } else {
      this.register('chatRooms', new MemoryChatRoomRepository(options.chatOptions));
    }

    // 4. Memo Repository
    if (useSupabase) {
      this.register('memo', new SupabaseMemoRepository({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        table: this.env.SUPABASE_MEMOS_TABLE || 'memos'
      }));
    } else {
      this.register('memo', new MemoryMemoRepository());
    }

    // 5. Attachment Repository
    if (useSupabase && !options.attachmentOptions?.baseDir) {
      this.register('attachment', new SupabaseAttachmentRepository({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        table: this.env.SUPABASE_ATTACHMENTS_TABLE || 'attachments',
        maxBytes: options.attachmentOptions?.maxBytes
      }));
    } else {
      this.register('attachment', new LocalAttachmentRepository(this.rootDir, options.attachmentOptions));
    }

    // 6. Activity Repository
    const activityDriver = String(this.env.ACTIVITY_REPOSITORY_DRIVER || (useSupabase ? 'supabase' : 'memory')).trim().toLowerCase();

    if (activityDriver === 'supabase' && useSupabase) {
      this.register('activity', new ActivityRepositorySupabase({
        env: this.env,
        url: this.env.SUPABASE_URL,
        serviceRoleKey: supabaseKey,
        table: this.env.SUPABASE_ACTIVITY_TABLE || 'user_activities',
        ttlMs: options.activityOptions?.ttlMs
      }));
    } else {
      this.register('activity', createActivityRepository(options.activityOptions));
    }

    // 7. Vote Repository [LOG: 20260623_0013] env 기반 Supabase/Memory 분기 (origin/main 포팅)
    this.register('vote', createVoteRepositoryFromEnv(this.env));
    // 8. Conf Repository [LOG_ID: 20260719_1600] 토론의 광장
    this.register('conf', createConfRepositoryFromEnv(this.env));

    return this.repositories;
  }

  register(name, instance) {
    this.repositories.set(name, instance);
    return instance;
  }

  get(name) {
    return this.repositories.get(name);
  }

  async checkAllHealth() {
    const results = {};
    const timeoutMs = Number(this.env.HEALTH_CHECK_TIMEOUT_MS) > 0
      ? Math.min(10000, Math.max(500, Number(this.env.HEALTH_CHECK_TIMEOUT_MS)))
      : 3000;
    for (const [name, repo] of this.repositories.entries()) {
      const startedAt = Date.now();
      if (typeof repo.checkHealth === 'function') {
        try {
          const healthPromise = Promise.resolve()
            .then(() => repo.checkHealth())
            .catch((error) => ({ status: 'error', message: error?.message || 'Health check failed' }));
          let timer;
          const timeoutResult = new Promise((resolve) => {
            timer = setTimeout(() => resolve({
              status: 'timeout',
              errorClass: 'timeout',
              message: `Health check exceeded ${timeoutMs}ms`
            }), timeoutMs);
          });
          results[name] = await Promise.race([healthPromise, timeoutResult]);
          clearTimeout(timer);
        } catch (error) {
          results[name] = { status: 'error', message: error?.message || 'Health check failed' };
        }
      } else {
        results[name] = { status: 'unknown', message: 'No health check implemented' };
      }
      results[name] = sanitizeHealthResult(results[name]);
      results[name].latencyMs = Math.max(0, Date.now() - startedAt);
    }
    return results;
  }

  async closeAll() {
    logger.info('Closing all repositories...', { component: 'RepositoryRegistry' });
    const closures = [];
    for (const [name, repo] of this.repositories.entries()) {
      if (typeof repo.close === 'function') {
        closures.push(
          repo.close()
            .then(() => logger.info(`Closed repository: ${name}`))
            .catch(err => logger.error(`Error closing repository ${name}: ${err.message}`))
        );
      }
    }
    await Promise.allSettled(closures);
  }

  getAllMeta() {
    const meta = {};
    for (const [name, repo] of this.repositories.entries()) {
      if (typeof repo.getMeta === 'function') {
        meta[name] = repo.getMeta();
      }
    }
    return meta;
  }
}

function sanitizeHealthResult(result = {}) {
  const normalized = { ...result };
  if (normalized.status === 'ok') return normalized;

  const status = String(normalized.status || 'error').toLowerCase();
  normalized.errorClass = normalized.errorClass || (status === 'timeout' ? 'timeout' : 'unavailable');
  normalized.retryable = true;
  // `/api/health` is public; do not expose upstream Supabase messages or
  // connection details that may contain infrastructure identifiers.
  delete normalized.message;
  delete normalized.detail;
  return normalized;
}

module.exports = RepositoryRegistry;
