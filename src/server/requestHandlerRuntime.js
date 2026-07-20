'use strict';

const { createActivityRepository } = require('./ActivityRepository');
const { createChatRoomRepository } = require('./ChatRoomRepository');
const { createMemoRepositoryFromEnv } = require('./MemoRepository');
const { createMemberRepositoryFromEnv } = require('./MemberRepository');
// [LOG: 20260623_0013] origin/main에서 vote 시스템 포팅 — route 핸들러에 voteRepository 노출
const { createVoteRepositoryFromEnv } = require('./VoteRepository');
// [LOG_ID: 20260719_1600] 토론의 광장(CONF) — route 핸들러에 confRepository 노출
const { createConfRepositoryFromEnv } = require('./ConfRepository');

const logger = require('./logger');

const DEFAULT_RUNTIME_CONFIG = {
  hostName: '',
  levelAliases: { 1: 'guest', 2: 'member', 99: 'sysop' },
  validLevels: [1, 2, 99],
  sysopUserIds: []
};

function createAssetStatsCache() {
  return {
    expiresAt: 0,
    data: null
  };
}

function createRequestHandlerRuntime(options = {}) {
  const env = options.env || process.env;

  return {
    env,
    projectRoot: options.projectRoot,
    assetManager: options.assetManager,
    boardRepository: options.boardRepository,
    attachmentRepository: options.attachmentRepository,
    chatRoomRepository: options.chatRoomRepository || createChatRoomRepository({ defaultRoom: false }),
    memoRepository: options.memoRepository || createMemoRepositoryFromEnv(env),
    memberRepository: options.memberRepository || createMemberRepositoryFromEnv(env),
    // [LOG: 20260429_0447] Expose the repository registry to route handlers so
    // /api/system/info can include live repository health and metrics data.
    registry: options.registry || null,
    repositoryDiagnostics: options.repositoryDiagnostics || null,
    activityRepository: options.activityRepository || createActivityRepository(),
    voteRepository: options.voteRepository || createVoteRepositoryFromEnv(env),
    confRepository: options.confRepository || createConfRepositoryFromEnv(env), // [LOG_ID: 20260719_1600]
    menuResolver: options.menuResolver,
    rssService: options.rssService,
    authBridge: options.authBridge,
    mailService: options.mailService,
    runtimeConfig: options.runtimeConfig || { ...DEFAULT_RUNTIME_CONFIG },
    errorTracker: options.errorTracker || null,
    assetStatsCache: options.assetStatsCache || createAssetStatsCache()
  };
}

function createRouteContext(runtime, req, res, requestUrl, requestId) {
  return {
    req,
    res,
    requestUrl,
    requestId,
    logger: logger.withContext({ requestId, method: req.method, url: req.url }),
    projectRoot: runtime.projectRoot,
    assetManager: runtime.assetManager,
    boardRepository: runtime.boardRepository,
    attachmentRepository: runtime.attachmentRepository,
    chatRoomRepository: runtime.chatRoomRepository,
    memoRepository: runtime.memoRepository,
    memberRepository: runtime.memberRepository,
    activityRepository: runtime.activityRepository,
    voteRepository: runtime.voteRepository,
    confRepository: runtime.confRepository, // [LOG_ID: 20260719_1600] 토론의 광장
    registry: runtime.registry,
    menuResolver: runtime.menuResolver,
    rssService: runtime.rssService,
    authBridge: runtime.authBridge,
    mailService: runtime.mailService,
    runtimeConfig: runtime.runtimeConfig,
    assetStatsCache: runtime.assetStatsCache,
    repositoryDiagnostics: runtime.repositoryDiagnostics,
    errorTracker: runtime.errorTracker
  };
}

module.exports = {
  DEFAULT_RUNTIME_CONFIG,
  createAssetStatsCache,
  createRequestHandlerRuntime,
  createRouteContext
};
