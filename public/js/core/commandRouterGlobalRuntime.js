export function createGlobalRuntimeCommandHandler(deps) {
  const {
    state,
    toggleTheme,
    showActivitySummary,
    showSystemDiagnostics,
    setHint,
    setPrompt
  } = deps;

  function setDefaultPrompt() {
    setPrompt('>>');
  }

  function splitCommand(rawCmd) {
    return String(rawCmd || '').trim().split(/\s+/);
  }

  // [LOG: 20260429_0456] PERF CACHE must clear the shared asset cache object in place
  // so footer loaders keep using the same invalidated reference.
  function clearAssetCacheInPlace() {
    if (!state.assetCache || typeof state.assetCache !== 'object') {
      state.assetCache = {};
      return;
    }

    Object.keys(state.assetCache).forEach((key) => {
      delete state.assetCache[key];
    });
  }

  return async function handleGlobalRuntimeCommand({ cmd, rawCmd }) {
    // [LOG_ID: 20260711_2340] cmd는 입력 전체 문자열이므로 인자를 받는 명령(PERF/ZOOM)은
    // 첫 토큰으로 비교한다(commandRouterGlobalWorkspace 주석 참고). 인자 없는 명령들
    // (ACT/SYSINFO/DIAG/SYSLOG/LOG/C)은 기존 전체 일치를 유지해 동작 변화를 만들지 않는다.
    const head = String(cmd || '').trim().split(/\s+/)[0];

    if (head === 'PERF') {
      const { performanceService } = deps;
      if (!performanceService) {
        return false;
      }

      const parts = splitCommand(rawCmd);
      const sub = (parts[1] || '').toUpperCase();

      if (sub === 'CLR' || sub === 'CLEAR') {
        performanceService.clearMetrics();
        setHint('성능 메트릭을 초기화했습니다.');
        setDefaultPrompt();
        return true;
      }

      if (sub === 'CACHE' || sub === 'C') {
        clearAssetCacheInPlace();
        setHint('에셋 캐시를 강제로 비웠습니다.');
        setDefaultPrompt();
        return true;
      }

      const stats = performanceService.getStats();
      const report = [
        '[시스템 성능 보고서]',
        `- 마지막 렌더링: ${stats.lastRenderTime}ms`,
        `- 평균 렌더링: ${stats.avgRenderTime}ms`,
        `- 평균 API 지연: ${stats.avgApiLatency}ms`,
        `- 캐시 적중률: ${stats.cacheHitRate}%`,
        `- 에셋 캐시: ${stats.assetCacheSize}개`,
        `- 상태 객체 크기: ${stats.stateSizeKb}KB`
      ].join('\n');

      setHint(report);
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'ACT' || cmd === 'ACTIVITY') {
      if (typeof showActivitySummary === 'function') {
        await showActivitySummary();
        return true;
      }
      return false;
    }

    if (cmd === 'SYSINFO' || cmd === 'DIAG') {
      await showSystemDiagnostics();
      return true;
    }

    if (head === 'ZOOM') {
      const parts = splitCommand(rawCmd);
      const sub = (parts[1] || '').toUpperCase();

      if (sub === 'IN' || sub === '+') {
        if (typeof deps.adjustZoom === 'function') {
          deps.adjustZoom(0.1);
        }
        setHint('화면을 10% 확대했습니다.');
        setDefaultPrompt();
        return true;
      }

      if (sub === 'OUT' || sub === '-') {
        if (typeof deps.adjustZoom === 'function') {
          deps.adjustZoom(-0.1);
        }
        setHint('화면을 10% 축소했습니다.');
        setDefaultPrompt();
        return true;
      }

      if (sub === 'RESET' || sub === 'R' || sub === '0') {
        if (typeof deps.setZoom === 'function') {
          deps.setZoom(1.0);
          if (typeof deps.setScale === 'function') {
            deps.setScale(1.0, false);
          }
          if (typeof deps.autoAdjustZoom === 'function') {
            deps.autoAdjustZoom();
          }
        }
        setHint('화면 배율을 초기화했습니다.');
        setDefaultPrompt();
        return true;
      }

      setHint('사용법: ZOOM IN (+), ZOOM OUT (-), ZOOM RESET (0)');
      setDefaultPrompt();
      return true;
    }

    if (cmd === 'SYSLOG' || cmd === 'LOG') {
      if (typeof deps.showSystemLog === 'function') {
        await deps.showSystemLog();
        return true;
      }
      return false;
    }

    if (cmd === 'C' && state.screen !== 'system-log') {
      toggleTheme();
      // [LOG: 20260609_1136] 터미널 테마 변경 힌트 표시 제거 (원래 힌트바 유지)
      return true;
    }

    return false;
  };
}
