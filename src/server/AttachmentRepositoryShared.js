'use strict';

const path = require('path');
const crypto = require('crypto');
const { createHttpError, isMissingTableError } = require('./httpUtils');

function isStorageUnavailableError(error) {
  return ['EROFS', 'EACCES', 'EPERM'].includes(String(error?.code || '').toUpperCase());
}

function wrapStorageError(action, error, storagePath) {
  if (isStorageUnavailableError(error)) {
    return createHttpError(503, `첨부 저장소를 사용할 수 없습니다. 외부 스토리지를 연결해 주세요: ${storagePath} (${error.message})`);
  }
  return createHttpError(500, `${action} 실패: ${error.message}`);
}

function isMissingAttachmentsTableError(error, tableName = 'attachments') {
  return isMissingTableError(error, tableName);
}

function safeFileName(name) {
  return String(name || 'attachment.bin')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment.bin';
}

function buildStoredName(originalName) {
  const ext = path.extname(safeFileName(originalName)).slice(0, 16);
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
}

function normalizeEntry(entry) {
  const originalName = String(entry.originalName ?? entry.original_filename ?? 'attachment.bin');
  const storedName = String(entry.storedName ?? entry.stored_name ?? entry.filename ?? '');
  const size = Number(entry.size ?? entry.file_size ?? 0);

  return {
    id: Number(entry.id),
    boardId: String(entry.boardId ?? entry.board_id ?? ''),
    postId: Number(entry.postId ?? entry.post_id ?? 0),
    userId: String(entry.userId ?? entry.user_id ?? 'guest'),
    nickName: String(entry.nickName ?? entry.nick_name ?? '손님'),
    originalName,
    originalFilename: originalName,
    storedName,
    filename: storedName || originalName,
    mimeType: String(entry.mimeType ?? entry.mime_type ?? 'application/octet-stream'),
    size,
    fileSize: size,
    downloadCount: Number(entry.downloadCount ?? entry.download_count ?? 0),
    createdAt: String(entry.createdAt ?? entry.created_at ?? new Date().toISOString())
  };
}

function decodeAttachmentPayload(payload, maxBytes) {
  // [LOG: 20260429_0112] Keep attachment payload compatibility with both
  // legacy `name` and current `originalName` style callers.
  const originalName = safeFileName(
    payload?.originalName
    || payload?.originalFilename
    || payload?.original_filename
    || payload?.fileName
    || payload?.filename
    || payload?.name
  );
  const contentBase64 = String(payload?.contentBase64 || '').trim();
  if (!contentBase64) {
    throw createHttpError(400, '첨부 파일 내용이 비어 있습니다.');
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch (error) {
    throw createHttpError(400, '첨부 파일 인코딩이 올바르지 않습니다.');
  }

  if (!buffer.length) {
    throw createHttpError(400, '첨부 파일 내용이 비어 있습니다.');
  }

  if (buffer.length > maxBytes) {
    throw createHttpError(413, `첨부 파일은 ${Math.floor(maxBytes / 1024)}KB 이하만 업로드할 수 있습니다.`);
  }

  return {
    originalName,
    mimeType: payload?.mimeType || 'application/octet-stream',
    buffer
  };
}

module.exports = {
  buildStoredName,
  createHttpError,
  decodeAttachmentPayload,
  isMissingAttachmentsTableError,
  normalizeEntry,
  wrapStorageError
};
