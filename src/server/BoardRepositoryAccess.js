'use strict';

const { createHttpError } = require('./BoardRepositoryShared');

const LEVEL_NAME_MAP = {
  1: '일반회원',
  2: '특별회원',
  99: '운영자'
};

function levelLabel(level, levelAliases = LEVEL_NAME_MAP) {
  const normalized = Math.max(1, Number(level || 1) || 1);
  return levelAliases[normalized] || LEVEL_NAME_MAP[normalized] || `레벨 ${normalized}`;
}

function normalizeUserLevel(context) {
  if (context?.isAdmin) {
    return 99;
  }

  const raw = Number(context?.level ?? context?.userLevel ?? 1);
  if (!Number.isFinite(raw)) {
    return 1;
  }

  return Math.max(1, Math.floor(raw));
}

function assertBoardAccessible(board, context = {}, levelAliases = LEVEL_NAME_MAP) {
  if (!board) {
    throw createHttpError(404, '게시판을 찾을 수 없습니다.');
  }

  const requiredLevel = Math.max(1, Number(board.accessLevel || 1));
  if (normalizeUserLevel(context) < requiredLevel) {
    throw createHttpError(403, `${levelLabel(requiredLevel, levelAliases)} 이상만 접근할 수 있습니다.`);
  }
}

function assertBoardWritable(board, context, levelAliases = LEVEL_NAME_MAP) {
  assertBoardAccessible(board, context, levelAliases);

  if (board.writeSysopOnly && !context?.isAdmin) {
    throw createHttpError(403, '운영자만 글을 작성할 수 있는 게시판입니다.');
  }
}

function assertAuthenticatedBoardUser(context) {
  const userId = String(context?.userId || '').trim();
  const isGuestUser = Boolean(context?.isGuest) || !userId || userId.toLowerCase() === 'guest';

  if (isGuestUser) {
    throw createHttpError(401, '로그인이 필요한 서비스입니다.');
  }

  // [LOG: 20260731_1730] 대소문자 매칭 일치를 위해 일관된 소문자 ID 반환
  return userId.toLowerCase();
}

function assertPostMutable(post, context) {
  if (!post) {
    throw createHttpError(404, '게시글을 찾을 수 없습니다.');
  }

  if (context?.isAdmin) {
    return;
  }

  const requesterId = String(context?.userId || '').trim().toLowerCase();
  const authorId = String(post.userId || '').trim().toLowerCase();
  if (!requesterId || authorId !== requesterId) {
    throw createHttpError(403, '작성자만 수정 또는 삭제할 수 있습니다.');
  }
}

module.exports = {
  LEVEL_NAME_MAP,
  assertAuthenticatedBoardUser,
  assertBoardWritable,
  assertBoardAccessible,
  assertPostMutable
};
