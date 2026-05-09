'use strict';

const {
  createHttpError,
  sanitizeNewPostInput,
  sanitizePostPatch
} = require('./BoardRepositoryShared');
const {
  assertBoardWritable,
  assertBoardAccessible,
  assertAuthenticatedBoardUser,
  assertPostMutable
} = require('./BoardRepositoryAccess');
const readOps = require('./SupabaseBoardRepositoryReadOps');
const { ensureCapabilities } = require('./SupabaseBoardRepositorySchema');
const mutation = require('./SupabaseBoardRepositoryMutation');
const { resolveSourceBoardId } = require('./BoardVirtualBoards');

async function createPost(repo, boardId, input, context = {}) {
  const board = await readOps.getBoard(repo, boardId);
  assertBoardWritable(board, context, repo.levelAliases);

  // [LOG: 20260429_0248] Create writes must fail closed for guests even when
  // they are invoked without the board route middleware.
  assertAuthenticatedBoardUser(context);

  const capabilities = await ensureCapabilities(repo);
  const data = sanitizeNewPostInput(input, context);
  const now = new Date().toISOString();
  const sourceBoardId = resolveSourceBoardId(boardId);

  if (!capabilities.threaded) {
    return {
      board,
      post: await mutation.insertMappedPost(
        repo,
        mutation.buildPostPayload(repo, sourceBoardId, board, data, now, capabilities),
        'Post creation failed'
      )
    };
  }

  const inserted = await mutation.insertMappedPost(
    repo,
    mutation.buildPostPayload(repo, sourceBoardId, board, data, now, capabilities, {
      family_id: 0,
      sort_order: 0,
      depth: 0
    }),
    'Post creation failed'
  );
  const updated = await mutation.initializeThreadRoot(repo, sourceBoardId, inserted.id, now);

  return {
    board,
    post: updated
  };
}

async function replyToPost(repo, boardId, parentPostId, input, context = {}) {
  const board = await readOps.getBoard(repo, boardId);
  assertBoardWritable(board, context, repo.levelAliases);

  if (!board.replyEnabled) {
    throw createHttpError(400, 'Replies are disabled for this board.');
  }

  // [LOG: 20260429_0239] Reply writes must fail closed for guests even when
  // they are invoked without the board route middleware.
  assertAuthenticatedBoardUser(context);

  const capabilities = await ensureCapabilities(repo);
  const parent = await readOps.fetchPost(repo, boardId, parentPostId);
  if (!parent) {
    throw createHttpError(404, 'Parent post was not found.');
  }

  const data = sanitizeNewPostInput(input, context);
  const now = new Date().toISOString();
  const sourceBoardId = resolveSourceBoardId(boardId, parent.boardId);

  if (!capabilities.threaded) {
    return {
      board,
      post: await mutation.insertMappedPost(
        repo,
        mutation.buildPostPayload(repo, sourceBoardId, board, data, now, capabilities),
        'Reply creation failed'
      )
    };
  }

  await mutation.shiftReplyOrdering(repo, sourceBoardId, parent);

  const inserted = await mutation.insertMappedPost(
    repo,
    mutation.buildPostPayload(repo, sourceBoardId, board, data, now, capabilities, {
      family_id: parent.family,
      sort_order: parent.orderby + 1,
      depth: parent.step + 1
    }),
    'Reply creation failed'
  );

  return {
    board,
    post: inserted
  };
}

async function updatePost(repo, boardId, postId, input, context = {}) {
  const board = await readOps.getBoard(repo, boardId);
  assertBoardAccessible(board, context, repo.levelAliases);

  const post = await readOps.fetchPost(repo, boardId, postId);
  assertPostMutable(post, context);

  const patch = sanitizePostPatch(input, post);
  return {
    board,
    post: await mutation.updateMappedPost(
      repo,
      post.boardId,
      postId,
      {
        title: patch.title,
        content: patch.content,
        updated_at: new Date().toISOString()
      },
      'Post update failed'
    )
  };
}

async function deletePost(repo, boardId, postId, context = {}) {
  const board = await readOps.getBoard(repo, boardId);
  assertBoardAccessible(board, context, repo.levelAliases);

  const post = await readOps.fetchPost(repo, boardId, postId);
  assertPostMutable(post, context);

  await mutation.deletePostRecord(repo, post.boardId, postId);

  return {
    board,
    post
  };
}

async function recommendPost(repo, boardId, postId, context = {}) {
  const board = await readOps.getBoard(repo, boardId);
  if (!board) {
    throw createHttpError(404, 'Board was not found.');
  }

  // [LOG: 20260429_0123] Recommend writes must still honor board access rules.
  assertBoardAccessible(board, context, repo.levelAliases);

  const capabilities = await ensureCapabilities(repo);
  if (!capabilities.recommend) {
    throw createHttpError(400, 'Recommendations are not supported by this storage.');
  }

  const post = await readOps.fetchPost(repo, boardId, postId);
  if (!post) {
    throw createHttpError(404, 'Post was not found.');
  }

  // [LOG: 20260429_0229] Recommend must fail closed for guests even if the route
  // is reached without middleware, so direct/in-process callers cannot bypass auth.
  const userId = assertAuthenticatedBoardUser(context);
  if (post.userId === userId) {
    throw createHttpError(400, 'You cannot recommend your own post.');
  }

  const existingRecommendation = await mutation.findRecommendation(repo, postId, userId);
  if (existingRecommendation) {
    throw createHttpError(409, 'Post already recommended.');
  }

  const now = new Date().toISOString();
  await mutation.insertRecommendation(repo, postId, userId, now);

  return {
    board,
    post: await mutation.updateRecommendationCount(repo, post.boardId, postId, capabilities, post, now)
  };
}

module.exports = {
  createPost,
  replyToPost,
  updatePost,
  deletePost,
  recommendPost,
  buildPostPayload: mutation.buildPostPayload
};
