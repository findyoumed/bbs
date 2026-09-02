'use strict';

/**
 * Read-only Vercel Production environment contract.
 *
 * The Vercel CLI returns encrypted values in JSON. This smoke intentionally
 * discards every value and reports only key names, target environments, and
 * protection metadata.
 */
const { spawnSync } = require('child_process');

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ACTIVITY_REPOSITORY_DRIVER',
  'SUPABASE_ACTIVITY_TABLE',
  'BBS_ALLOWED_ORIGINS',
  'RESEND_API_KEY',
  'SYSOP_EMAIL',
  'SYSOP_MAIL_FROM'
];

const SECRET_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'];
const UNUSED_RUNTIME_CANDIDATES = ['DATABASE_URL', 'SUPABASE_DB_PASSWORD', 'CLAUDEMCP_TOKEN'];

function runVercelEnvList() {
  const args = ['--yes', 'vercel@latest', 'env', 'list', 'production', '--json'];
  const isWindows = process.platform === 'win32';
  const command = isWindows ? process.env.ComSpec : 'npx';
  const commandArgs = isWindows
    // All arguments are fixed constants without user input, so passing the
    // command through cmd.exe avoids the npx.cmd EINVAL behavior on Windows.
    ? ['/d', '/s', '/c', `npx.cmd ${args.join(' ')}`]
    : args;
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    timeout: 90000,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Vercel CLI could not list Production environment variables. Confirm CLI login and project linking.');
  }
  const output = String(result.stdout || '').trim();
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed.envs)) throw new Error('Unexpected Vercel environment response.');
  return parsed.envs;
}

function normalize(entry) {
  return {
    key: String(entry?.key || '').trim(),
    type: String(entry?.type || '').trim().toLowerCase(),
    visibility: entry?.visibility == null ? '' : String(entry.visibility).trim().toLowerCase(),
    target: Array.isArray(entry?.target) ? entry.target.map(String) : []
  };
}

function main() {
  let entries;
  try {
    entries = runVercelEnvList().map(normalize).filter((entry) => entry.key);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
    return;
  }

  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const missing = REQUIRED.filter((key) => !byKey.has(key) || !byKey.get(key).target.includes('production'));
  const wrongSecretProtection = SECRET_KEYS.filter((key) => {
    const entry = byKey.get(key);
    return !entry || entry.type !== 'sensitive' || entry.visibility !== 'secret';
  });
  const unusedCandidates = UNUSED_RUNTIME_CANDIDATES.filter((key) => byKey.has(key));
  const result = {
    ok: missing.length === 0 && wrongSecretProtection.length === 0,
    environment: 'production',
    requiredCount: REQUIRED.length,
    configuredRequiredCount: REQUIRED.length - missing.length,
    missing,
    wrongSecretProtection,
    unusedRuntimeCandidates: unusedCandidates,
    keyCount: entries.length
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main();
