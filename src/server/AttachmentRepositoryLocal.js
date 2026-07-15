'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildStoredName,
  createHttpError,
  decodeAttachmentPayload,
  normalizeEntry,
  wrapStorageError
} = require('./AttachmentRepositoryShared');
const logger = require('./logger');

function createEmptyIndex() {
  return { nextId: 1, attachments: [] };
}

function removeFileBestEffort(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  try {
    fs.rmSync(filePath, {
      force: true,
      maxRetries: 5,
      retryDelay: 50
    });
    return;
  } catch (error) {
    if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error?.code)) {
      throw error;
    }
  }

  try {
    fs.renameSync(filePath, `${filePath}.deleted`);
  } catch (error) {
    return;
  }

  try {
    fs.rmSync(`${filePath}.deleted`, {
      force: true,
      maxRetries: 5,
      retryDelay: 50
    });
  } catch (error) {
    return;
  }
}

class AttachmentRepository {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.baseDir = options.baseDir || path.join(projectRoot, 'data', 'attachments');
    this.filesDir = path.join(this.baseDir, 'files');
    this.indexPath = path.join(this.baseDir, 'index.json');
    this.maxBytes = Number(options.maxBytes || 1024 * 1024);
    this.storageError = null;

    if (process.env.VERCEL) {
      this.storageError = createHttpError(503, '서버리스 환경에서는 로컬 첨부 저장소를 사용할 수 없습니다. 외부 스토리지를 연결해 주세요.');
      this.index = createEmptyIndex();
      return;
    }

    try {
      fs.mkdirSync(this.filesDir, { recursive: true });
    } catch (error) {
      this.storageError = wrapStorageError('첨부 저장소 초기화', error, this.filesDir);
      this.index = createEmptyIndex();
      return;
    }

    this.index = this._loadIndex();
  }

  getMeta() {
    return {
      driver: 'local',
      ready: !this.storageError,
      baseDir: this.baseDir,
      error: this.storageError ? this.storageError.message : null
    };
  }

  list(boardId, postId) {
    this._assertStorageAvailable();
    return this.index.attachments
      .filter((entry) => entry.boardId === boardId && entry.postId === Number(postId))
      .map(normalizeEntry)
      .sort((left, right) => left.id - right.id);
  }

  // [LOG_ID: 20260718_1200] Supabase 드라이버와 동일 의미 — 자료실 목록용 글당 대표(첫) 첨부 요약.
  summariesForPosts(boardId, postIds) {
    this._assertStorageAvailable();
    const ids = new Set((postIds || []).map((id) => Number(id)));
    const sorted = this.index.attachments
      .filter((entry) => entry.boardId === boardId && ids.has(Number(entry.postId)))
      .map(normalizeEntry)
      .sort((left, right) => left.id - right.id);

    const byPost = {};
    for (const entry of sorted) {
      const key = Number(entry.postId);
      if (byPost[key]) continue;
      byPost[key] = {
        name: String(entry.originalName || entry.filename || ''),
        size: Number(entry.size || entry.fileSize || 0),
        downloadCount: Number(entry.downloadCount || 0)
      };
    }
    return byPost;
  }

  add(boardId, postId, payload, context = {}) {
    this._assertStorageAvailable();
    const { originalName, mimeType, buffer } = decodeAttachmentPayload(payload, this.maxBytes);
    const id = this.index.nextId++;
    const storedName = `${id}-${buildStoredName(originalName)}`;
    const entry = normalizeEntry({
      id,
      boardId,
      postId: Number(postId),
      userId: context.userId || 'guest',
      nickName: context.nickName || '손님',
      originalName,
      storedName,
      mimeType,
      size: buffer.length,
      downloadCount: 0,
      createdAt: new Date().toISOString()
    });

    try {
      fs.writeFileSync(path.join(this.filesDir, storedName), buffer);
    } catch (error) {
      throw wrapStorageError('첨부 파일 저장', error, this.filesDir);
    }

    this.index.attachments.push(entry);
    this._saveIndex();
    return normalizeEntry(entry);
  }

  get(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    const entry = this.index.attachments.find((item) => item.boardId === boardId && item.postId === Number(postId) && item.id === Number(attachmentId));
    if (!entry) {
      throw createHttpError(404, '첨부 파일을 찾을 수 없습니다.');
    }
    return normalizeEntry(entry);
  }

  read(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    const entry = this.get(boardId, postId, attachmentId);
    const filePath = path.join(this.filesDir, entry.storedName);
    if (!fs.existsSync(filePath)) {
      throw createHttpError(404, '첨부 파일이 저장소에 없습니다.');
    }

    let buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (error) {
      throw wrapStorageError('첨부 파일 읽기', error, filePath);
    }

    const indexEntry = this.index.attachments.find((item) => item.id === entry.id);
    if (indexEntry) {
      indexEntry.downloadCount = Number(indexEntry.downloadCount || 0) + 1;
      this._saveIndex();
      entry.downloadCount = indexEntry.downloadCount;
    }

    return { entry, buffer };
  }

  delete(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    const index = this.index.attachments.findIndex((item) => item.boardId === boardId && item.postId === Number(postId) && item.id === Number(attachmentId));
    if (index === -1) {
      throw createHttpError(404, '첨부 파일을 찾을 수 없습니다.');
    }

    const [entry] = this.index.attachments.splice(index, 1);
    this._saveIndex();
    removeFileBestEffort(path.join(this.filesDir, entry.storedName));
    return normalizeEntry(entry);
  }

  _loadIndex() {
    this._assertStorageAvailable();
    if (!fs.existsSync(this.indexPath)) {
      return createEmptyIndex();
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
      return {
        nextId: Math.max(1, Number(parsed?.nextId || 1)),
        attachments: Array.isArray(parsed?.attachments) ? parsed.attachments.map(normalizeEntry) : []
      };
    } catch (error) {
      logger.error('index load failed', { component: 'AttachmentRepository', error: error.message });
      return createEmptyIndex();
    }
  }

  _saveIndex() {
    this._assertStorageAvailable();
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
    } catch (error) {
      throw wrapStorageError('첨부 인덱스 저장', error, this.indexPath);
    }
  }

  _assertStorageAvailable() {
    if (this.storageError) {
      throw this.storageError;
    }
  }
}

module.exports = {
  AttachmentRepository
};
