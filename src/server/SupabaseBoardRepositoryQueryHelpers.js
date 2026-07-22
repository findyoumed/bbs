'use strict';

const { ensureCapabilities } = require('./SupabaseBoardRepositorySchema');
const { getMergedBoardSourceIds } = require('./BoardVirtualBoards');
const { parseMultiTermQuery } = require('./BoardRepositorySearch');

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

  // [LOG_ID: 20260713_1020] Supabase k 주제어 대괄호 ilike 필터 적용
  if (search?.k) {
    const escapedK = escapeLikeQuery(String(search.k).trim());
    queryBuilder = queryBuilder.ilike('title', `%[${escapedK}]%`);
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
    // [LOG_ID: 20260722_3200] 하이텔 책(그림 9.4) "*"(AND)/"+"(OR) 다중 검색어 —
    // Memory 드라이버(BoardRepositorySearch.js filterPostsBySearch)와 동일 파서를 공유한다.
    // PostgREST에서 같은 쿼리 빌더에 .or()를 여러 번 체이닝하면 그 그룹들끼리는 AND로
    // 묶이므로, AND는 항별로 .or() 호출을 반복하고 OR는 절을 한 번의 .or()에 합친다.
    case 'lt': {
      const parsed = parseMultiTermQuery(query);
      if (parsed.operator === 'and') {
        return parsed.terms.reduce((qb, term) => {
          const esc = escapeLikeQuery(term);
          return qb.or(`title.ilike.%${esc}%,content.ilike.%${esc}%`);
        }, queryBuilder);
      }
      if (parsed.operator === 'or') {
        const clause = parsed.terms
          .map((term) => { const esc = escapeLikeQuery(term); return `title.ilike.%${esc}%,content.ilike.%${esc}%`; })
          .join(',');
        return queryBuilder.or(clause);
      }
      return queryBuilder.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }
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
    case 'recent': {
      const days = Number(query) || 3;
      const cutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
      return queryBuilder.gte('created_at', cutoff);
    }
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
