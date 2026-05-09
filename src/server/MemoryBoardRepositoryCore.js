'use strict';
const { createHttpError, sanitizeNewPostInput, sanitizePostPatch, clonePost, buildPagination } = require('./BoardRepositoryShared');
const { assertBoardWritable, assertBoardAccessible, assertAuthenticatedBoardUser, assertPostMutable } = require('./BoardRepositoryAccess');
const { sortPostsThreaded, normalizeSearchOptions, filterPostsBySearch } = require('./BoardRepositorySearch');

class MemoryBoardRepositoryCore {
  constructor(repo) { this.repo = repo; }

  async listPosts(boardId, options = {}) {
    const board = await this.repo.getBoard(boardId);
    assertBoardAccessible(board, options.context, this.repo.levelAliases);
    const search = normalizeSearchOptions(options);
    const filtered = filterPostsBySearch(this.repo.filterPostsByBoard(boardId), search);
    const sorted = sortPostsThreaded(filtered);
    const pagination = buildPagination(sorted.length, Number(options.page) || 1, Math.max(1, Number(options.pageSize) || 15));
    const items = sorted.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize).map(clonePost);
    return { board, items, pagination, search };
  }

  async createPost(boardId, input, context = {}) {
    const board = await this.repo.getBoard(boardId);
    assertBoardWritable(board, context, this.repo.levelAliases);
    // [LOG: 20260429_0248] Memory driver must match board create auth behavior.
    assertAuthenticatedBoardUser(context);
    const data = sanitizeNewPostInput(input, context), now = new Date().toISOString();
    const sourceBoardId = this.repo.resolveMutationBoardId(boardId);
    const post = { id: this.repo.nextPostId++, boardId: sourceBoardId, family: 0, orderby: 0, step: 0, userId: data.userId, nickName: data.nickName, title: data.title, content: data.content, category: data.category, hit: 0, recommend: 0, createdAt: now, updatedAt: now };
    post.family = post.id; this.repo.posts.push(post);
    return { board, post: clonePost(post) };
  }

  async replyToPost(boardId, parentId, input, context = {}) {
    const board = await this.repo.getBoard(boardId);
    assertBoardWritable(board, context, this.repo.levelAliases);
    if (!board.replyEnabled) throw createHttpError(400, '답글 비활성화');
    // [LOG: 20260429_0239] Memory driver must match board reply auth behavior.
    assertAuthenticatedBoardUser(context);
    const parent = this.repo.findPostRecord(boardId, parentId);
    if (!parent) throw createHttpError(404, '원문 없음');
    const data = sanitizeNewPostInput(input, context);
    const sourceBoardId = this.repo.resolveMutationBoardId(boardId, parent?.boardId);
    this.repo.posts.forEach(p => { if (p.boardId === sourceBoardId && p.family === parent.family && p.orderby > parent.orderby) p.orderby++; });
    const now = new Date().toISOString();
    const reply = { id: this.repo.nextPostId++, boardId: sourceBoardId, family: parent.family, orderby: parent.orderby + 1, step: parent.step + 1, userId: data.userId, nickName: data.nickName, title: data.title, content: data.content, category: data.category, hit: 0, recommend: 0, createdAt: now, updatedAt: now };
    this.repo.posts.push(reply);
    return { board, post: clonePost(reply) };
  }

  async recommendPost(boardId, postId, context = {}) {
    const board = await this.repo.getBoard(boardId);
    assertBoardAccessible(board, context, this.repo.levelAliases);
    const post = this.repo.findPostRecord(boardId, postId);
    if (!post) throw createHttpError(404, '글 없음');
    // [LOG: 20260429_0229] Memory driver must match Supabase recommend auth behavior.
    const userId = assertAuthenticatedBoardUser(context);
    if (post.userId === userId) throw createHttpError(400, '본인 글 추천 불가');
    const key = `${post.id}:${userId}`;
    if (this.repo.recommendations.has(key)) throw createHttpError(409, '이미 추천함');
    this.repo.recommendations.add(key); post.recommend++; post.updatedAt = new Date().toISOString();
    return { board, post: clonePost(post) };
  }
}

module.exports = { MemoryBoardRepositoryCore };
