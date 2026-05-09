'use strict';

const { createHttpError, isMissingTableError } = require('./httpUtils');

function normalizeLevel(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(99, Math.floor(parsed)));
}

function normalizeLookup(value) {
  return String(value ?? '').trim();
}

function sameText(left, right) {
  return normalizeLookup(left).toLowerCase() === normalizeLookup(right).toLowerCase();
}

function normalizeMember(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    authUserId: row.auth_user_id || null,
    userId: String(row.user_id ?? row.userId ?? 'guest'),
    nickName: String(row.nick_name ?? row.nickName ?? row.user_id ?? row.userId ?? '회원'),
    email: String(row.email ?? ''),
    birthday: String(row.birthday ?? ''),
    sex: String(row.sex ?? 'M'),
    level: normalizeLevel(row.level, 1),
    isOpen: row.is_open === undefined ? Boolean(row.isOpen ?? true) : Boolean(row.is_open),
    isAdmin: Boolean(row.is_admin ?? row.isAdmin ?? false),
    registrationDateTime: String(row.registration_datetime ?? row.registrationDateTime ?? row.created_at ?? row.createdAt ?? ''),
    lastLoginDateTime: String(row.lastlogin_datetime ?? row.lastLoginDateTime ?? ''),
    updatedAt: String(row.updated_at ?? '')
  };
}

function toPublicMember(member) {
  if (!member) {
    return null;
  }
  const { password, id, authUserId, ...rest } = member;
  return { ...rest };
}

function isMissingMembersTableError(error, tableName = 'members') {
  return isMissingTableError(error, tableName);
}

function mergeMemberRecord(userId, current = null, input = {}) {
  const normalizedUserId = normalizeLookup(userId || input.userId);
  if (!normalizedUserId) {
    throw createHttpError(400, '회원 ID가 필요합니다.');
  }

  return {
    authUserId: input.authUserId ?? current?.authUserId ?? null,
    userId: normalizedUserId,
    nickName: String(input.nickName ?? current?.nickName ?? normalizedUserId).trim() || normalizedUserId,
    email: String(input.email ?? current?.email ?? '').trim(),
    birthday: String(input.birthday ?? current?.birthday ?? '').trim(),
    sex: String(input.sex ?? current?.sex ?? 'M').trim() || 'M',
    level: normalizeLevel(input.level, current?.level || 1),
    isOpen: Boolean(input.isOpen ?? current?.isOpen ?? true),
    isAdmin: Boolean(input.isAdmin ?? current?.isAdmin ?? false),
    registrationDateTime: String(input.registrationDateTime ?? current?.registrationDateTime ?? '').trim(),
    lastLoginDateTime: String(input.lastLoginDateTime ?? current?.lastLoginDateTime ?? '').trim(),
    password: String(input.password ?? current?.password ?? '').trim()
  };
}

function toSupabaseMemberPayload(member) {
  const payload = {
    user_id: member.userId,
    nick_name: member.nickName,
    email: member.email,
    birthday: member.birthday,
    sex: member.sex,
    level: member.isAdmin ? 99 : member.level,
    is_open: member.isOpen,
    is_admin: member.isAdmin,
    password: member.password,
    auth_user_id: member.authUserId
  };

  if (String(member.registrationDateTime || '').trim()) {
    payload.registration_datetime = member.registrationDateTime;
  }

  if (String(member.lastLoginDateTime || '').trim()) {
    payload.lastlogin_datetime = member.lastLoginDateTime;
  }

  return payload;
}

/**
 * Evolution: 감사 로그 기록 (플레이스홀더)
 * 향후 실제 DB 테이블이나 외부 로깅 서비스와 연동 가능
 */
async function logMemberActivity(deps, activity) {
  const { logger } = deps;
  const entry = {
    timestamp: new Date().toISOString(),
    ...activity
  };
  if (logger && typeof logger.info === 'function') {
    logger.info(`[MemberActivity] ${JSON.stringify(entry)}`);
  } else {
    console.log(`[MemberActivity] ${JSON.stringify(entry)}`);
  }
}

module.exports = {
  createHttpError,
  isMissingMembersTableError,
  mergeMemberRecord,
  normalizeLevel,
  normalizeLookup,
  normalizeMember,
  sameText,
  toPublicMember,
  toSupabaseMemberPayload,
  logMemberActivity
};
