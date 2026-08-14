/**
 * [LOG_ID: 20260719_1000] Loop Engineering 완료 게이트 (증거 기반 완료 판정).
 *
 * 루프 엔지니어링의 핵심은 "AI의 느낌"이 아니라 "테스트·증거"로 완료를 판정하는 것이다.
 * 이 스크립트는 오프라인 스모크 + 최종 QA를 순차로 돌려 단일 pass/fail을 낸다.
 * 루프(/ralph-loop, /loop)의 완료 조건으로 `npm run loop:verify` 통과를 걸어 쓴다.
 *
 * 빠른 게이트: 느리거나 외부 의존적(비결정적)인 것은 제외한다 —
 *   - smoke-full-traversal (브라우저 전 라우트 순회, 느림)
 *   - smoke-supabase-live / realtime / auth-write (실시간 Supabase 필요)
 *   - smoke-rss-services (라이브 뉴스 피드를 긁어 특정 기사 구조에서 파서가 깨질 수 있음 —
 *       [LOG_ID: 20260719_1400] 루프를 실제로 돌려보니 "영유아 실내마스크" 등 실시간 기사에서
 *       비결정적으로 실패(재실행 시 문제 기사가 로테이션되면 통과). 게이트는 결정적이어야 하므로
 *       제외한다. 뉴스 RSS 자체 점검은 `npm run smoke:rss-services`로 수동 실행.)
 * 이들은 배포 직전 수동으로 별도 실행한다.
 *
 * 각 스모크는 실패 시 throw(비정상 종료) 또는 process.exit(1)로 끝나므로,
 * 집계는 서브프로세스 종료코드만으로 신뢰할 수 있다.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const CHECK_TIMEOUT_MS = 120000;

// 순서대로 실행(각 스모크가 자체 http 서버를 띄우므로 순차 실행으로 포트 충돌을 피한다).
const CHECKS = [
  { name: 'boards', file: 'smoke-boards.js' },
  { name: 'bootstrap-concurrency', file: 'smoke-bootstrap-concurrency.js' },
  { name: 'post-navigation', file: 'smoke-post-navigation.js' },
  { name: 'post-read-dedupe', file: 'smoke-post-read-dedupe.js' },
  { name: 'post-service-cache', file: 'smoke-post-service-cache.js' },
  { name: 'loop-runner', file: 'smoke-loop-runner.js' },
  { name: 'command-parity', file: 'smoke-command-parity.js' },
  { name: 'menu-wiring', file: 'smoke-menu-wiring.js' },
  { name: 'signup-ime', file: 'smoke-signup-ime.mjs' },
  { name: 'renderer-ui', file: 'smoke-renderer-ui.js' },
  { name: 'chat-rooms', file: 'smoke-chat-rooms.js' },
  { name: 'auth-bridge', file: 'smoke-auth-bridge.js' },
  { name: 'vercel-ready', file: 'smoke-vercel-ready.js' },
  { name: 'qa:final', file: 'final-qa-report.js' }
];

function runCheck(check) {
  const scriptPath = path.join(projectRoot, 'scripts', check.file);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    // 출력을 캡처(콘솔로 스트리밍하지 않음) — 실패 항목만 증거를 뒤에 모아 출력한다.
    stdio: ['ignore', 'pipe', 'pipe'],
    // 넉넉한 버퍼(일부 스모크는 출력이 길다).
    maxBuffer: 32 * 1024 * 1024,
    timeout: CHECK_TIMEOUT_MS,
    killSignal: 'SIGTERM'
  });
  const durationMs = Date.now() - startedAt;
  const ok = result.status === 0 && !result.error;
  return {
    name: check.name,
    ok,
    durationMs,
    status: result.status,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
    // 실패 증거: stderr 우선, 없으면 stdout 끝부분.
    evidence: ok ? '' : String(result.stderr || result.stdout || result.error?.message || '').trim()
  };
}

function tail(text, maxLines = 20) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

function main() {
  console.log('── Loop Engineering 완료 게이트 (loop:verify) ──');
  console.log(`검증 항목 ${CHECKS.length}개 · 순차 실행\n`);

  const results = [];
  for (const check of CHECKS) {
    process.stdout.write(`  ▶ ${check.name} ... `);
    const r = runCheck(check);
    results.push(r);
    console.log(`${r.ok ? 'PASS' : 'FAIL'} (${r.durationMs}ms)`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('\n── 결과 요약 ──');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(16)} ${String(r.durationMs).padStart(7)}ms`);
  }

  if (failed.length) {
    console.log('\n── 실패 항목 증거 ──');
    for (const r of failed) {
      console.log(`\n[${r.name}] (exit ${r.status})`);
      console.log(tail(r.evidence));
    }
  }

  const summary = { ok: failed.length === 0, passed, failed: failed.length, total: results.length };
  console.log('\n' + JSON.stringify(summary));

  if (!summary.ok) {
    console.log('\n완료 게이트 실패 — 위 실패 항목을 고친 뒤 다시 돌리세요.');
    process.exit(1);
  }
  console.log('\n완료 게이트 통과 — 모든 검증이 초록입니다.');
  process.exit(0);
}

main();
