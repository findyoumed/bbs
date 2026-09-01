'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const BaseRouter = require('./BaseRouter');
const { sendText, streamFile } = require('../httpUtils');

class SystemRouter extends BaseRouter {
  get routes() {
    return [
      // Keep the legacy root probe and expose the same probe through the API
      // function used by Vercel (`/api/*`). Without the explicit API route,
      // `/api/health` falls through to static handling and returns a generic
      // 500 instead of a useful repository status response.
      { method: 'GET', pattern: '/health', handler: 'health' },
      { method: 'GET', pattern: '/api/health', handler: 'health' },
      { method: 'GET', pattern: '/favicon.ico', handler: 'favicon' },
      { method: 'GET', pattern: /^\/api\/assets\/(.+)$/, handler: 'getAsset' },
      { method: 'GET', pattern: '/api/system/stats', handler: 'getStats' },
      // [LOG_ID: 20260804_1114] Main-screen read data shares one serverless request.
      { method: 'GET', pattern: '/api/bootstrap', handler: 'getBootstrap' },
      { method: 'GET', pattern: '/api/auth/config', handler: 'getAuthConfig' },
      { method: 'GET', pattern: '/api/runtime-config', handler: 'getRuntimeConfig' },
      { method: 'GET', pattern: '/api/auth/session', handler: 'getSession' },
      // [LOG_ID: 20260721_0400] 보안 점검 중 발견: SYSINFO/DIAG 명령(클라이언트 CMD_META에
      // 등록조차 안 된 비공식 명령)이 이 API를 로그인 여부와 무관하게 호출했다 — 호스트명·Node
      // 버전·메모리/디스크 사용량·저장소 드라이버 및 경고·Supabase 설정 여부 같은 내부 인프라
      // 정보가 아무나에게 노출되고 있었다. UID(접속자 목록)는 CMD_META에 login 플래그가 없어
      // 게스트 공개가 의도된 기능이지만, 이 진단 정보는 그런 의도된 공개 기능이 아니라 순수
      // 누락이었다 — ensureAdmin으로 막는다.
      { method: 'GET', pattern: '/api/system/info', handler: 'getSystemInfo', middlewares: ['ensureAdmin'] },
      { method: 'GET', pattern: '/api/system/active-users', handler: 'getActiveUsers' },
      { method: 'GET', pattern: '/api/system/activity-summary', handler: 'getActivitySummary' },
      { method: 'GET', pattern: '/api/menu', handler: 'getMenu' }
    ];
  }

