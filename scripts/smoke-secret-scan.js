#!/usr/bin/env node
'use strict';

/**
 * Read-only release guard: inspect tracked text files for high-confidence
 * credential shapes without printing file contents or matching values.
 * Environment files and generated/binary assets are intentionally excluded;
 * runtime secrets must remain in the deployment environment.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cfg', '.css', '.h', '.html', '.js', '.json', '.mjs',
  '.md', '.sql', '.txt', '.xml', '.yml', '.yaml'
]);
const EXCLUDED_NAMES = new Set(['.env', '.env.local', '.env.production', '.env.development']);
const SECRET_PATTERNS = [
  { name: 'supabase-service-role', regex: /(?:^|[\s"'=:(])sb_secret_[A-Za-z0-9_-]{20,}(?=$|[\s"'%),;])/ },
  { name: 'resend-api-key', regex: /(?:^|[\s"'=:(])re_[A-Za-z0-9_-]{24,}(?=$|[\s"'%),;])/ },
  { name: 'jwt-secret', regex: /(?:^|[\s"'=:(])eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?=$|[\s"'%),;])/ },
  { name: 'database-credential-url', regex: /(?:postgres(?:ql)?|mysql):\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/i }
];

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function isTextCandidate(file) {
  const normalized = file.replace(/\\/g, '/');
  const name = path.posix.basename(normalized);
  if (EXCLUDED_NAMES.has(name) || normalized.startsWith('node_modules/')) return false;
  return TEXT_EXTENSIONS.has(path.posix.extname(name).toLowerCase());
}

function scan() {
  const findings = [];
  for (const file of trackedFiles().filter(isTextCandidate)) {
    const fullPath = path.join(ROOT, file);
    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({ file, pattern: pattern.name });
      }
    }
  }
  return findings;
}

function main() {
  const findings = scan();
  const result = {
    ok: findings.length === 0,
    trackedTextFilesScanned: trackedFiles().filter(isTextCandidate).length,
    findings
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main();
