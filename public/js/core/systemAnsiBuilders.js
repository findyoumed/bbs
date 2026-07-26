import { createAnsiBuilderUtils } from './ansiBuilderUtils.js';
import { isBuddy } from './chatBuddies.js';

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
    truncateDisplayText,
    wrapAnsiText
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
    // [LOG_ID: 20260726_0350] 닉네임은 한글 20자(표시폭 40칸)까지 허용되는데(authRoutes.js
    // maxLength:20) 이 row()는 값에 폭 제한이 전혀 없었다 — 게시글/안건/쪽지 제목처럼 자르기라도
    // 했던 앞선 3건과 달리 아예 아무 처리가 없어 뷰포트 밖으로 그대로 흘러넘쳤다(실측 재현: 20자
    // 닉네임으로 가입 후 프로필 조회 — documentElement.scrollWidth는 안 늘어나는데 화면 오른쪽
    // 끝을 넘어 잘려 보임, 조상 요소의 overflow-x:hidden 때문에 자동 오버플로 검사로는 못 잡는
    // 종류의 결함). 아이디는 영문/숫자 20자 제한(표시폭 20칸)이라 안전하지만 닉네임만 별도로
    // wrapAnsiText 처리한다.
    const rowWrapped = (label, value) => {
      const labelText = fitCell(label, labelWidth);
      const indent = ' '.repeat(labelWidth + 2);
      return wrapAnsiText(String(value), targetCols - labelWidth - 2).map((line, i) => (
        `  ${ansiColor(11)}${i === 0 ? labelText : indent}${ANSI_RESET}${i === 0 ? ': ' : '  '}${ansiColor(15)}${line}${ANSI_RESET}`
      )).join('\n');
    };

    parts.push('');
    parts.push(row('아이디', member.userId || '정보 없음'));
    parts.push(rowWrapped('닉네임', member.nickName || '정보 없음'));
    // [LOG_ID: 20260713_0930] 특별회원(레벨 2) 라벨 반영 — 서버 BoardRepositoryAccess.LEVEL_NAME_MAP과 동일
    parts.push(row('회원등급', `${member.level || 1} (${member.isAdmin ? '운영자' : (Number(member.level) >= 2 ? '특별회원' : '일반회원')})`));
    parts.push(row('가입일', formatLongDate(member.registrationDateTime) || '정보 없음'));
    parts.push(ansiHLine(targetCols, 8));

    return parts.join('\n');
  }

  // [LOG_ID: 20260716_1400] 하이텔 원전 (1)서비스안내-24.이용자검색(member/byid/byname) 화면.
  // 서버 API(/api/members/search)와 프로필 화면(buildProfileAnsi)은 이미 있었지만 이를 사용자에게
  // 노출하는 화면이 없어, 아이디를 정확히 아는 사람만 PF/WHO 명령으로 프로필을 볼 수 있었다
  // (닉네임으로 찾을 방법은 아예 없었다).
  function buildMemberSearchAnsi(options = {}) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const cmdWidth = isMobile ? 18 : 22;

    const parts = [
      buildTopHeader({ leftLabel: 'WHO', centerLabel: '이용자 검색 (MEMBER)' }, '', targetCols)
    ];

    parts.push('');
    // 44칸(모바일)을 넘기지 않도록 안내 문구를 화면 폭에 맞춰 나눈다.
    parts.push(isMobile
      ? `  ${ansiColor(15)}아이디 또는 이름을 입력하세요.${ANSI_RESET}`
      : `  ${ansiColor(15)}찾으려는 이용자의 아이디 또는 이름(닉네임)을 입력하십시오.${ANSI_RESET}`);
    parts.push('');
    parts.push(ansiHLine(targetCols, 8));
    parts.push(`  ${ansiColor(11)}${fitCell('BYID   <아이디>', cmdWidth)}${ANSI_RESET}${ansiColor(15)}아이디로 찾기${ANSI_RESET}`);
    parts.push(`  ${ansiColor(11)}${fitCell('BYNAME <이름>', cmdWidth)}${ANSI_RESET}${ansiColor(15)}이름으로 찾기${ANSI_RESET}`);
    parts.push(ansiHLine(targetCols, 8));
    parts.push('');
    parts.push(isMobile
      ? `  ${ansiColor(8)}그냥 입력하면 아이디부터 찾습니다.${ANSI_RESET}`
      : `  ${ansiColor(8)}명령 없이 그냥 입력하면 아이디, 이름 순서로 찾습니다.${ANSI_RESET}`);

    const notFound = String(options.notFoundQuery || '').trim();
    if (notFound) {
      parts.push('');
      // 모바일(44칸)에서는 검색어를 12칸으로 줄이고 문구도 짧게 — 아이디를 길게 넣으면
      // 원래 문구("...이용자를 찾을 수 없습니다.")가 45칸으로 1칸 넘쳤다(폭 검증에서 발견).
      parts.push(isMobile
        ? `  ${ansiColor(12)}'${truncateDisplayText(notFound, 12)}' 이용자가 없습니다.${ANSI_RESET}`
        : `  ${ansiColor(12)}'${truncateDisplayText(notFound, 30)}' 이용자를 찾을 수 없습니다.${ANSI_RESET}`);
    }

    return parts.join('\n');
  }

  // [LOG_ID: 20260716_2200] 하이텔 (1)-25 접속통계(account) 계열 — 내 이용 현황.
  // 원전은 접속 횟수·사용 시간·요금을 보여줬지만 이 앱은 세션을 기록하지 않아 그 수치는 없다.
  // 없는 값을 지어내는 대신 실제로 가진 것만 보여준다.
  function buildMyStatsAnsi(stats) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const targetCols = isMobile ? 44 : 80;
    const labelWidth = isMobile ? 12 : 16;

    const parts = [
      buildTopHeader({ leftLabel: 'ACCT', centerLabel: '이용 현황 (ACCOUNT)' }, '', targetCols)
    ];

    if (!stats) {
      parts.push('');
      parts.push(`  ${ansiColor(12)}이용 현황을 불러오지 못했습니다.${ANSI_RESET}`);
      return parts.join('\n');
    }

    const row = (label, value) => `  ${ansiColor(11)}${fitCell(label, labelWidth)}${ANSI_RESET}: ${ansiColor(15)}${value}${ANSI_RESET}`;
    const gradeName = stats.isAdmin ? '운영자' : (Number(stats.level) >= 2 ? '특별회원' : '일반회원');

    parts.push('');
    parts.push(`  ${ansiColor(14)}[ 계정 ]${ANSI_RESET}`);
    parts.push(row('아이디', stats.userId || '-'));
    parts.push(row('닉네임', stats.nickName || '-'));
    parts.push(row('회원등급', `${stats.level || 1} (${gradeName})`));
    parts.push(row('가입일', formatLongDate(stats.registrationDateTime) || '정보 없음'));
    parts.push(row('최근 접속', formatLongDate(stats.lastLoginDateTime) || '기록 없음'));
    parts.push(ansiHLine(targetCols, 8));

    parts.push(`  ${ansiColor(14)}[ 게시물 ]${ANSI_RESET}`);
    parts.push(row('올린 글', `${stats.postCount || 0} 편`));
    parts.push(row('받은 조회', `${stats.hitsSum || 0} 회`));
    parts.push(row('받은 추천', `${stats.recommendSum || 0} 회`));
    parts.push(ansiHLine(targetCols, 8));

    parts.push(`  ${ansiColor(14)}[ 전자우편 ]${ANSI_RESET}`);
    parts.push(row('받은 쪽지', `${stats.memoInbox || 0} 통 (안 읽음 ${stats.memoUnread || 0})`));
    parts.push(row('보낸 쪽지', `${stats.memoSent || 0} 통`));
    parts.push(row('보관한 쪽지', `${stats.memoArchived || 0} 통`));
    parts.push(ansiHLine(targetCols, 8));

    // 원전에 있던 "사용 시간/요금"이 왜 없는지 화면에서도 분명히 밝힌다.
    parts.push(isMobile
      ? `  ${ansiColor(8)}접속 시간·요금은 집계하지 않습니다.${ANSI_RESET}`
      : `  ${ansiColor(8)}이 서비스는 접속 시간과 이용 요금을 집계하지 않습니다.${ANSI_RESET}`);

    return parts.join('\n');
  }

  // [LOG_ID: 20260726_0230] W(WHO) 화면의 "위치" 칸은 API 경로(user.path, 예: "/api/boards/notice")를
  // 그대로 fitCell로 자르는데, 컬럼 폭(모바일 15/데스크톱 24)보다 흔히 더 긴 경로가 많아
  // "/api/boards/not"처럼 잘려서 마치 다른(존재하지 않는) 경로처럼 오인되기 쉬웠다(실측 확인 —
  // 실제 값은 "/api/boards/notice"). 관리자 진단 화면이라 정확한 값 파악이 중요하므로, 잘렸을 땐
  // 말줄임표를 붙여 "이 값은 잘린 것"임을 명시한다.
  function fitCellEllipsis(text, maxWidth) {
    const source = String(text || '');
    if (displayWidth(source) <= maxWidth) {
      return fitCell(source, maxWidth);
    }
    return fitCell(`${truncateDisplayText(source, Math.max(1, maxWidth - 1))}…`, maxWidth);
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
        // [LOG_ID: 20260719_2200] 버디 강조(★) — ★는 이 폰트에서 광폭(2칸) 문자라 기존 leading
        // 공백 두 칸("  ")과 폭이 정확히 같으므로 그대로 치환해도 컬럼 정렬이 흐트러지지 않는다.
        const buddyPrefix = isBuddy(user.userId) ? `${ansiColor(11)}★${ANSI_RESET}` : '  ';
        if (isMobile) {
          const id = fitCell(user.userId || 'guest', 12);
          const nick = fitCell(user.nickName || '손님', 12);
          const path = fitCellEllipsis(user.path || '/', 15);
          const color = user.isAdmin ? 13 : (user.isGuest ? 8 : 15);
          parts.push(`${buddyPrefix}${ansiColor(color)}${id} ${nick} ${ansiColor(14)}${path}${ANSI_RESET}`);
        } else {
          const id = fitCell(user.userId || 'guest', 15);
          const nick = fitCell(user.nickName || '손님', 16);
          const path = fitCellEllipsis(user.path || '/', 24);
          const time = (user.lastSeenAt || '').split('T')[1]?.split('.')[0] || '--:--:--';
          const color = user.isAdmin ? 13 : (user.isGuest ? 8 : 15);
          parts.push(`${buddyPrefix}${ansiColor(color)}${id} ${nick} ${ansiColor(14)}${path} ${ansiColor(7)}${time}${ANSI_RESET}`);
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
      // [LOG_ID: 20260726_0230] 원래 문구("SYSTEM DIAGNOSTIC LOGS")가 표시폭 36칸으로,
      // 우측 페이지 라벨("(최근 N건)")까지 더해지면 모바일(44칸) 상단바 예산을 넘겨
      // 가운데 제목이 두 줄로 줄바꿈돼 잘려 보였다(다른 화면들과 실측 비교로 확인 —
      // ACT/SYSINFO 등 페이지 라벨이 없는 화면은 폭 여유가 더 있어 문제없었음). SYSINFO
      // 화면처럼 명령어 이름을 그대로 괄호에 쓰는 방식으로 줄인다.
      buildTopHeader({ leftLabel: 'LOG', centerLabel: '시스템 로그 (SYSLOG)' }, `(최근 ${logs.length}건)`, targetCols)
    ];

    if (isMobile) {
      // [LOG_ID: 20260726_0230] "메시재"는 "메시지"의 오타 — 모바일 육안 점검 중 발견.
      parts.push(`${ansiColor(11)}  시간   레벨 메시지${ANSI_RESET}`);
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

        // [LOG_ID: 20260726_0230] W(WHO) 화면과 동일한 이유로 — 로그 메시지가 칸 폭보다 길면
        // 말줄임표 없이 그냥 잘려 다른 메시지처럼 오인되기 쉬웠다(예: "Command: SYSLOG (norm:
        // SYSLO" — 원문은 "...SYSLOG)"). 잘렸을 땐 말줄임표를 붙인다.
        const maxMsg = targetCols - (isMobile ? 16 : 20);
        const msg = fitCellEllipsis(l.message, maxMsg).replace(/\s+$/g, '');
        parts.push(`  ${ansiColor(8)}${time} ${ansiColor(levelColor)}${level} ${ansiColor(15)}${msg}${ANSI_RESET}`);
      });
    }

    return parts.join('\n');
  }

  return { buildActiveUsersAnsi, buildSystemDiagnosticsAnsi, buildActivitySummaryAnsi, buildSystemLogAnsi, buildProfileAnsi, buildMemberSearchAnsi, buildMyStatsAnsi };
}
