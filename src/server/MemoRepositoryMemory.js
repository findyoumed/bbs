'use strict';

const {
  canAccessMemo,
  createHttpError,
  normalizeText,
  validateMemoInput
} = require('./MemoRepositoryShared');

class MemoryMemoRepository {
  constructor() {
    this.nextId = 1;
    this.memos = [];
  }

  getMeta() {
    return {
      driver: 'memory',
      ready: true
    };
  }

  // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — Supabase 구현과 동일 의미로 맞춘다
  // (dual-mode라 두 드라이버의 동작이 갈리면 안 된다).
  async listForUser(context = {}) {
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();

    if (context.box === 'archive') {
      return this.memos
        .filter((memo) => (memo.recipientUserId === userId && memo.recipientArchived)
          || (memo.senderUserId === userId && memo.senderArchived))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
        .map((memo) => ({ ...memo }));
    }

    const isSentBox = context.box === 'sent';
    return this.memos
      .filter((memo) => (isSentBox
        ? memo.senderUserId === userId && !memo.senderArchived
        : memo.recipientUserId === userId && !memo.recipientArchived))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((memo) => ({ ...memo }));
  }

  async countUnread(context = {}) {
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    return {
      count: this.memos.filter((memo) => memo.recipientUserId === userId
        && memo.isRead !== true
        && !memo.recipientArchived).length
    };
  }

  async setArchived(id, archived, context = {}) {
    const memo = this._findMemo(id);
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    if (memo.recipientUserId !== userId && memo.senderUserId !== userId) {
      throw createHttpError(403, '쪽지를 보관할 권한이 없습니다.');
    }
    if (memo.recipientUserId === userId) {
      memo.recipientArchived = Boolean(archived);
    } else {
      memo.senderArchived = Boolean(archived);
    }
    return { ...memo };
  }

  async getMemo(id, context = {}) {
    const memo = this._findMemo(id);
    if (!canAccessMemo(memo, context)) {
      throw createHttpError(403, '메모를 볼 권한이 없습니다.');
    }
    return { ...memo };
  }

  async createMemo(input = {}, context = {}) {
    const payload = validateMemoInput(input);
    const saveToSent = input.saveToSent !== false;
    // [LOG_ID: 20260801_1106] Supabase 구현과 일관성을 맞추어 senderUserId를 항상 채워주고
    // 대신 senderArchived를 !saveToSent 로 설정한다.
    const memo = {
      id: this.nextId++,
      senderUserId: normalizeText(context.userId, 'guest').toLowerCase(),
      recipientUserId: payload.recipientUserId,
      title: payload.title,
      content: payload.content,
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: null,
      senderArchived: !saveToSent,
      recipientArchived: false
    };
    this.memos.push(memo);
    return { ...memo };
  }

  async markRead(id, context = {}) {
    const memo = this._findMemo(id);
    if (!canAccessMemo(memo, context)) {
      throw createHttpError(403, '메모를 수정할 권한이 없습니다.');
    }
    // [LOG: 20260731_1700] 대소문자 매칭 일치를 위해 소문자 정규화 처리
    const userId = String(context.userId || '').trim().toLowerCase();
    if (memo.recipientUserId === userId && !memo.isRead) {
      memo.isRead = true;
      memo.readAt = new Date().toISOString();
    }
    return { ...memo };
  }

  async deleteMemo(id, context = {}) {
    const memo = this._findMemo(id);
    if (!canAccessMemo(memo, context)) {
      throw createHttpError(403, '메모를 삭제할 권한이 없습니다.');
    }
    this.memos = this.memos.filter((entry) => entry.id !== memo.id);
    return { ...memo };
  }

  _findMemo(id) {
    const memo = this.memos.find((entry) => entry.id === Number(id));
    if (!memo) {
      throw createHttpError(404, '메모를 찾을 수 없습니다.');
    }
    return memo;
  }
}

module.exports = {
  MemoryMemoRepository
};
