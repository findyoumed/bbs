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
    formatLongDate,
    truncateDisplayText
  } = createAnsiBuilderUtils({ displayWidth, isWideChar });

  // [LOG_ID: 20260708_1030] 사용자 프로필(WHO/PF) 화면. 기존엔 .bbs-box 원시 HTML로만 그려져
  // 상단바(로고 박스+실시간 시계)가 아예 없었고, 가입일도 ISO 원문(2026-03-23T11:56:33.619804+00:00)이
  // 그대로 노출됐다 — 다른 화면과 동일한 buildTopHeader + formatLongDate로 통일한다.
  function buildProfileAnsi(member, options = {}) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const labelWidth = isMobile ? 8 : 10;

    const parts = [
      buildTopHeader({ leftLabel: 'WHO', centerLabel: '사용자 정보 (PROFILE)' }, '', targetCols)
    ];

    if (options.notFound) {
      parts.push('');
      parts.push(`  ${ansiColor(12)}회원 정보를 찾을 수 없습니다.${ANSI_RESET}`);
      parts.push(`  ${ansiColor(8)}대상 ID : ${ansiColor(15)}${options.userId || '정보 없음'}${ANSI_RESET}`);
      return parts.join('\n');
    }

    if (options.error) {
      parts.push('');
      parts.push(`  ${ansiColor(12)}프로필 정보를 불러오지 못했습니다.${ANSI_RESET}`);
      return parts.join('\n');
    }

    const row = (label, value) => `  ${ansiColor(11)}${fitCell(label, labelWidth)}${ANSI_RESET}: ${ansiColor(15)}${value}${ANSI_RESET}`;

    parts.push('');
    parts.push(row('아이디', member.userId || '정보 없음'));
    parts.push(row('닉네임', member.nickName || '정보 없음'));
    parts.push(row('회원등급', `${member.level || 1} (${member.isAdmin ? '운영자' : '일반회원'})`));
    parts.push(row('가입일', formatLongDate(member.registrationDateTime) || '정보 없음'));
    parts.push(ansiHLine(targetCols, 8));

    return parts.join('\n');
  }

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

    // [LOG_ID: 20260708_1030] 저장소 상태(Health)와 메트릭(Metrics)을 저장소당 한 줄로 합쳐
    // 동일한 7개 저장소를 두 번 나열하던 것을 제거했다. 80x24 한 프레임에 다 들어가지 않아
    // #terminal-screen에 세로 스크롤바가 생기던 문제(정통 PC통신 화면은 스크롤 없이 페이지 단위로만
    // 넘어간다)의 근본 원인이었다.
    parts.push(`${ansiColor(11)}[ 저장소 상태 (Repository Health) ]${ANSI_RESET}`);
    if (isMobile) {
      if (info.repositoryHealth) {
        Object.entries(info.repositoryHealth).forEach(([name, status]) => {
          const nameLabel = fitCell(name.toUpperCase(), 10);
          const statusText = status.status === 'ok' ? `${ansiColor(10)}정상` : `${ansiColor(12)}오류`;
          const driver = ansiColor(8) + (status.driver || 'unknown') + ANSI_RESET;
          parts.push(`  ${ansiColor(14)}${nameLabel}${ANSI_RESET} ${statusText} ${driver}`);
        });
      }
    } else {
      const metricsByName = info.repositoryMetrics || {};
      parts.push(
        `${ansiColor(8)}  ${fitCell('명칭', 12)} ${fitCell('상태', 14)}${fitCell('드라이버', 12)} ${fitCell('호출', 6, 'right')} ${fitCell('에러', 6, 'right')} ${fitCell('평균', 8, 'right')}${ANSI_RESET}`
      );
      if (info.repositoryHealth) {
        Object.entries(info.repositoryHealth).forEach(([name, status]) => {
          const meta = metricsByName[name] || {};
          // [LOG_ID: 20260708_1030] fitCell은 표시폭을 문자 단위로 세므로, ANSI 색 코드를 먼저 섞은
          // 문자열을 넘기면 이스케이프 문자까지 폭으로 계산돼 정렬이 깨진다. 먼저 순수 텍스트를
          // 셀 폭에 맞게 자르고, 그 다음에 색을 입힌다.
          const nameLabel = fitCell(name.toUpperCase(), 12);
          const isOk = status.status === 'ok';
          const statusPlain = fitCell(isOk ? '정상 (OK)' : `오류 (${status.status})`, 14);
          const statusColor = isOk ? 10 : 12;
          const driver = fitCell(status.driver || meta.driver || 'unknown', 12);
          const calls = fitCell(meta.metrics?.calls || 0, 6, 'right');
          const errs = fitCell(meta.metrics?.errors || 0, 6, 'right');
          const avg = fitCell(`${meta.metrics?.avgDurationMs || 0}ms`, 8, 'right');
          parts.push(`  ${ansiColor(14)}${nameLabel}${ANSI_RESET} ${ansiColor(statusColor)}${statusPlain}${ANSI_RESET}${ansiColor(8)}${driver}${ansiColor(7)} ${calls} ${ansiColor(12)}${errs}${ansiColor(14)} ${avg}${ANSI_RESET}`);
        });
      }
    }
    parts.push(ansiHLine(targetCols, 8));

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
    // [LOG_ID: 20260708_1030] API가 ISO 8601 원문(2026-07-08T01:14:16.141Z)을 그대로 내려보내
    // 디버그 로그처럼 보이던 것을 다른 화면과 동일한 formatLongDate로 표시한다.
    parts.push(`  ${ansiColor(8)}기준 시각: ${formatLongDate(data.timestamp) || data.timestamp}${ANSI_RESET}`);

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

  return { buildActiveUsersAnsi, buildSystemDiagnosticsAnsi, buildActivitySummaryAnsi, buildSystemLogAnsi, buildProfileAnsi };
}
