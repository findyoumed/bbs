'use strict';

const { createHttpError, normalizeMultilineText, normalizeText, isMissingTableError } = require('./httpUtils');

function normalizeMemo(row) {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id ?? row.no ?? 0),
    senderUserId: String(row.sender_user_id ?? row.sender_id ?? row.senderUserId ?? 'guest'),
    recipientUserId: String(row.recipient_user_id ?? row.receiver_id ?? row.recipientUserId ?? 'guest'),
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    isRead: Boolean(row.is_read ?? row.isRead ?? false),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    readAt: row.read_at ?? row.readAt ?? null,
    // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox). memos 테이블에 sender_archived /
    // receiver_archived 컬럼이 이미 있었는데 코드가 전혀 쓰지 않고 있었다 — 스키마 추가 없이
    // 보관함을 만들 수 있었다. 보낸 쪽지는 sender_archived, 받은 쪽지는 receiver_archived로
    // 각자 따로 보관한다(같은 쪽지를 보낸이와 받은이가 독립적으로 보관/해제).
    senderArchived: Boolean(row.sender_archived ?? row.senderArchived ?? false),
    recipientArchived: Boolean(row.receiver_archived ?? row.recipientArchived ?? false)
  };
}

// 이 사용자가 이 쪽지를 "보관"했는지 — 받은 쪽지면 receiver_archived, 보낸 쪽지면 sender_archived.
// (자기 자신에게 보낸 쪽지는 받은 쪽 기준을 우선한다.)
function isArchivedFor(memo, userId) {
  if (!memo) return false;
  const normalizedUserId = String(userId || '').trim().toLowerCase();
  if (memo.recipientUserId === normalizedUserId) return Boolean(memo.recipientArchived);
  if (memo.senderUserId === normalizedUserId) return Boolean(memo.senderArchived);
  return false;
}

function canAccessMemo(memo, context = {}) {
  if (!memo) {
    return false;
  }
  if (context?.isAdmin) {
    return true;
  }
  // [LOG: 20260731_1700] 대소문자 매칭 일치를 위해 소문자 정규화 처리
  const userId = String(context?.userId || '').trim().toLowerCase();
  return memo.recipientUserId === userId || memo.senderUserId === userId;
}

// [LOG_ID: 20260729_0030] memoRoutes.js의 getCreateMemoBody()는 이미 제목을 200자까지
// 검증·허용하는데(`title.length > 200`이어야 거부), 여기 저장 단계는 60자로 조용히 잘랐다 —
// 대화방 제목(검증 100자 vs 저장 60자)에서 고친 것과 동일한 "검증이 약속하는 값과 저장
// 상한이 다른" 패턴. memos.title은 스키마상 TEXT라 길이 제약이 없으므로(0001_initial_schema.sql),
// 저장 상한을 검증이 이미 약속하는 200자에 맞춘다.
const MEMO_TITLE_MAX_LENGTH = 200;

function validateMemoInput(input = {}) {
  const recipientUserId = normalizeText(input.recipientUserId || input.recipient || '');
  const title = normalizeText(input.title || '').slice(0, MEMO_TITLE_MAX_LENGTH);
  const content = normalizeMultilineText(input.content ?? '').trimEnd();

  if (!recipientUserId) {
    throw createHttpError(400, '받는 사람 ID를 입력해 주세요.');
  }
  if (!title) {
    throw createHttpError(400, '메모 제목을 입력해 주세요.');
  }
  if (!content.trim()) {
    throw createHttpError(400, '메모 본문을 입력해 주세요.');
  }

  return { recipientUserId, title, content };
}

function isMissingMemosTableError(error, tableName = 'memos') {
  return isMissingTableError(error, tableName);
}

// [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — "hong,kim lee" 처럼 쉼표/세미콜론/공백으로
// 나열한 수신자를 목록으로 만든다. 중복(대소문자 무시)은 한 번만 남긴다 — 같은 사람에게
// 같은 쪽지가 두 통 가지 않도록.
// [LOG_ID: 20260731_1510] 수신자 아이디 소문자 정규화 — Hong 등 대소문자 혼용 입력 시에도 소문자로 통일하여 수신함 조회 누락을 방지한다.
function parseRecipients(raw) {
  const seen = new Set();
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => {
      if (!entry) return false;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

module.exports = {
  canAccessMemo,
  createHttpError,
  isArchivedFor,
  isMissingMemosTableError,
  normalizeMemo,
  normalizeText,
  parseRecipients,
  validateMemoInput
};
