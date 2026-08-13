'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const loopPath = path.join(projectRoot, 'scripts', 'codex-repl-loop.js');

const syntax = spawnSync(process.execPath, ['--check', loopPath], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});
assert.strictEqual(syntax.status, 0, syntax.stderr || syntax.stdout);

const dryRun = spawnSync(process.execPath, [
  loopPath,
  '--dry-run',
  '--max',
  '1',
  'loop runner smoke task',
  '--verify',
  'node --check scripts/codex-repl-loop.js'
], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

assert.strictEqual(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
assert.match(dryRun.stdout, /DRY RUN/);
assert.match(dryRun.stdout, /node --check scripts\/codex-repl-loop\.js/);

console.log(JSON.stringify({ ok: true, syntax: 'pass', dryRun: 'pass' }));
