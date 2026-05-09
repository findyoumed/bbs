'use strict';

/**
 * [LOG: 20260426_1600] 쿼리 매개변수 처리를 위한 표준 유틸리티 도입 (진화 모드 3/100)
 * 컬렉션 조회(목록) 시 사용되는 페이지네이션, 정렬, 검색 옵션 처리를 구조화합니다.
 */

/**
 * URL 검색 매개변수에서 페이지네이션 정보를 추출합니다.
 */
function parsePagination(searchParams, defaults = {}) {
  const page = Math.max(1, Number(searchParams.get('page')) || defaults.page || 1);
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize')) || defaults.pageSize || 20));
  
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
