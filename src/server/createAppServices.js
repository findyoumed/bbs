'use strict';

const fs = require('fs');
const path = require('path');

const AssetManager = require('../core/AssetManager');
const MenuResolver = require('./MenuResolver');
const RssService = require('./RssService');
const AuthBridge = require('./AuthBridge');
const { createSysopMailServiceFromEnv } = require('./SysopMailService');
const RepositoryRegistry = require('./RepositoryRegistry');
const { createErrorTrackerFromEnv } = require('./ErrorTracker');
const { resolveLegacyRuntimeConfig } = require('./LegacyRuntimeConfig');
const { resolveLegacyPaths } = require('./projectPaths');
const { createRssCacheStoreFromEnv } = require('./RssCacheStore');
const {
  applyRuntimeRepositoryMeta,
  assertRuntimeRepositoryDiagnostics,
  createRuntimeRepositoryDiagnostics
} = require('./RuntimeRepositoryDiagnostics');
const logger = require('./logger');

/**
 * [LOG: 20260426_1505] Evolution: Simplified createAppServices using RepositoryRegistry.
 */
function loadEnvFile(envPath, env = process.env) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!env[key]) env[key] = value;
  }
}

function resolvePublishableKey(rootDir, env = process.env) {
  const direct = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  if (direct) return direct;
  const notePath = path.join(rootDir, 'supabase_mcp.txt'); // [LOG: 20260703_1655] 실제 파일명(밑줄)과 불일치했던 죽은 fallback 수정
  if (!fs.existsSync(notePath)) return '';
  const match = fs.readFileSync(notePath, 'utf-8').match(/sb_publishable_[A-Za-z0-9_-]+/);
  return match ? match[0] : '';
}

function createAppServices(rootDir, env = process.env) {
  const errorTracker = createErrorTrackerFromEnv(env);
  errorTracker.registerProcessErrorHandlers();

  const preflightDiagnostics = createRuntimeRepositoryDiagnostics(env);
  assertRuntimeRepositoryDiagnostics(preflightDiagnostics);

  const legacyPaths = resolveLegacyPaths(env, rootDir);
  const runtimeConfig = resolveLegacyRuntimeConfig(env, rootDir);
  
  // Use RepositoryRegistry for centralized repository management
  const registry = new RepositoryRegistry(env, rootDir);
  const repositories = registry.initialize({
    levelAliases: runtimeConfig.levelAliases,
    chatOptions: { defaultRoom: false },
    attachmentOptions: { /* attachment config could go here */ }
  });

  const memberRepository = registry.get('member');
  const boardRepository = registry.get('board');
  const memoRepository = registry.get('memo');
  const chatRoomRepository = registry.get('chatRooms');
  const attachmentRepository = registry.get('attachment');
  const activityRepository = registry.get('activity');
  const voteRepository = registry.get('vote'); // [LOG: 20260623_0013] origin/main 포팅
  const confRepository = registry.get('conf'); // [LOG_ID: 20260719_1600] 토론의 광장

  const repositoryDiagnostics = applyRuntimeRepositoryMeta(preflightDiagnostics, {
    board: boardRepository,
    member: memberRepository,
    memo: memoRepository,
    attachment: attachmentRepository,
    chatRooms: chatRoomRepository,
    activity: activityRepository
  });
  
  const rssCacheStore = createRssCacheStoreFromEnv(env);

  // [LOG_ID: 20260804_1405] Health probes can fan out to Supabase during a
  // serverless cold start. Keep them opt-in; explicit diagnostics still run
  // through the system info endpoint when requested.
  if (String(env.BBS_STARTUP_HEALTHCHECK || '').trim().toLowerCase() === 'true') {
    registry.checkAllHealth().then(health => {
      logger.info('Repository health check results:', { component: 'AppServices', health });
    }).catch(err => {
      logger.warn('Failed to perform repository health checks:', { component: 'AppServices', error: err.message });
    });
  }

  return {
    assetManager: new AssetManager(legacyPaths.legacyTxtPath),
    boardRepository,
    attachmentRepository,
    chatRoomRepository,
    memoRepository,
    memberRepository,
    activityRepository,
    voteRepository,
    confRepository,
    menuResolver: new MenuResolver(legacyPaths.menuFilePath),
    rssService: new RssService({
      newsMenuPath: legacyPaths.newsMenuPath,
      weatherMenuPath: legacyPaths.weatherMenuPath,
      cacheStore: rssCacheStore
    }),
    authBridge: new AuthBridge({
      env,
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      publishableKey: resolvePublishableKey(rootDir, env),
      adminUserIds: env.BBS_ADMIN_USER_IDS || runtimeConfig.sysopUserIds.join(','),
      adminEmails: env.BBS_ADMIN_EMAILS,
      memberRepository
    }),
    // [LOG_ID: 20260720_2300] 건의하기 → 시삽 이메일 발송(Resend API).
    mailService: createSysopMailServiceFromEnv(env),
    runtimeConfig,
    repositoryDiagnostics,
    errorTracker,
    registry // Also expose the registry for diagnostic access
  };
}

module.exports = {
  createAppServices,
  loadEnvFile,
  resolvePublishableKey
};
