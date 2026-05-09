'use strict';

const BaseRouter = require('./BaseRouter');

/**
 * [LOG: 20260426_1900] Modularized MemoRoutes from MemberRouter (Evolution Mode: Structural Optimization)
 */
class MemoRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/memos', handler: 'listMemos', middlewares: ['ensureAuthenticated'] },
      { method: 'GET', pattern: '/api/memos/unread/count', handler: 'unreadMemoCount', middlewares: ['ensureAuthenticated'] },
      { 
        method: 'POST', 
        pattern: '/api/memos', 
        handler: 'createMemo', 
        middlewares: ['ensureAuthenticated'],
        needBody: true
      },
      { method: 'GET', pattern: '/api/memos/:memoId', handler: 'getMemo', middlewares: ['ensureAuthenticated'] },
      { method: 'POST', pattern: '/api/memos/:memoId/read', handler: 'markMemoRead', middlewares: ['ensureAuthenticated'] },
      { method: 'PATCH', pattern: '/api/memos/:memoId/read', handler: 'markMemoRead', middlewares: ['ensureAuthenticated'] },
      { method: 'DELETE', pattern: '/api/memos/:memoId', handler: 'deleteMemo', middlewares: ['ensureAuthenticated'] }
    ];
  }

  async listMemos() {
    const { memoRepository } = this.deps;
    const context = await this.getContext();
    return this.send(200, await memoRepository.listForUser(context));
  }

  async unreadMemoCount() {
    const { memoRepository } = this.deps;
    const context = await this.getContext();
    return this.send(200, await memoRepository.countUnread(context));
  }

  // [LOG: 20260428_2339] Browser memo compose sends recipientUserId/title, while
  // older clients may still send to/subject. Normalize both after auth middleware.
  async getCreateMemoBody() {
    const body = await this.getBody();
    const payload = body && typeof body === 'object' ? body : {};
    const recipientUserId = typeof payload.recipientUserId === 'string'
      ? payload.recipientUserId
      : (typeof payload.to === 'string'
        ? payload.to
        : (typeof payload.recipient === 'string' ? payload.recipient : ''));
    const title = typeof payload.title === 'string'
      ? payload.title
      : (typeof payload.subject === 'string' ? payload.subject : '');
    const content = typeof payload.content === 'string' ? payload.content : '';

    if (!recipientUserId.trim()) {
      this.validationError('body parameter "recipientUserId" is required.');
    }

    if (!title.trim()) {
      this.validationError('body parameter "title" is required.');
    }

    if (title.length > 200) {
      this.validationError('body parameter "title" must be no more than 200 characters.');
    }

    if (!content.trim()) {
      this.validationError('body parameter "content" is required.');
    }

    return {
      ...payload,
      recipientUserId,
      title,
      content
    };
  }

  async createMemo() {
    const { memoRepository } = this.deps;
    const body = await this.getCreateMemoBody();
    const context = await this.getContext();
    return this.send(201, await memoRepository.createMemo(body, context));
  }

  async getMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.getMemo(memoId, context));
  }

  async markMemoRead(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.markRead(memoId, context));
  }

  async deleteMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.deleteMemo(memoId, context));
  }
}

async function handleMemoRoutes(deps) {
  const router = new MemoRouter(deps);
  return await router.handle();
}

module.exports = handleMemoRoutes;
