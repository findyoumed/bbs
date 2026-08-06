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
  return String(value ?? '').trim().toLowerCase();
}

function sameText(left, right) {
  return normalizeLookup(left) === normalizeLookup(right);
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
    updatedAt: String(row.updated_at ?? ''),
    // [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) — 하이텔·천리안 두 책 모두 확인된 기능.
    // 다른 회원이 나에게 쪽지를 쓸 때 이 값을 보고 "부재중" 안내를 띄울 수 있어야 하므로
    // toPublicMember가 걸러내는 목록(password/id/authUserId)에 넣지 않는다 — 의도적으로 공개.
    absentStart: row.absent_start ?? row.absentStart ?? null,
    absentEnd: row.absent_end ?? row.absentEnd ?? null,
    absentReason: String(row.absent_reason ?? row.absentReason ?? '')
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
    password: String(input.password ?? current?.password ?? '').trim(),
    // [LOG_ID: 20260722_3000] 프로필 수정(닉네임/이메일 등) 시 mergeMemberRecord를 거쳐도
    // 부재통지 설정이 지워지지 않도록 기존 값을 기본으로 보존한다.
    absentStart: input.absentStart !== undefined ? input.absentStart : (current?.absentStart ?? null),
    absentEnd: input.absentEnd !== undefined ? input.absentEnd : (current?.absentEnd ?? null),
    absentReason: input.absentReason !== undefined ? input.absentReason : (current?.absentReason ?? '')
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
    auth_user_id: member.authUserId,
    absent_start: member.absentStart ?? null,
    absent_end: member.absentEnd ?? null,
    absent_reason: member.absentReason ?? ''
  };

  if (String(member.registrationDateTime || '').trim()) {
    payload.registration_datetime = member.registrationDateTime;
  }

  if (String(member.lastLoginDateTime || '').trim()) {
    payload.lastlogin_datetime = member.lastLoginDateTime;
  }

  return payload;
}

function parseAbsentDateBoundary(dateStr, isEnd = false) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  // [LOG_ID: 20260731_1440] YYYY-MM-DD 단독 일자 형식인 경우 종료일은 당일 23:59:59.999까지를 포함한다.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const timeSuffix = isEnd ? 'T23:59:59.999' : 'T00:00:00.000';
    const parsed = Date.parse(`${trimmed}${timeSuffix}`);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

// [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) 활성 여부 판정 — 하이텔 책(그림 7.12)/
// 천리안 책(NOMAN, p.165) 둘 다 "부재 시작일"~"부재 종료일" 사이만 안내한다는 점이 동일했다.
// 시작일이 없으면 사유가 등록된 순간부터, 종료일이 없으면 수동 해제 전까지 무기한 활성으로 본다.
function isMemberAbsentNow(member, now = new Date()) {
  if (!member || !String(member.absentReason || '').trim()) {
    return false;
  }
  const nowMs = now.getTime();
  const startMs = parseAbsentDateBoundary(member.absentStart, false);
  const endMs = parseAbsentDateBoundary(member.absentEnd, true);
  if (startMs !== null && nowMs < startMs) {
    return false;
  }
  if (endMs !== null && nowMs > endMs) {
    return false;
  }
  return true;
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
    // [LOG_ID: 20260806_1600] AI 코딩 주석화 — console.log 주석 처리
    // console.log(`[MemberActivity] ${JSON.stringify(entry)}`);
  }
}

module.exports = {
  createHttpError,
  isMemberAbsentNow,
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
