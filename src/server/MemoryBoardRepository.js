'use strict';
const { createHttpError, sanitizePostPatch, cloneBoard, clonePost } = require('./BoardRepositoryShared');
const { LEVEL_NAME_MAP, assertBoardAccessible, assertPostMutable } = require('./BoardRepositoryAccess');
const { sortPostsThreaded } = require('./BoardRepositorySearch');
const { resolveBoardDefinitions } = require('./BoardDefinitionResolver');
const { getMergedBoardSourceIds, resolveSourceBoardId } = require('./BoardVirtualBoards');
const { seedMemoryBoardRepository } = require('./MemoryBoardRepositorySeed');
const { MemoryBoardRepositoryCore } = require('./MemoryBoardRepositoryCore');

class MemoryBoardRepository {
  constructor(options = {}) {
    this.driver = 'memory'; this.levelAliases = { ...LEVEL_NAME_MAP, ...(options.levelAliases || {}) };
    this.boards = resolveBoardDefinitions(options.menuFilePath).map((b, i) => ({ id: i + 1, ...b }));
    this.posts = []; this.recommendations = new Set(); this.nextPostId = 1;
    this.core = new MemoryBoardRepositoryCore(this); seedMemoryBoardRepository(this);
  }

  getMeta() { return { ready: true, driver: this.driver }; }
  async listBoards() { return this.boards.map(cloneBoard); }
  async getBoard(id) { return cloneBoard(this.boards.find(b => b.boardId === id)); }
  async countPosts() { return this.posts.length; }
  async countPostsSince(s) {
    const ts = Date.parse(s instanceof Date ? s.toISOString() : s || '');
    return isNaN(ts) ? 0 : this.posts.filter(p => Date.parse(p.createdAt || '') >= ts).length;
  }

  async listHotPosts(options = {}) {
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const days = Math.max(1, Number(options.days) || 7);
    const ts = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    return this.posts
      .filter(p => Date.parse(p.createdAt || '') >= ts)
      .sort((a, b) => (b.recommend - a.recommend) || (b.hit - a.hit))
      .slice(0, limit)
      .map(clonePost);
  }

  async listPosts(id, opt) { return this.core.listPosts(id, opt); }
  async createPost(id, inp, ctx) { return this.core.createPost(id, inp, ctx); }
  async replyToPost(id, pid, inp, ctx) { return this.core.replyToPost(id, pid, inp, ctx); }
  async recommendPost(id, pid, ctx) { return this.core.recommendPost(id, pid, ctx); }

  getBoardSourceIds(boardId) {
    return getMergedBoardSourceIds(boardId);
  }

  filterPostsByBoard(boardId) {
    const boardIds = new Set(this.getBoardSourceIds(boardId));
    return this.posts.filter((post) => boardIds.has(String(post.boardId || '').trim()));
  }

  findPostRecord(boardId, postId) {
    const boardIds = new Set(this.getBoardSourceIds(boardId));
    return this.posts.find((post) => boardIds.has(String(post.boardId || '').trim()) && post.id === Number(postId));
  }

  resolveMutationBoardId(boardId, postBoardId = '') {
    return resolveSourceBoardId(boardId, postBoardId);
  }

  async getPost(boardId, postId, options = {}) {
    const board = await this.getBoard(boardId);
    assertBoardAccessible(board, options.context || { userId: options.viewerId, level: options.viewerLevel }, this.levelAliases);
    const post = this.findPostRecord(boardId, postId);
    if (!post) throw createHttpError(404, '글 없음');
    if (options.incrementHit && post.userId !== (options.viewerId || 'guest')) { post.hit++; post.updatedAt = new Date().toISOString(); }
    return { board, post: clonePost(post), navigation: this._getNavigation(boardId, post.id) };
  }

  async updatePost(boardId, postId, input, context = {}) {
    const board = await this.getBoard(boardId); assertBoardAccessible(board, context, this.levelAliases);
    const post = this.findPostRecord(boardId, postId); assertPostMutable(post, context);
    const patch = sanitizePostPatch(input, post); post.title = patch.title; post.content = patch.content; post.updatedAt = new Date().toISOString();
    return { board, post: clonePost(post) };
  }

  async deletePost(boardId, postId, context = {}) {
    const board = await this.getBoard(boardId); assertBoardAccessible(board, context, this.levelAliases);
    const idx = this.posts.findIndex((post) => { const sourceBoardId = this.resolveMutationBoardId(boardId, post.boardId); return sourceBoardId === String(post.boardId || '').trim() && post.id === Number(postId); });
    if (idx === -1) throw createHttpError(404, '글 없음');
    assertPostMutable(this.posts[idx], context);
    const [deleted] = this.posts.splice(idx, 1); return { board, post: clonePost(deleted) };
  }

  _getNavigation(bid, pid) {
    const ids = sortPostsThreaded(this.filterPostsByBoard(bid)).map(p => p.id), idx = ids.indexOf(Number(pid));
    return { latestId: ids[0] ?? null, prevId: idx > 0 ? ids[idx - 1] : null, nextId: (idx >= 0 && idx < ids.length - 1) ? ids[idx + 1] : null };
  }
}

module.exports = { MemoryBoardRepository };
