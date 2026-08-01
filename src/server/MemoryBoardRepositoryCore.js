'use strict';
const { createHttpError, sanitizeNewPostInput, clonePost, buildPagination } = require('./BoardRepositoryShared');
const { assertBoardWritable, assertBoardAccessible, assertAuthenticatedBoardUser } = require('./BoardRepositoryAccess');
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
    const nextId = this.repo.nextPostId++;
    // [LOG_ID: 20260731_1415] Supabase mapPostRow와의 동등성 보장 — localId를 명시적으로 부여한다.
    const post = { id: nextId, localId: nextId, boardId: sourceBoardId, family: 0, orderby: 0, step: 0, userId: data.userId, nickName: data.nickName, title: data.title, content: data.content, category: data.category, hit: 0, recommend: 0, createdAt: now, updatedAt: now };
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
    // [LOG: 20260802_1400] deletePost가 원글(step=0)을 tombstone([삭제된 글입니다])으로 남길 때
    // replyToPost는 이 자리표시자 행이 DB에 존재하므로 !parent 검사를 통과해 답글을 허용했다.
    // 논리적으로 삭제된 원글에는 답글을 달 수 없어야 한다(Supabase 드라이버와 동일 규칙).
    if (parent.title === '[삭제된 글입니다]') throw createHttpError(404, '삭제된 게시글에는 답글을 달 수 없습니다.');
    const data = sanitizeNewPostInput(input, context);
    const sourceBoardId = this.repo.resolveMutationBoardId(boardId, parent?.boardId);
    this.repo.posts.forEach(p => { if (p.boardId === sourceBoardId && p.family === parent.family && p.orderby > parent.orderby) p.orderby++; });
    const now = new Date().toISOString();
    const nextId = this.repo.nextPostId++;
    // [LOG_ID: 20260731_1415] Supabase mapPostRow와의 동등성 보장 — localId를 명시적으로 부여한다.
    const reply = { id: nextId, localId: nextId, boardId: sourceBoardId, family: parent.family, orderby: parent.orderby + 1, step: parent.step + 1, userId: data.userId, nickName: data.nickName, title: data.title, content: data.content, category: data.category, hit: 0, recommend: 0, createdAt: now, updatedAt: now };
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
