'use strict';

const { createHttpError, isUuid, mapPostRow } = require('./BoardRepositoryShared');

function supportsColumn(capabilities, column) {
  return Boolean(capabilities?.columns?.[column]);
}

function assignSupportedColumn(payload, capabilities, column, value, condition = true) {
  if (condition && supportsColumn(capabilities, column)) {
    payload[column] = value;
  }
}

async function insertMappedPost(repo, payload, failureMessage) {
  const { data, error } = await repo.client
    .from(repo.tables.posts)
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw createHttpError(502, `${failureMessage}: ${error.message}`);
  }

  return mapPostRow(data);
}

async function initializeThreadRoot(repo, boardId, postId, now) {
  const { data, error } = await repo.client
    .from(repo.tables.posts)
    .update({
      family_id: postId,
      sort_order: 0,
      depth: 0,
      updated_at: now
    })
    .eq('board_id', boardId)
    .eq('id', postId)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw createHttpError(404, '게시글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
    }
    throw createHttpError(502, `게시글 정렬 초기화 실패: ${error.message}`);
  }

  return mapPostRow(data);
}

async function shiftReplyOrdering(repo, boardId, parent) {
  const { data: shiftRows, error: shiftError } = await repo.client
    .from(repo.tables.posts)
    .select(`id, sort_order`)
    .eq('board_id', boardId)
    .eq('family_id', parent.family)
    .gt('sort_order', parent.orderby)
    .order('sort_order', { ascending: false });

  if (shiftError) {
    throw createHttpError(502, `답글 정렬 조회 실패: ${shiftError.message}`);
  }

  // Each row has a distinct id, so the updates can safely run concurrently.
  // This removes the previous sequential N-round-trip latency while preserving
  // the existing per-row increment semantics. A single SQL/RPC update can be
  // introduced later without changing this caller's contract.
  const now = new Date().toISOString();
  await Promise.all((shiftRows || []).map(async (row) => {
    const { error } = await repo.client
      .from(repo.tables.posts)
      .update({
        sort_order: Number(row.sort_order ?? 0) + 1,
        updated_at: now
      })
      .eq('id', row.id);

    if (error) {
      throw createHttpError(502, `답글 정렬 갱신 실패: ${error.message}`);
    }
  }));
}

async function updateMappedPost(repo, boardId, postId, patch, failureMessage) {
  const { data, error } = await repo.client
    .from(repo.tables.posts)
    .update(patch)
    .eq('board_id', boardId)
    .eq('id', Number(postId))
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw createHttpError(404, '게시글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
    }
    throw createHttpError(502, `${failureMessage}: ${error.message}`);
  }

  return mapPostRow(data);
}

async function deletePostRecord(repo, boardId, postId) {
  const { error } = await repo.client
    .from(repo.tables.posts)
    .delete()
    .eq('board_id', boardId)
    .eq('id', Number(postId));

  if (error) {
    throw createHttpError(502, `게시글 삭제 실패: ${error.message}`);
  }
}

async function findRecommendation(repo, postId, userId) {
  const { data, error } = await repo.client
    .from(repo.tables.recommendations)
    .select('id')
    .eq('post_id', Number(postId))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') {
      throw createHttpError(400, '추천 기능이 현재 저장소에서 지원되지 않습니다.');
    }
    throw createHttpError(502, `추천 상태 확인 실패: ${error.message}`);
  }

  return data;
}

function isDuplicateRecommendationError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '23505' || message.includes('duplicate key');
}

async function insertRecommendation(repo, postId, userId, now) {
  const { error } = await repo.client
    .from(repo.tables.recommendations)
    .insert({
      post_id: Number(postId),
      user_id: userId,
      created_at: now
    });

  if (error) {
    if (error.code === 'PGRST205') {
      throw createHttpError(400, '추천 기능이 현재 저장소에서 지원되지 않습니다.');
    }
    if (isDuplicateRecommendationError(error)) {
      throw createHttpError(409, 'Post already recommended.');
    }
    throw createHttpError(502, `추천 저장 실패: ${error.message}`);
  }
}

async function updateRecommendationCount(repo, boardId, postId, capabilities, now) {
  const { count, error: countError } = await repo.client
    .from(repo.tables.recommendations)
    .select('id', { count: 'exact', head: true })
    .eq('post_id', Number(postId));

  if (countError) {
    throw createHttpError(502, `추천 수 집계 실패: ${countError.message}`);
  }

  return updateMappedPost(
    repo,
    boardId,
    postId,
    {
      [capabilities.recommend]: Number(count || 0),
      updated_at: now
    },
    '추천 값 갱신 실패'
  );
}

function buildPostPayload(repo, boardId, board, data, now, capabilities, extra = {}) {
  const payload = {
    board_id: boardId,
    title: data.title,
    content: data.content,
    created_at: now,
    updated_at: now,
    ...extra
  };

  assignSupportedColumn(payload, capabilities, 'user_id', data.userId);
  assignSupportedColumn(payload, capabilities, 'nick_name', data.nickName);
  assignSupportedColumn(payload, capabilities, 'author_nickname', data.nickName);
  assignSupportedColumn(payload, capabilities, 'author_id', data.userId, isUuid(data.userId));

  if (capabilities.hit) payload[capabilities.hit] = 0;

  if (capabilities.threaded && !extra.family_id && !extra.sort_order) {
    payload.family_id = 0;
    payload.sort_order = 0;
    payload.depth = 0;
  }

  if (capabilities.recommend) payload[capabilities.recommend] = 0;
  if (capabilities.boardType) payload.board_type = board.menuPath || board.boardId || 'top';
  if (capabilities.category) payload[capabilities.category] = data.category || null;
  if (capabilities.hidden) payload.is_hidden = false;
  if (capabilities.notice) payload.is_notice = false;

  return payload;
}

module.exports = {
  insertMappedPost,
  initializeThreadRoot,
  shiftReplyOrdering,
  updateMappedPost,
  deletePostRecord,
  findRecommendation,
  insertRecommendation,
  updateRecommendationCount,
  buildPostPayload
};
