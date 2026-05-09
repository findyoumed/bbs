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
const { resolveLegacyPaths } = require('./projectPaths');

/**
 * [LOG: 20260426_1455] Evolution: Centralized RepositoryRegistry for standardized repository creation and health monitoring.
 */
class RepositoryRegistry {
  constructor(env = process.env, rootDir = process.cwd()) {
    this.env = env;
    this.rootDir = rootDir;
    this.repositories = new Map();
    this.hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    this.requestedDriver = String(env.BOARD_REPOSITORY_DRIVER || '').trim().toLowerCase();
  }

  /**
   * Determine if Supabase driver should be used based on config and request.
   */
  shouldUseSupabase() {
    return (this.requestedDriver === 'supabase' || (!this.requestedDriver && this.hasSupabase)) && this.hasSupabase;
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

    // 1. Board Repository
    if (useSupabase) {
      this.register('board', new SupabaseBoardRepository({
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
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
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
        table: this.env.SUPABASE_MEMBERS_TABLE || 'members'
      }));
    } else {
      this.register('member', new MemoryMemberRepository());
    }

    // 3. ChatRoom Repository
    if (useSupabase) {
      this.register('chatRooms', new SupabaseChatRoomRepository({
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
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
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
        table: this.env.SUPABASE_MEMOS_TABLE || 'memos'
      }));
    } else {
      this.register('memo', new MemoryMemoRepository());
    }

    // 5. Attachment Repository
    if (useSupabase && !options.attachmentOptions?.baseDir) {
      this.register('attachment', new SupabaseAttachmentRepository({
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
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
        url: this.env.SUPABASE_URL,
        serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
        table: this.env.SUPABASE_ACTIVITY_TABLE || 'user_activities',
        ttlMs: options.activityOptions?.ttlMs
      }));
    } else {
      this.register('activity', createActivityRepository(options.activityOptions));
    }

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
    for (const [name, repo] of this.repositories.entries()) {
      if (typeof repo.checkHealth === 'function') {
        results[name] = await repo.checkHealth();
      } else {
        results[name] = { status: 'unknown', message: 'No health check implemented' };
      }
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

module.exports = RepositoryRegistry;
