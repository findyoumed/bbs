'use strict';

/**
 * Read-only smoke checks for the deployed www-bbs origin.
 *
 * Usage:
 *   npm run smoke:production
 *   BBS_PRODUCTION_URL=https://01410.vercel.app npm run smoke:production
 *
 * This deliberately avoids login, writes, email delivery, and mutation APIs.
 */

const DEFAULT_ORIGIN = 'https://01410.vercel.app';
const origin = String(process.env.BBS_PRODUCTION_URL || DEFAULT_ORIGIN)
  .trim()
  .replace(/\/+$/, '');
const timeoutMs = Math.max(3000, Number(process.env.PRODUCTION_SMOKE_TIMEOUT_MS) || 20000);

if (!/^https:\/\//i.test(origin)) {
  throw new Error('BBS_PRODUCTION_URL must be an https origin');
}

const checks = [
  { path: '/', statuses: [200], label: 'app shell' },
  {
    path: '/api/boards',
    statuses: [200],
    label: 'board directory',
    // CSP is applied to static HTML responses; JSON APIs retain the other
    // transport/security headers without pretending to be document content.
    requiredHeaders: ['x-content-type-options', 'x-frame-options', 'referrer-policy']
  },
  { path: '/api/boards/plaza?page=1&pageSize=15', statuses: [200], label: 'plaza listing' },
  { path: '/api/boards/tosysop?page=1&pageSize=15', statuses: [200], label: 'sysop listing' },
  { path: '/api/menu', statuses: [200], label: 'menu resolver' },
  {
    path: '/api/health',
    statuses: [200],
    label: 'repository health',
    requiredHeaders: ['x-content-type-options', 'x-frame-options', 'referrer-policy']
  },
  { path: '/api/auth/session', statuses: [200], label: 'anonymous session' },
  { path: '/memo', statuses: [200], label: 'memo shell' },
  { path: '/guide/tosysop', statuses: [200], label: 'sysop guide shell' },
  { path: '/api/memos', statuses: [401], label: 'memo auth boundary', safeResponse: true },
  { path: '/api/memos/unread/count', statuses: [401], label: 'unread memo count auth boundary', safeResponse: true },
  { path: '/api/memos/1/read', method: 'POST', body: '{}', statuses: [401], label: 'memo read auth boundary', safeResponse: true },
  { path: '/api/memos/unread', statuses: [401, 404], label: 'legacy unread memo boundary', safeResponse: true },
  { path: '/api/members', statuses: [401, 403], label: 'member directory admin boundary', safeResponse: true },
  { path: '/api/members/absent', statuses: [401], label: 'member absence auth boundary', safeResponse: true },
  { path: '/api/members/stats', statuses: [401], label: 'member stats auth boundary', safeResponse: true },
  { path: '/api/boards/plaza/posts', method: 'POST', body: '{}', statuses: [401], label: 'post create auth boundary', safeResponse: true },
  { path: '/api/contact-sysop', method: 'POST', body: '{}', statuses: [401], label: 'sysop contact auth boundary', safeResponse: true },
  { path: '/api/chat/rooms', method: 'POST', body: '{}', statuses: [401], label: 'chat room create auth boundary', safeResponse: true },
  { path: '/api/conf/rooms', method: 'POST', body: '{}', statuses: [401], label: 'conf room create auth boundary', safeResponse: true },
  { path: '/api/votes', method: 'POST', body: '{}', statuses: [401], label: 'vote create auth boundary', safeResponse: true },
  { path: '/api/members/guest', statuses: [200], label: 'guest profile' },
  { path: '/api/members/search?nickName=__production_smoke_missing__&allowMissing=1', statuses: [200], label: 'member lookup' }
];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json,text/html;q=0.9',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
      signal: controller.signal
    });
    const body = await response.text();
    return { status: response.status, body, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const failures = [];
  console.log(`🚀 Production smoke: ${origin}`);
  for (const check of checks) {
    const url = `${origin}${check.path}`;
    try {
      const result = await fetchWithTimeout(url, {
        method: check.method,
        body: check.body
      });
      const ok = check.statuses.includes(result.status);
      console.log(`  ${ok ? '✓' : '✗'} ${check.label}: ${result.status} ${check.path}`);
      if (!ok) {
        let detail = '';
        try {
          const payload = JSON.parse(result.body);
          detail = payload?.data?.services?.database?.detail || payload?.message || '';
        } catch {
          // Keep the status-only failure when the response is not JSON.
        }
        failures.push(`${check.label} expected ${check.statuses.join('/')} but received ${result.status}${detail ? ` (${detail})` : ''}`);
      }
      if (check.safeResponse && /(service[_ -]?role|postgres(?:ql)?:\/\/|unregistered api key|supabase\.co|stack\s*:\s*error)/i.test(result.body)) {
        failures.push(`${check.label} exposed an upstream/database detail in its client response`);
      }
      if (!result.body.trim()) failures.push(`${check.label} returned an empty body`);
      for (const header of check.requiredHeaders || []) {
        if (!result.headers.has(header)) failures.push(`${check.label} is missing ${header}`);
      }
    } catch (error) {
      failures.push(`${check.label} failed: ${error.name === 'AbortError' ? 'timeout' : error.message}`);
      console.log(`  ✗ ${check.label}: ${error.message}`);
    }
  }

  const corsCases = [
    { origin: origin, expectedAllowOrigin: origin, label: 'allowlisted CORS preflight' },
    { origin: 'https://example.com', expectedAllowOrigin: null, label: 'unlisted CORS preflight' }
  ];
  for (const corsCase of corsCases) {
    try {
      const result = await fetchWithTimeout(`${origin}/api/boards`, {
        method: 'OPTIONS',
        headers: {
          Origin: corsCase.origin,
          'Access-Control-Request-Method': 'GET'
        }
      });
      const allowOrigin = result.headers.get('access-control-allow-origin');
      console.log(`  ${result.status === 204 && allowOrigin === corsCase.expectedAllowOrigin ? '✓' : '✗'} ${corsCase.label}: ${result.status} ACAO=${allowOrigin || '(none)'}`);
      if (result.status !== 204) failures.push(`${corsCase.label} expected 204 but received ${result.status}`);
      if (allowOrigin !== corsCase.expectedAllowOrigin) {
        failures.push(`${corsCase.label} expected ACAO ${corsCase.expectedAllowOrigin || '(none)'} but received ${allowOrigin || '(none)'}`);
      }
    } catch (error) {
      failures.push(`${corsCase.label} failed: ${error.name === 'AbortError' ? 'timeout' : error.message}`);
    }
  }

  const summary = { ok: failures.length === 0, origin, checks: checks.length, failures };
  if (failures.some((failure) => failure.includes('ACAO'))) {
    summary.hints = summary.hints || [];
    summary.hints.push('Set BBS_ALLOWED_ORIGINS to the exact deployed HTTPS origin in Vercel Production.');
  }
  if (failures.some((failure) => failure.includes('member') || failure.includes('profile'))) {
    summary.hints = summary.hints || [];
    summary.hints.push('Verify SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY in Vercel Production.');
  }
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
