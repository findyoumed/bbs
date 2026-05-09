'use strict';

const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolvePublishableKey(rootDir) {
  const direct = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (direct) return direct;
  const notePath = path.join(rootDir, 'supabase mcp.txt');
  if (!fs.existsSync(notePath)) return '';
  const match = fs.readFileSync(notePath, 'utf-8').match(/sb_publishable_[A-Za-z0-9_-]+/);
  return match ? match[0] : '';
}

module.exports = { loadEnv, assert, resolvePublishableKey };