  async health() {
    const { boardRepository, memberRepository, authBridge, rssService } = this.deps;
    // Checking only whether a repository object exists reports a false
    // healthy state when Supabase credentials are rejected at request time.
    // The member repository has a lightweight table probe implemented by both
    // memory and Supabase drivers, so use it as the database readiness signal.
    let memberHealth = { status: memberRepository ? 'ok' : 'error' };
    if (memberRepository && typeof memberRepository.checkHealth === 'function') {
      memberHealth = await memberRepository.checkHealth();
    }
    const isHealthy = Boolean(boardRepository && memberHealth.status === 'ok');
    
    const status = {
      status: isHealthy ? 'healthy' : 'degraded',
      services: {
        database: {
          status: isHealthy ? 'connected' : 'disconnected',
          driver: boardRepository?.getMeta?.().driver || 'unknown',
          memberProbe: memberHealth.status,
          ...(memberHealth.message ? { detail: memberHealth.message } : {})
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
      // [LOG_ID: 20260804_1114] Reuse conditional static-file responses for the API favicon route.
      await streamFile(this.res, faviconPath, { req: this.req });
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

  async getBootstrap() {
    const {
      activityRepository,
      assetStatsCache,
      boardRepository,
      memberRepository,
      menuResolver,
      runtimeConfig
    } = this.deps;
    // [LOG_ID: 20260804_1114] These reads are independent. Combining them removes
    // two HTTP/serverless round trips while retaining parallel repository work.
    const [boards, stats] = await Promise.all([
      boardRepository.listBoards(),
      this.buildAssetDynamicData(
        boardRepository,
        memberRepository,
        activityRepository,
        runtimeConfig,
        assetStatsCache
      )
    ]);
    return this.sendCached(200, {
      boards,
      menu: menuResolver.getTree(),
      stats
    }, 10);
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
    // [LOG: 20260802_0100] touch()는 fire-and-forget이나, Supabase 드라이버에서 async로
    // 실패 시 UnhandledPromiseRejection 발생 — Promise.resolve().catch()로 명시 처리.
    // (requestContext.js의 buildTrackedContext와 동일한 수정 패턴)
    Promise.resolve(activityRepository.touch(session.user, {
      path: this.pathname,
      remoteAddress: this.req.socket?.remoteAddress || ''
    })).catch(() => {
      // fire-and-forget: 활동 추적 실패는 세션 응답에 영향을 주지 않는다.
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

  // [LOG_ID: 20260729_0035] 이 엔드포인트는 원전 UID/WHO(접속자 목록)를 재현하려고 로그인 여부와
  // 무관하게 의도적으로 공개돼 있다(위 라우트 등록부 주석 참고 — SYSINFO와 달리 이건 의도된
  // 게스트 공개 기능). 그런데 activityRepository.list()가 반환하는 각 항목엔 표시용 필드
  // 외에 remoteAddr(접속자의 실제 IP)까지 그대로 들어있어, 인증 전혀 없이 아무나 호출해서
  // 현재 접속 중인 모든 사용자·게스트의 IP 주소를 그대로 긁어갈 수 있었다(실측 확인: 익명
  // curl 요청 응답에 remoteAddr:"127.0.0.1" 등이 그대로 포함됨). 클라이언트
  // (systemAnsiBuilders.js buildActiveUsersAnsi)는 userId/nickName/path/level/isAdmin/isGuest/
  // lastSeenAt만 렌더하고 remoteAddr는 어디서도 쓰지 않는다 — PF/WHO의 내부 UUID 노출을 고친
  // 것과 동일한 원칙으로, 화면이 쓰지 않는 민감 필드를 공개 응답에서 제거한다.
  // [LOG: 20260802_0000] getActiveUsers/getActivitySummary — await 누락 수정.
  // memory 드라이버(ActivityRepository)는 list()/getRecentSummary()가 동기 반환이라
  // await가 없어도 동작했지만, Supabase 드라이버(ActivityRepositorySupabase)는 두 메서드가
  // async이므로 await 없이 호출하면 Promise가 그대로 반환된다.
  //   - getActiveUsers: users = Promise → users.map(...)이 TypeError("users.map is not
  //     a function")를 던져 /api/system/active-users가 항상 500으로 응답(접속자 목록 화면 불가).
  //   - getActivitySummary: JSON.stringify(Promise) = "{}" → 클라이언트가 항상 빈 객체 수신.
  // 두 곳 모두 await를 추가해 Supabase/memory 드라이버 양쪽에서 정상 동작하도록 한다.
  async getActiveUsers() {
    const users = await this.deps.activityRepository.list();
    const publicUsers = users.map(({ remoteAddr, ...rest }) => rest);
    return this.send(200, publicUsers);
  }

  async getActivitySummary() {
    // [LOG: 20260429_0437] /api/system/activity-summary must keep the default
    // limit path working even when no query string is present.
    const rawLimit = this.requestUrl?.searchParams?.get('limit');
    const parsedLimit = Number.parseInt(rawLimit || '5', 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
    return this.send(200, await this.deps.activityRepository.getRecentSummary(limit));
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

    // [LOG_ID: 20260813_2028] 캐시가 비어 있는 cold start에서도 메인 화면의
    // 동시 요청이 동일한 통계 4종 조회를 각각 실행하던 문제를 막는다. 기존에는
    // 이전 snapshot이 있을 때만 refreshPromise를 공유했으므로, 첫 방문 동시
    // 요청마다 Supabase count 쿼리 세트가 중복되었다.
    if (cache?.refreshPromise) {
      return cache.data || cache.refreshPromise;
    }

    // [LOG_ID: 20260804_1405] Public startup stats are non-critical. Serve the
    // last snapshot immediately while one request refreshes it in the background.
    if (cache?.data) {
      const refreshRequest = this.refreshAssetDynamicData(
        boardRepository,
        memberRepository,
        activityRepository,
        runtimeConfig,
        cache,
        now
      );
      const trackedRequest = refreshRequest
        .catch(() => null)
        .finally(() => {
          if (cache.refreshPromise === trackedRequest) cache.refreshPromise = null;
        });
      cache.refreshPromise = trackedRequest;
      void trackedRequest.catch(() => {});
      return cache.data;
    }

    const refreshRequest = this.refreshAssetDynamicData(
      boardRepository,
      memberRepository,
      activityRepository,
      runtimeConfig,
      cache,
      now
    );
    const trackedRequest = refreshRequest.finally(() => {
      if (cache?.refreshPromise === trackedRequest) cache.refreshPromise = null;
    });
    if (cache) cache.refreshPromise = trackedRequest;
    return trackedRequest;
  }

  async refreshAssetDynamicData(boardRepository, memberRepository, activityRepository, runtimeConfig, cache, now = Date.now()) {

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    // [LOG: 20260731_1640] countActiveUsers가 비동기 리포지토리 호출을 수반하므로 await/Promise.all 관리 추가
    const [memberCount, activeUserCount, totalArticles, todayArticles] = await Promise.all([
      this.safeCount(() => (typeof memberRepository?.countMembers === 'function' ? memberRepository.countMembers() : 0), 0),
      this.countActiveUsers(activityRepository),
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
      cache.expiresAt = now + 120000;
    }

    return data;
  }

  async countActiveUsers(activityRepository) {
    try {
      if (typeof activityRepository?.getStats === 'function') {
        const stats = await activityRepository.getStats();
        return stats?.totalConnections || 0;
      }
      const activeUsers = typeof activityRepository?.list === 'function'
        ? await activityRepository.list()
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
