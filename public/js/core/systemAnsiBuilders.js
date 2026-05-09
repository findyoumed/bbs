import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';

/**
 * [LOG: 20260426_0200] 시스템 관련 ANSI 빌더 (Who is online 등)
 */
export function createSystemAnsiBuilders(deps) {
  const { displayWidth, isWideChar } = deps;
  const {
    ANSI_RESET,
    ansiColor,
    fitCell,
    ansiHLine,
    buildTopHeader,
    truncateDisplayText
  } = createAnsiBuilderUtils({ displayWidth, isWideChar });

  function buildActiveUsersAnsi(users) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader({ leftLabel: 'WHO', centerLabel: '접속자 목록 (WHO IS ONLINE)' }, `(총 ${users.length}명)`, targetCols)
    ];

    if (isMobile) {
      parts.push(`${ansiColor(11)}  사용자 ID     닉네임       위치${ANSI_RESET}`);
    } else {
      parts.push(`${ansiColor(11)}  사용자 ID       닉네임           위치                     시간${ANSI_RESET}`);
    }
    parts.push(ansiHLine(targetCols, 8));

    if (users.length === 0) {
      parts.push(`\n${ansiColor(8)}  접속 중인 사용자가 없습니다.${ANSI_RESET}`);
    } else {
      users.forEach((user, idx) => {
        if (isMobile) {
          const id = fitCell(user.userId || 'guest', 12);
          const nick = fitCell(user.nickName || '손님', 12);
          const path = fitCell(user.path || '/', 15);
          const color = user.isAdmin ? 13 : (user.isGuest ? 8 : 15);
          parts.push(`  ${ansiColor(color)}${id} ${nick} ${ansiColor(14)}${path}${ANSI_RESET}`);
        } else {
          const id = fitCell(user.userId || 'guest', 15);
          const nick = fitCell(user.nickName || '손님', 16);
          const path = fitCell(user.path || '/', 24);
          const time = (user.lastSeenAt || '').split('T')[1]?.split('.')[0] || '--:--:--';
          const color = user.isAdmin ? 13 : (user.isGuest ? 8 : 15);
          parts.push(`  ${ansiColor(color)}${id} ${nick} ${ansiColor(14)}${path} ${ansiColor(7)}${time}${ANSI_RESET}`);
        }
      });
    }

    return parts.join('\n');
  }

  function buildSystemDiagnosticsAnsi(info) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader({ leftLabel: 'DIAG', centerLabel: '시스템 진단 및 정보 (SYSINFO)' }, '', targetCols)
    ];

    const {
      hostname, platform, release, uptimeSeconds, nodeVersion,
      totalMemoryBytes, usedMemoryBytes, cpus
    } = info;

    const uptime = uptimeSeconds ? `${Math.floor(uptimeSeconds / 3600)}시간 ${Math.floor((uptimeSeconds % 3600) / 60)}분` : '--';
    const memTotalMB = Math.floor(totalMemoryBytes / 1024 / 1024);
    const memUsedMB = Math.floor(usedMemoryBytes / 1024 / 1024);
    const memUsage = memTotalMB > 0 ? Math.floor((memUsedMB / memTotalMB) * 100) : 0;

    parts.push(`${ansiColor(11)}[ 시스템 기본 정보 ]${ANSI_RESET}`);
    if (isMobile) {
      parts.push(`  호스트: ${ansiColor(15)}${hostname}${ANSI_RESET}`);
      parts.push(`  OS: ${ansiColor(15)}${platform} ${release}${ANSI_RESET}`);
      parts.push(`  업타임: ${ansiColor(15)}${uptime}${ANSI_RESET}`);
      parts.push(`  Node: ${ansiColor(15)}${nodeVersion}${ANSI_RESET} CPU: ${cpus} cores`);
    } else {
      parts.push(`  호스트: ${ansiColor(15)}${fitCell(hostname, 20)}${ANSI_RESET} OS: ${ansiColor(15)}${platform} ${release}${ANSI_RESET}`);
      parts.push(`  업타임: ${ansiColor(15)}${fitCell(uptime, 20)}${ANSI_RESET} Node: ${ansiColor(15)}${nodeVersion}${ANSI_RESET} CPU: ${ansiColor(15)}${cpus} cores${ANSI_RESET}`);
    }
    parts.push(`  메모리: ${ansiColor(15)}${memUsedMB}MB / ${memTotalMB}MB (${memUsage}%)${ANSI_RESET}`);
    parts.push(ansiHLine(targetCols, 8));

    parts.push(`${ansiColor(11)}[ 저장소 상태 (Repository Health) ]${ANSI_RESET}`);
    if (info.repositoryHealth) {
      Object.entries(info.repositoryHealth).forEach(([name, status]) => {
        const nameLabel = fitCell(name.toUpperCase(), isMobile ? 8 : 12);
        const statusText = status.status === 'ok' ? `${ansiColor(10)}정상 (OK)` : `${ansiColor(12)}오류 (${status.status})`;
        const driver = ansiColor(8) + (status.driver || 'unknown') + ANSI_RESET;
        parts.push(`  ${ansiColor(14)}${nameLabel}${ANSI_RESET}: ${statusText}  ${driver}`);
      });
    }
    parts.push(ansiHLine(targetCols, 8));

    // Metrics are usually too wide for mobile, simplify or skip
    if (!isMobile) {
      parts.push(`${ansiColor(11)}[ 저장소 메트릭 (Metrics) ]${ANSI_RESET}`);
      parts.push(`${ansiColor(8)}  명칭         호출수   에러     평균속도   드라이버${ANSI_RESET}`);
      if (info.repositoryMetrics) {
        Object.entries(info.repositoryMetrics).forEach(([name, meta]) => {
          const n = fitCell(name.toUpperCase(), 12);
          const calls = fitCell(meta.metrics?.calls || 0, 8, 'right');
          const errs = fitCell(meta.metrics?.errors || 0, 8, 'right');
          const avg = fitCell((meta.metrics?.avgDurationMs || 0) + 'ms', 10, 'right');
          const driver = fitCell(meta.driver || '', 12);
          parts.push(`  ${ansiColor(15)}${n}${ansiColor(7)} ${calls} ${ansiColor(12)}${errs}${ansiColor(14)} ${avg}   ${ansiColor(8)}${driver}${ANSI_RESET}`);
        });
      }
    }

    return parts.join('\n');
  }

  function buildActivitySummaryAnsi(data) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader({ leftLabel: 'ACT', centerLabel: '최근 활동 요약 (ACTIVITY SUMMARY)' }, '', targetCols)
    ];

    parts.push(`\n  ${ansiColor(11)}${data.summary}${ANSI_RESET}\n`);
    parts.push(ansiHLine(targetCols, 8));
    parts.push(`  ${ansiColor(14)}최근 주요 활동${ANSI_RESET}`);
    parts.push('');

    if (data.recentActions && data.recentActions.length > 0) {
      data.recentActions.forEach(action => {
        parts.push(`  - ${ansiColor(15)}${truncateDisplayText(action, targetCols - 6)}${ANSI_RESET}`);
      });
    } else {
      parts.push(`  ${ansiColor(8)}최근에 기록된 활동이 없습니다.${ANSI_RESET}`);
    }

    parts.push('\n' + ansiHLine(targetCols, 8));
    parts.push(`  ${ansiColor(8)}기준 시각: ${data.timestamp}${ANSI_RESET}`);

    return parts.join('\n');
  }

  function buildSystemLogAnsi(logs) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;

    const parts = [
      buildTopHeader({ leftLabel: 'LOG', centerLabel: '시스템 로그 (SYSTEM DIAGNOSTIC LOGS)' }, `(최근 ${logs.length}건)`, targetCols)
    ];

    if (isMobile) {
      parts.push(`${ansiColor(11)}  시간   레벨 메시재${ANSI_RESET}`);
    } else {
      parts.push(`${ansiColor(11)}  시간       레벨   메시지${ANSI_RESET}`);
    }
    parts.push(ansiHLine(targetCols, 8));

    const displayLogs = logs.slice(isMobile ? -10 : -18);
    if (displayLogs.length === 0) {
      parts.push(`\n${ansiColor(8)}  기록된 로그가 없습니다.${ANSI_RESET}`);
    } else {
      displayLogs.forEach(l => {
        const time = new Date(l.timestamp).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const level = fitCell(l.level, isMobile ? 4 : 6);
        let levelColor = 7;
        if (l.level === 'ERROR') levelColor = 12;
        else if (l.level === 'WARN') levelColor = 11;
        else if (l.level === 'CMD') levelColor = 10;
        else if (l.level === 'INFO') levelColor = 14;

        const maxMsg = targetCols - (isMobile ? 16 : 20);
        const msg = truncateDisplayText(l.message, maxMsg);
        parts.push(`  ${ansiColor(8)}${time} ${ansiColor(levelColor)}${level} ${ansiColor(15)}${msg}${ANSI_RESET}`);
      });
    }

    return parts.join('\n');
  }

  return { buildActiveUsersAnsi, buildSystemDiagnosticsAnsi, buildActivitySummaryAnsi, buildSystemLogAnsi };
}
