/**
 * Release gate for the deployed BBS.
 *
 * This intentionally composes existing deterministic checks instead of
 * duplicating their assertions. It validates the local artifact first, then
 * exercises every supported mobile viewport and the live Production API/UI.
 * It never deploys; deployment remains an explicit follow-up step.
 */
'use strict';

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['check', 'Supabase/repository readiness'],
  ['build', 'Vercel artifact contract'],
  ['loop:verify', 'deterministic local regression gate'],
  ['smoke:mobile', 'mobile and responsive browser flows'],
  ['smoke:production', 'Production API/security smoke'],
  ['smoke:production-ui', 'Production UI geometry/font smoke'],
  ['smoke:production-interactions', 'Production click/keyboard/touch smoke'],
  ['smoke:production-performance', 'Production startup performance smoke']
];

function runStep(script, description) {
  const startedAt = Date.now();
  console.log(`\n▶ ${script} — ${description}`);
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : npmCommand;
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `${npmCommand} run ${script}`]
    : ['run', script];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });
  const durationMs = Date.now() - startedAt;
  const passed = result.status === 0 && !result.error;
  console.log(`${passed ? '✓' : '✗'} ${script} (${durationMs}ms)`);
  if (!passed) {
    const reason = result.error?.message || `exit code ${result.status}`;
    throw new Error(`${script} failed: ${reason}`);
  }
}

function main() {
  const startedAt = Date.now();
  for (const [script, description] of steps) {
    runStep(script, description);
  }
  console.log(JSON.stringify({
    ok: true,
    steps: steps.map(([script]) => script),
    durationMs: Date.now() - startedAt,
    deployment: 'not performed'
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exit(1);
}
