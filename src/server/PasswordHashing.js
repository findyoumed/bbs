'use strict';

// [LOG_ID: 20260721_1900] 회원 비밀번호가 members.password 컬럼에 평문으로 저장·비교되고 있었다
// (DB/백업 접근권 또는 서비스 롤 키 유출 시 전체 회원 비밀번호가 그대로 노출) — 코드 감사로 발견.
// bcrypt 등 새 npm 패키지 추가는 승인이 필요해(CLAUDE.md) Node 내장 crypto.scrypt(양방향
// 복호화 불가한 솔트 기반 KDF)로 해싱한다. 저장 형식: "scrypt$<salt-hex>$<key-hex>".
// 기존 평문 계정과의 마이그레이션: verifyPasswordHash가 저장값이 해시 형식이 아니면 레거시
// 평문 비교로 폴백하고, 각 리포지토리의 verifyPassword가 그 성공 시 즉시 해시로 재저장한다
// (로그인 시점에 조용히 마이그레이션 — 계정 잠김 없음).
const crypto = require('crypto');

const HASH_PREFIX = 'scrypt$';
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password ?? ''), salt, KEY_LENGTH);
  return `${HASH_PREFIX}${salt}$${derivedKey.toString('hex')}`;
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith(HASH_PREFIX);
}

function verifyPasswordHash(password, stored) {
  const storedStr = String(stored ?? '');
  if (!storedStr) {
    return false;
  }
  if (!isHashedPassword(storedStr)) {
    // 레거시 평문 비밀번호 — 아직 마이그레이션되지 않은 기존 계정과의 호환.
    return storedStr === String(password ?? '');
  }
  const parts = storedStr.slice(HASH_PREFIX.length).split('$');
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) {
    return false;
  }
  let keyBuffer;
  try {
    keyBuffer = Buffer.from(keyHex, 'hex');
  } catch {
    return false;
  }
  if (keyBuffer.length === 0) {
    return false;
  }
  const derivedKey = crypto.scryptSync(String(password ?? ''), salt, keyBuffer.length);
  return crypto.timingSafeEqual(derivedKey, keyBuffer);
}

module.exports = { hashPassword, isHashedPassword, verifyPasswordHash };
