'use strict';

const { createActivityRepository } = require('./ActivityRepository');
const { createChatRoomRepository } = require('./ChatRoomRepository');
const { createMemoRepositoryFromEnv } = require('./MemoRepository');
const { createMemberRepositoryFromEnv } = require('./MemberRepository');

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
    menuResolver: options.menuResolver,
    rssService: options.rssService,
    authBridge: options.authBridge,
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
    registry: runtime.registry,
    menuResolver: runtime.menuResolver,
    rssService: runtime.rssService,
    authBridge: runtime.authBridge,
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
