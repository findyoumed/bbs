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

    // [LOG_ID: 20260714_1600] COLOR가 CMD_META(도움말)에는 있지만 어디서도 디스패치되지
    // 않던 죽은 명령이었다 — C만 실제로 동작했다. 같은 기능에 묶는다.
    if ((cmd === 'C' || cmd === 'COLOR') && state.screen !== 'system-log') {
      toggleTheme();
      // [LOG: 20260609_1136] 터미널 테마 변경 힌트 표시 제거 (원래 힌트바 유지)
      return true;
    }

    // [LOG_ID: 20260713_1000] 갈무리(CAP) 명령어 구현
    if (cmd === 'CAP') {
      if (!state.captureActive) {
        state.captureActive = true;
        state.captureBuffer = '';
        updateCaptureBadge(true);
        setHint('[갈무리 시작] 이후 출력되는 화면이 갈무리 버퍼에 기록됩니다. (종료: CAP)');
      } else {
        state.captureActive = false;
        updateCaptureBadge(false);
        const buffer = state.captureBuffer || '';
        state.captureBuffer = '';

        if (buffer.trim()) {
          // 1. 파일 다운로드 실행
          if (typeof document !== 'undefined') {
            try {
              const blob = new Blob([buffer], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const now = new Date();
              const pad = (n) => String(n).padStart(2, '0');
              const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              a.download = `capture_${dateStr}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error('갈무리 파일 다운로드 실패:', err.message);
            }
          }

          // 2. 클립보드 복사 실행
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(buffer)
              .then(() => {
                setHint(`[갈무리 종료] 다운로드 및 클립보드 복사 완료 (총 ${buffer.length}자)`);
              })
              .catch((err) => {
                console.warn('갈무리 클립보드 복사 실패:', err.message);
                setHint(`[갈무리 종료] 다운로드 완료 (총 ${buffer.length}자, 클립보드 복사는 권한 부족으로 취소됨)`);
              });
          } else {
            setHint(`[갈무리 종료] 다운로드 완료 (총 ${buffer.length}자)`);
          }
        } else {
          setHint('[갈무리 종료] 갈무리된 화면이 없습니다.');
        }
      }
      setDefaultPrompt();
      return true;
    }

    return false;
  };

  // [LOG_ID: 20260713_1000] 갈무리 상태 뱃지 오버레이 동적 생성 및 제거
  function updateCaptureBadge(isActive) {
    if (typeof document === 'undefined') return;
    let badge = document.getElementById('capture-badge');
    if (isActive) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'capture-badge';
        badge.className = 'capture-badge';
        badge.textContent = '● 갈무리 중';
        document.getElementById('terminal-wrapper')?.appendChild(badge);
      }
    } else {
      if (badge) {
        badge.remove();
      }
    }
  }
}

