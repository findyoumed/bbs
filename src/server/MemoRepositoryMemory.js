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

  async listForUser(context = {}) {
    const userId = normalizeText(context.userId, 'guest');
    const isSentBox = context.box === 'sent';
    return this.memos
      .filter((memo) => isSentBox ? memo.senderUserId === userId : memo.recipientUserId === userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((memo) => ({ ...memo }));
  }

  async countUnread(context = {}) {
    const userId = normalizeText(context.userId, 'guest');
    return {
      count: this.memos.filter((memo) => memo.recipientUserId === userId && memo.isRead !== true).length
    };
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
    const memo = {
      id: this.nextId++,
      senderUserId: saveToSent ? normalizeText(context.userId, 'guest') : null,
      recipientUserId: payload.recipientUserId,
      title: payload.title,
      content: payload.content,
      isRead: false,
      createdAt: new Date().toISOString(),
      readAt: null
    };
    this.memos.push(memo);
    return { ...memo };
  }

  async markRead(id, context = {}) {
    const memo = this._findMemo(id);
    if (!canAccessMemo(memo, context)) {
      throw createHttpError(403, '메모를 수정할 권한이 없습니다.');
    }
    if (memo.recipientUserId === context.userId && !memo.isRead) {
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
