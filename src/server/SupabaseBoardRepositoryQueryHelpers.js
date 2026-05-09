'use strict';

const { ensureCapabilities } = require('./SupabaseBoardRepositorySchema');
const { getMergedBoardSourceIds } = require('./BoardVirtualBoards');

function escapeLikeQuery(query) {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,');
}

function applySupabaseSearch(queryBuilder, capabilities, search) {
  if (search?.category && capabilities.category) {
    queryBuilder = queryBuilder.eq(capabilities.category, search.category);
  }

  if (!search?.mode || !search?.query) {
    return queryBuilder;
  }

  const query = String(search.query || '').trim();
  if (!query) {
    return queryBuilder;
  }

  const escaped = escapeLikeQuery(query);
  const userIdField = capabilities.userId || 'user_id';
  const nickNameField = capabilities.nickName || 'nick_name';

  switch (search.mode) {
    case 'lt':
      return queryBuilder.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    case 'li':
      if (userIdField === 'author_id') {
        return queryBuilder.ilike(nickNameField, `%${escaped}%`);
      }
      return queryBuilder.or(`${userIdField}.ilike.%${escaped}%,${nickNameField}.ilike.%${escaped}%`);
    case 'lc':
      return queryBuilder.ilike('content', `%${escaped}%`);
    case 'ln':
      return queryBuilder.ilike(nickNameField, `%${escaped}%`);
    case 'la':
      if (userIdField === 'author_id') {
        return queryBuilder.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%,${nickNameField}.ilike.%${escaped}%`);
      }
      return queryBuilder.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%,${userIdField}.ilike.%${escaped}%,${nickNameField}.ilike.%${escaped}%`);
    default:
      return queryBuilder;
  }
}

function applyPostOrdering(queryBuilder, repo, capabilities) {
  if (capabilities.threaded) {
    return queryBuilder
      .order('family_id', { ascending: false })
      .order('sort_order', { ascending: true });
  }

  return queryBuilder.order('id', { ascending: false });
}

function applyBoardFilter(queryBuilder, boardId) {
  const boardIds = getMergedBoardSourceIds(boardId).filter(Boolean);
  if (boardIds.length > 1) {
    return queryBuilder.in('board_id', boardIds);
  }
  return queryBuilder.eq('board_id', boardIds[0] || String(boardId || '').trim());
}

module.exports = {
  applyBoardFilter,
  applyPostOrdering,
  applySupabaseSearch,
  ensureCapabilities,
  escapeLikeQuery
};
