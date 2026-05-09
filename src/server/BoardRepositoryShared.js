'use strict';

const {
  createHttpError,
  maybeUuid,
  normalizeMultilineText,
  stripControlCharacters
} = require('./httpUtils');
const { buildPaginationMetadata } = require('./queryUtils');

const isUuid = (value) => maybeUuid(value) !== null;

const MAX_TITLE_LENGTH = 60;
const MAX_CONTENT_LENGTH = 65536;
const MAX_USER_ID_LENGTH = 120;
const MAX_NICKNAME_LENGTH = 40;
const MAX_CATEGORY_LENGTH = 20;

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function normalizeInlineText(value, maxLength) {
  return String(stripControlCharacters(value)).trim().slice(0, Math.max(0, Number(maxLength) || 0));
}

function normalizeBodyText(value) {
  const sanitized = String(value ?? '').replace(MULTILINE_CONTROL_PATTERN, ' ');
  return normalizeMultilineText(sanitized).trimEnd();
}

function escapeHtml(value) {
  return String(value ?? '').replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPE_MAP[character]);
}

function withSafeHtmlFields(record) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const nextRecord = { ...record };
  const fieldsToEscape = ['title', 'content', 'nickName'];

  for (const field of fieldsToEscape) {
    if (Object.prototype.hasOwnProperty.call(nextRecord, field)) {
      nextRecord[`${field}Html`] = escapeHtml(nextRecord[field]);
    }
  }

  return nextRecord;
}

function sanitizeNewPostInput(input, context = null) {
  const title = normalizeInlineText(input?.title ?? '', MAX_TITLE_LENGTH);
  const content = normalizeBodyText(input?.content ?? '');
  
  if (!title) {
    throw createHttpError(400, '제목을 입력해주세요.');
  }

  if (!content.trim()) {
    throw createHttpError(400, '내용을 입력해주세요.');
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw createHttpError(400, `내용이 너무 깁니다. (최대 ${MAX_CONTENT_LENGTH.toLocaleString()}자)`);
  }

  const contextUserId = normalizeInlineText(context?.userId ?? '', MAX_USER_ID_LENGTH);
  const contextNickName = normalizeInlineText(context?.nickName ?? '', MAX_NICKNAME_LENGTH);
  const inputUserId = normalizeInlineText(input?.userId ?? '', MAX_USER_ID_LENGTH);
  const inputNickName = normalizeInlineText(input?.nickName ?? '', MAX_NICKNAME_LENGTH);
  
  const hasTrustedIdentity = Boolean(contextUserId || contextNickName);
  const userId = hasTrustedIdentity ? (contextUserId || 'guest') : (inputUserId || 'guest');
  const nickName = hasTrustedIdentity ? (contextNickName || contextUserId || 'guest') : (inputNickName || '\uC190\uB2D8');
  const category = normalizeInlineText(input?.category ?? input?.header ?? '', MAX_CATEGORY_LENGTH);

  return withSafeHtmlFields({ title, content, userId, nickName, category });
}

function sanitizePostPatch(input, currentPost) {
  const nextTitle = input?.title === undefined
    ? normalizeInlineText(currentPost.title, MAX_TITLE_LENGTH)
    : normalizeInlineText(input.title ?? '', MAX_TITLE_LENGTH);
  const nextContent = input?.content === undefined
    ? normalizeBodyText(currentPost.content)
    : normalizeBodyText(input.content ?? '');
  const nextCategory = input?.category === undefined && input?.header === undefined
    ? normalizeInlineText(currentPost.category || currentPost.header || '', MAX_CATEGORY_LENGTH)
    : normalizeInlineText(input.category ?? input.header ?? '', MAX_CATEGORY_LENGTH);

  if (!nextTitle) {
    throw createHttpError(400, '제목을 입력해주세요.');
  }

  if (!nextContent.trim()) {
    throw createHttpError(400, '내용을 입력해주세요.');
  }

  if (nextContent.length > MAX_CONTENT_LENGTH) {
    throw createHttpError(400, `내용이 너무 깁니다. (최대 ${MAX_CONTENT_LENGTH.toLocaleString()}자)`);
  }

  return withSafeHtmlFields({ title: nextTitle, content: nextContent, category: nextCategory });
}

function mapBoardRow(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    boardId: row.board_id ?? row.boardId,
    name: row.name ?? '',
    menuPath: row.menu_path ?? row.menuPath ?? 'top',
    door: String(row.door ?? ''),
    accessLevel: Number(row.access_level ?? row.accessLevel ?? 1),
    writeSysopOnly: Boolean(row.write_sysop_only ?? row.writeSysopOnly ?? false),
    replyEnabled: row.reply_enabled === undefined ? (row.replyEnabled ?? true) : Boolean(row.reply_enabled),
    attachmentEnabled: Boolean(row.attachment_enabled ?? row.attachmentEnabled ?? false),
    headerFile: row.header_file ?? row.headerFile ?? '',
    footerFile: row.footer_file ?? row.footerFile ?? ''
  };
}

function mapPostRow(row) {
  if (!row) return null;

  return withSafeHtmlFields({
    id: Number(row.id),
    boardId: row.board_id ?? row.boardId,
    family: Number(row.family_id ?? row.family ?? row.familyId ?? row.id ?? 0),
    orderby: Number(row.sort_order ?? row.orderby ?? row.orderBy ?? row.id ?? 0),
    step: Number(row.depth ?? row.step ?? 0),
    userId: normalizeInlineText(row.user_id ?? row.userId ?? row.author_id ?? 'guest', MAX_USER_ID_LENGTH) || 'guest',
    nickName: normalizeInlineText(row.nick_name ?? row.nickName ?? row.author_nickname ?? '', MAX_NICKNAME_LENGTH),
    title: normalizeInlineText(row.title ?? '', MAX_TITLE_LENGTH),
    content: normalizeBodyText(row.content ?? ''),
    category: normalizeInlineText(row.category ?? row.header ?? '', MAX_CATEGORY_LENGTH),
    hit: Number(row.hit ?? row.hits ?? 0),
    recommend: Number(row.recommend ?? row.likes ?? 0),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt ?? new Date().toISOString()
  });
}

function cloneBoard(board) {
  return board ? { ...board } : null;
}

function clonePost(post) {
  return post ? withSafeHtmlFields({ ...post }) : null;
}

function buildPagination(totalCount, requestedPage, pageSize) {
  return buildPaginationMetadata(totalCount, requestedPage, pageSize);
}

module.exports = {
  createHttpError,
  escapeHtml,
  isUuid,
  sanitizeNewPostInput,
  sanitizePostPatch,
  mapBoardRow,
  mapPostRow,
  cloneBoard,
  clonePost,
  buildPagination,
  withSafeHtmlFields
};

