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
const { getMergedBoardSourceIds } = require('./BoardVirtualBoards');
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
    // [LOG_ID: 20260730_0430] boardId는 호출부(boardRoutes.attachmentBoardId)가 이미 물리 id로
    // 해석해 넘겨준다 — 여기서 병합 소스로 넓힐 필요가 없다.
    const wantedPostId = Number(postId);
    return this.index.attachments
      .filter((entry) => entry.boardId === boardId && entry.postId === wantedPostId)
      .map(normalizeEntry)
      .sort((left, right) => left.id - right.id);
  }

  // [LOG_ID: 20260718_1200] Supabase 드라이버와 동일 의미 — 자료실 목록용 글당 대표(첫) 첨부 요약.
  // [LOG_ID: 20260728_2350] 가상 'pds' boardId로는 물리 하위 게시판(pds_prog 등)에 저장된 첨부와
  // 일치하지 않아 목록 화면의 파일 요약이 항상 비어 있었다 — 병합 소스 전체를 대상으로 넓힌다.
  // [LOG_ID: 20260730_0430] 첨부 조회 경로 중 여기만 넓힌다 — 한 페이지에 여러 물리 게시판의 글이
  // 섞여 들어오는 배치 조회라 단일 물리 id로 좁힐 수 없다(나머지는 호출부가 물리 id를 넘겨준다).
  summariesForPosts(boardId, postIds) {
    this._assertStorageAvailable();
    const boardIds = getMergedBoardSourceIds(boardId);
    // postIds는 페이지당 글 수만큼 들어오므로(가변·다수) Set이 값어치를 한다 — boardIds(≤7)와 달리.
    const ids = new Set((postIds || []).map((id) => Number(id)));
    const sorted = this.index.attachments
      .filter((entry) => boardIds.includes(entry.boardId) && ids.has(Number(entry.postId)))
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

  // [LOG_ID: 20260731_1420] 업로드 원자성 롤백 보장 — 파일 쓰기/인덱스 저장 실패 시 잔여 디스크 파일과 nextId/인덱스 오염을 원복한다.
  add(boardId, postId, payload, context = {}) {
    this._assertStorageAvailable();
    const { originalName, mimeType, buffer } = decodeAttachmentPayload(payload, this.maxBytes);
    const id = this.index.nextId;
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

    const targetFilePath = path.join(this.filesDir, storedName);
    try {
      fs.writeFileSync(targetFilePath, buffer);
    } catch (error) {
      removeFileBestEffort(targetFilePath);
      throw wrapStorageError('첨부 파일 저장', error, this.filesDir);
    }

    this.index.nextId++;
    this.index.attachments.push(entry);
    try {
      this._saveIndex();
    } catch (error) {
      this.index.attachments.pop();
      this.index.nextId--;
      removeFileBestEffort(targetFilePath);
      throw error;
    }
    return normalizeEntry(entry);
  }

  // [LOG_ID: 20260729_0330] get/read/delete가 공유하는 단건 조회 지점 — Supabase 드라이버의
  // _getRow에 대응한다. 종전엔 get과 delete가 3중 조건 predicate와 404 문구를 각자 복제해
  // 갖고 있었고(find와 findIndex만 다른 사실상 같은 코드), 그래서 병합 소스 넓히기(20260729_0215)
  // 같은 수정이 필요할 때마다 같은 파일 안에서 여러 번 손대야 했다. 색인 배열의 **실제** 항목을
  // 돌려주므로 read()가 downloadCount를 바로 증가시킬 수 있다 — 호출부에 넘길 때만 normalizeEntry.
  // [LOG_ID: 20260730_0430] boardId는 이미 물리 id로 해석돼 들어온다 — 정확 비교만 한다.
  _findEntry(boardId, postId, attachmentId) {
    const wantedPostId = Number(postId);
    const wantedId = Number(attachmentId);
    const entry = this.index.attachments.find((item) => item.boardId === boardId
      && item.postId === wantedPostId
      && item.id === wantedId);
    if (!entry) {
      throw createHttpError(404, '첨부 파일을 찾을 수 없습니다.');
    }
    return entry;
  }

  get(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    return normalizeEntry(this._findEntry(boardId, postId, attachmentId));
  }

  read(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    // [LOG_ID: 20260729_0330] 종전엔 get()이 돌려준 정규화 사본으로는 downloadCount를 색인에
    // 반영할 수 없어, 같은 배열을 id로 한 번 더 훑어 실제 항목을 다시 찾았다(다운로드 1건당 2회 순회).
    const entry = this._findEntry(boardId, postId, attachmentId);
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

    entry.downloadCount = Number(entry.downloadCount || 0) + 1;
    this._saveIndex();

    return { entry: normalizeEntry(entry), buffer };
  }

  delete(boardId, postId, attachmentId) {
    this._assertStorageAvailable();
    const entry = this._findEntry(boardId, postId, attachmentId);
    this.index.attachments.splice(this.index.attachments.indexOf(entry), 1);
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
