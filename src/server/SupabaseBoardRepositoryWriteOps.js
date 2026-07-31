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
  const parent = await readOps.fetchPostByLocalId(repo, boardId, parentPostId);
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

  const post = await readOps.fetchPostByLocalId(repo, boardId, postId);
  assertPostMutable(post, context);

  const patch = sanitizePostPatch(input, post);
  return {
    board,
    post: await mutation.updateMappedPost(
      repo,
      post.boardId,
      post.id,
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

  const post = await readOps.fetchPostByLocalId(repo, boardId, postId);
  assertPostMutable(post, context);

  // [LOG_ID: 20260722_0010] 원글을 지우면 답글들이 존재하지 않는 family를 가리키는 채로 남아
  // 목록에 맥락 없이 떠 있었다("원글 삭제 시 답글 고아" — 사용자 확인 후 진행). 완전 삭제 대신,
  // "원글"(step===0)이면서 같은 family에 다른 글(답글)이 남아있는 경우에만 제목/본문을
  // 자리표시자로 바꿔 스레드 구조를 보존한다. 답글(step>0)은 이 데이터 모델에 명시적 부모
  // 추적이 없어 "그 답글에 딸린 항목"이라는 개념 자체가 없으므로 항상 기존대로 완전 삭제한다
  // (family에 다른 멤버가 있다고 무조건 자리표시자로 바꾸면 답글 삭제까지 과잉 적용된다).
  // 스레드 개념이 없는(비-threaded) 게시판은 family_id 컬럼 자체가 없어 항상 완전 삭제로 폴백한다.
  const capabilities = await ensureCapabilities(repo);
  if (capabilities.threaded && post.step === 0) {
    const { count, error } = await repo.client
      .from(repo.tables.posts)
      .select('id', { count: 'exact', head: true })
      .eq('board_id', post.boardId)
      .eq('family_id', post.family)
      .neq('id', post.id);

    if (error) {
      throw createHttpError(502, `답글 확인 실패: ${error.message}`);
    }

    if (count > 0) {
      return {
        board,
        tombstoned: true,
        post: await mutation.updateMappedPost(
          repo,
          post.boardId,
          post.id,
          {
            title: '[삭제된 글입니다]',
            content: '',
            updated_at: new Date().toISOString()
          },
          'Post delete (tombstone) failed'
        )
      };
    }
  }

  await mutation.deletePostRecord(repo, post.boardId, post.id);

  return {
    board,
    // [LOG_ID: 20260727_1425] tombstone 경로(위)는 글 행 자체가 살아있어(스레드 구조 보존 목적)
    // attachments.post_id의 ON DELETE CASCADE가 전혀 발동하지 않는다 — 첨부파일이 "삭제된 글"
    // 표시 아래에서도 계속 목록·다운로드가 가능하게 남는 모순이 있었다(실측 확인). 완전 삭제는
    // CASCADE로 이미 자동 정리되므로 별도 표시가 필요 없다 — boardRoutes.js가 이 플래그로
    // tombstone된 경우에만 첨부를 별도로 정리한다.
    tombstoned: false,
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

  const post = await readOps.fetchPostByLocalId(repo, boardId, postId);
  if (!post) {
    throw createHttpError(404, 'Post was not found.');
  }

  // [LOG: 20260429_0229] Recommend must fail closed for guests even if the route
  // is reached without middleware, so direct/in-process callers cannot bypass auth.
  const userId = assertAuthenticatedBoardUser(context);
  // [LOG: 20260731_1740] 레거시 글 작성자 아이디 대소문자 차이로 추천이 우회되는 결함 방지
  const postAuthorId = String(post.userId || '').trim().toLowerCase();
  if (postAuthorId === userId) {
    throw createHttpError(400, 'You cannot recommend your own post.');
  }

  const existingRecommendation = await mutation.findRecommendation(repo, post.id, userId);
  if (existingRecommendation) {
    throw createHttpError(409, 'Post already recommended.');
  }

  const now = new Date().toISOString();
  await mutation.insertRecommendation(repo, post.id, userId, now);

  return {
    board,
    post: await mutation.updateRecommendationCount(repo, post.boardId, post.id, capabilities, now)
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
