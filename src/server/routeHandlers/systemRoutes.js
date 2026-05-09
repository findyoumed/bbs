'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const BaseRouter = require('./BaseRouter');
const { sendText, streamFile } = require('../httpUtils');

class SystemRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/health', handler: 'health' },
      { method: 'GET', pattern: '/favicon.ico', handler: 'favicon' },
      { method: 'GET', pattern: /^\/api\/assets\/(.+)$/, handler: 'getAsset' },
      { method: 'GET', pattern: '/api/system/stats', handler: 'getStats' },
      { method: 'GET', pattern: '/api/auth/config', handler: 'getAuthConfig' },
      { method: 'GET', pattern: '/api/runtime-config', handler: 'getRuntimeConfig' },
      { method: 'GET', pattern: '/api/auth/session', handler: 'getSession' },
      { method: 'GET', pattern: '/api/system/info', handler: 'getSystemInfo' },
      { method: 'GET', pattern: '/api/system/active-users', handler: 'getActiveUsers' },
      { method: 'GET', pattern: '/api/system/activity-summary', handler: 'getActivitySummary' },
      { method: 'GET', pattern: '/api/menu', handler: 'getMenu' }
    ];
  }

  async health() {
    const { boardRepository, authBridge, rssService } = this.deps;
    const isHealthy = !!boardRepository;
    
    const status = {
      status: isHealthy ? 'healthy' : 'degraded',
      services: {
        database: {
          status: isHealthy ? 'connected' : 'disconnected',
          driver: boardRepository?.getMeta?.().driver || 'unknown'
        },
        auth: {
          status: authBridge ? 'active' : 'inactive',
          mode: authBridge?.url ? 'supabase' : 'local'
        },
        rss: {
          status: rssService ? 'active' : 'inactive'
        }
      },
      system: {
        uptime: Math.floor(os.uptime()),
        nodeVersion: process.version,
        platform: os.platform()
      },
      timestamp: new Date().toISOString()
    };

    return this.send(isHealthy ? 200 : 503, status, isHealthy ? 'System is healthy' : 'System is degraded');
  }

  async favicon() {
    const faviconPath = path.join(this.deps.projectRoot, 'public', 'favicon.svg');
    if (fs.existsSync(faviconPath)) {
      await streamFile(this.res, faviconPath);
    } else {
      this.res.writeHead(204);
      this.res.end();
    }
    return true;
  }

  async getAsset(params) {
    const filename = Array.isArray(params) ? params[1] : params.filename;
    const content = await this.deps.assetManager.getAsset(filename);
    sendText(this.res, 200, content);
    return true;
  }

  async getStats() {
    const { boardRepository, memberRepository, activityRepository, runtimeConfig, assetStatsCache } = this.deps;
    return this.send(200, await this.buildAssetDynamicData(boardRepository, memberRepository, activityRepository, runtimeConfig, assetStatsCache));
  }

  async getAuthConfig() {
    return this.send(200, this.deps.authBridge?.getClientConfig?.() || { enabled: false, url: '', publishableKey: '' });
  }

  async getRuntimeConfig() {
    const { runtimeConfig, errorTracker } = this.deps;
    return this.send(200, {
      hostName: runtimeConfig?.hostName || '',
      levelAliases: runtimeConfig?.levelAliases || { 1: '일반회원', 2: '특별회원', 99: '운영자' },
      validLevels: Array.isArray(runtimeConfig?.validLevels) ? runtimeConfig.validLevels : [1, 2, 99],
      errorTracking: errorTracker?.getClientConfig?.() || { enabled: false, dsn: '', environment: '', release: '' }
    });
  }

  async getSession() {
    const { authBridge, activityRepository } = this.deps;
    const session = authBridge?.getSessionFromRequest ? await authBridge.getSessionFromRequest(this.req) : {
      enabled: false,
      user: { userId: 'guest', nickName: '손님', level: 1, isAdmin: false, isGuest: true, email: '' }
    };
    activityRepository.touch(session.user, {
      path: this.pathname,
      remoteAddress: this.req.socket?.remoteAddress || ''
    });
    return this.send(200, session);
  }

  async getSystemInfo() {
    const { projectRoot, boardRepository, runtimeConfig, repositoryDiagnostics, registry } = this.deps;
    const info = this.buildSystemInfo(projectRoot, boardRepository, runtimeConfig, repositoryDiagnostics);
    
    // [LOG: 20260426_1630] Evolution: Include detailed repository diagnostics and health
    if (registry) {
      try {
        info.repositoryHealth = await registry.checkAllHealth();
        info.repositoryMetrics = registry.getAllMeta();
      } catch (e) {
        info.repositoryError = e.message;
      }
    }
    
    return this.send(200, info);
  }

  async getActiveUsers() {
    return this.send(200, this.deps.activityRepository.list());
  }

  async getActivitySummary() {
    // [LOG: 20260429_0437] /api/system/activity-summary must keep the default
    // limit path working even when no query string is present.
    const rawLimit = this.requestUrl?.searchParams?.get('limit');
    const parsedLimit = Number.parseInt(rawLimit || '5', 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
    return this.send(200, this.deps.activityRepository.getRecentSummary(limit));
  }

  async getMenu() {
    return this.send(200, this.deps.menuResolver.getTree());
  }

  buildSystemInfo(projectRoot, boardRepository, runtimeConfig, repositoryDiagnostics) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let totalDiskBytes = 0;
    let freeDiskBytes = 0;
    try {
      const stat = fs.statfsSync(projectRoot || process.cwd());
      const blockSize = Number(stat.bsize || stat.frsize || 0);
      totalDiskBytes = Math.max(0, Number(stat.blocks || 0) * blockSize);
      freeDiskBytes = Math.max(0, Number((stat.bavail ?? stat.bfree ?? 0)) * blockSize);
    } catch (error) {
      totalDiskBytes = 0;
      freeDiskBytes = 0;
    }
    return {
      bbsName: String(runtimeConfig?.hostName || '').trim(),
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(os.uptime()),
      nodeVersion: process.version,
      repositoryDriver: boardRepository?.getMeta?.().driver || '',
      requestedRepositoryMode: repositoryDiagnostics?.modeLabel || 'auto(memory)',
      repositoryDrivers: Object.fromEntries(
        Object.entries(repositoryDiagnostics?.repositories || {}).map(([key, entry]) => [key, entry.effectiveDriver || ''])
      ),
      repositoryWarnings: Array.isArray(repositoryDiagnostics?.warnings) ? repositoryDiagnostics.warnings.slice() : [],
      supabaseReady: Boolean(repositoryDiagnostics?.hasSupabaseConfig),
      supabasePartialConfig: Boolean(repositoryDiagnostics?.hasPartialSupabaseConfig),
      totalMemoryBytes: totalMem,
      freeMemoryBytes: freeMem,
      usedMemoryBytes: Math.max(0, totalMem - freeMem),
      totalDiskBytes,
      freeDiskBytes,
      cpus: Array.isArray(os.cpus()) ? os.cpus().length : 0
    };
  }

  async buildAssetDynamicData(boardRepository, memberRepository, activityRepository, runtimeConfig, cache) {
    const now = Date.now();
    if (cache?.data && Number(cache.expiresAt || 0) > now) {
      return cache.data;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const activeUserCount = this.countActiveUsers(activityRepository);
    const [memberCount, totalArticles, todayArticles] = await Promise.all([
      this.safeCount(() => memberRepository?.countMembers?.(), 0),
      this.countAllPosts(boardRepository),
      this.countPostsSince(boardRepository, startOfDay)
    ]);

    const data = {
      hostname: String(runtimeConfig?.hostName || '').trim() || '01410',
      nummembers: this.formatAssetNumber(memberCount),
      numconns: this.formatAssetNumber(activeUserCount),
      numarticles: this.formatAssetNumber(totalArticles),
      todaynumarticles: this.formatAssetNumber(todayArticles)
    };

    if (cache) {
      cache.data = data;
      cache.expiresAt = now + 30000;
    }

    return data;
  }

  countActiveUsers(activityRepository) {
    try {
      if (typeof activityRepository?.getStats === 'function') {
        return activityRepository.getStats().totalConnections || 0;
      }
      const activeUsers = typeof activityRepository?.list === 'function'
        ? activityRepository.list()
        : [];
      return Array.isArray(activeUsers) ? activeUsers.length : 0;
    } catch (error) {
      return 0;
    }
  }

  async countAllPosts(boardRepository) {
    if (typeof boardRepository?.countPosts === 'function') {
      return this.safeCount(() => boardRepository.countPosts(), 0);
    }
    return 0;
  }

  async countPostsSince(boardRepository, since) {
    if (typeof boardRepository?.countPostsSince === 'function') {
      return this.safeCount(() => boardRepository.countPostsSince(since), 0);
    }
    return 0;
  }

  async safeCount(loader, fallback) {
    try {
      const value = await loader();
      const numeric = Number(value || 0);
      return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  formatAssetNumber(value) {
    return new Intl.NumberFormat('ko-KR').format(Math.max(0, Number(value || 0)));
  }
}

async function handleSystemRoutes(deps) {
  const router = new SystemRouter(deps);
  return await router.handle();
}

module.exports = handleSystemRoutes;
