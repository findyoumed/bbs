'use strict';

/**
 * [LOG: 20260426_1600] 쿼리 매개변수 처리를 위한 표준 유틸리티 도입 (진화 모드 3/100)
 * 컬렉션 조회(목록) 시 사용되는 페이지네이션, 정렬, 검색 옵션 처리를 구조화합니다.
 */

/**
 * URL 검색 매개변수에서 페이지네이션 정보를 추출합니다.
 */
function parsePagination(searchParams, defaults = {}) {
  // [LOG_ID: 20260801_0900] ?page=1.5 같은 소수 입력이 (page-1)*pageSize = 7.5 같은
  // 비정수 offset을 만들어 Supabase range(7.5, 21.5) 호출로 흘러갔다 — PostgREST는
  // Range 헤더에 정수만 허용하므로 오류를 던지고 502로 노출됐다. 경로 파라미터는
  // parsePositiveIntParam이 Number.isInteger로 400으로 막는데(20260731_1900 참고),
  // 쿼리 파라미터에는 동등한 가드가 없었다. Math.floor로 page와 pageSize를 정수로
  // 강제해 offset과 limit이 항상 정수임을 보장한다.
  const page = Math.floor(Math.max(1, Number(searchParams.get('page')) || defaults.page || 1));
  const pageSize = Math.floor(Math.max(1, Math.min(100, Number(searchParams.get('pageSize')) || defaults.pageSize || 20)));
  
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize
  };
}

/**
 * URL 검색 매개변수에서 정렬 정보를 추출합니다.
 */
function parseSort(searchParams, defaults = {}) {
  const orderBy = searchParams.get('orderBy') || defaults.orderBy || 'id';
  const rawDirection = String(searchParams.get('orderDirection') || defaults.orderDirection || 'asc').toLowerCase();
  const ascending = rawDirection !== 'desc';
  
  return {
    orderBy,
    orderDirection: ascending ? 'asc' : 'desc',
    ascending
  };
}

/**
 * 공통 검색 모드 정규화
 */
function normalizeSearchMode(mode) {
  return String(mode || '').trim().toLowerCase();
}

/**
 * 검색 결과에 대한 표준 페이지네이션 메타데이터를 생성합니다.
 */
function buildPaginationMetadata(totalCount, page, pageSize) {
  const count = Number(totalCount || 0);
  const totalPages = Math.max(1, Math.ceil(count / pageSize) || 1);
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return {
    page: currentPage,
    pageSize,
    totalCount: count,
    pageCount: totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages
  };
}

module.exports = {
  parsePagination,
  parseSort,
  normalizeSearchMode,
  buildPaginationMetadata
};
