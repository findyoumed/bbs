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
    readAt: row.read_at ?? row.readAt ?? null
  };
}

function canAccessMemo(memo, context = {}) {
  if (!memo) {
    return false;
  }
  if (context?.isAdmin) {
    return true;
  }
  return memo.recipientUserId === context?.userId || memo.senderUserId === context?.userId;
}

function validateMemoInput(input = {}) {
  const recipientUserId = normalizeText(input.recipientUserId || input.recipient || '');
  const title = normalizeText(input.title || '').slice(0, 60);
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

module.exports = {
  canAccessMemo,
  createHttpError,
  isMissingMemosTableError,
  normalizeMemo,
  normalizeText,
  validateMemoInput
};
