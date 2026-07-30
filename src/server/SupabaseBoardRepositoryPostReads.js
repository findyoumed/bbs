'use strict';

const {
  createHttpError,
  mapPostRow,
  buildPagination
} = require('./BoardRepositoryShared');
const { assertBoardAccessible } = require('./BoardRepositoryAccess');
const { normalizeSearchOptions } = require('./BoardRepositorySearch');
const { getBoard } = require('./SupabaseBoardRepositoryBoardReads');
const {
  applyBoardFilter,
  applyPostOrdering,
  applySupabaseSearch,
  ensureCapabilities
} = require('./SupabaseBoardRepositoryQueryHelpers');
// [LOG_ID: 20260730_0530] resolveTrustedVirtualBoardId(virtualBoardId 검증 정책, LOG_ID
// 20260728_2325)는 Memory 드라이버에 바이트 단위로 복제돼 있었다 — 병합 관계를 아는
// BoardVirtualBoards가 소유하도록 옮기고 양쪽이 같은 구현을 쓴다.
const { resolveTrustedVirtualBoardId } = require('./BoardVirtualBoards');

async function countPosts(repo) {
  const { count, error } = await repo.client
    .from(repo.tables.posts)
    .select('id', { count: 'exact', head: true });

  if (error) throw createHttpError(502, `전체 게시글 수 조회 실패: ${error.message}`);
  return Number(count || 0);
}

async function countPostsSince(repo, since) {
  const parsed = since instanceof Date ? since : new Date(since || 0);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const sinceIso = parsed.toISOString();
  const { count, error } = await repo.client
    .from(repo.tables.posts)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);

  if (error) throw createHttpError(502, `오늘 게시글 수 조회 실패: ${error.message}`);
  return Number(count || 0);
}

// [LOG_ID: 20260713_1230] 나우누리식 게시판 메뉴 ( 신규 / 전체 ) 건수 — 게시판별 HEAD 카운트를
// 병렬 수행하고 저장소 인스턴스에 60초 캐시해 Supabase 부하를 막는다. 실패한 게시판은 표기만 생략.
async function listBoardCounts(repo, options = {}) {
  const cacheTtlMs = 60 * 1000;
  const cached = repo._boardCountsCache;
  if (cached && (Date.now() - cached.at) < cacheTtlMs) {
    return cached.data;
  }

  const days = Math.max(1, Number(options.recentDays) || 3);
  const sinceIso = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
  const counts = {};

  await Promise.all((repo.boards || []).map(async (board) => {
    const base = () => applyBoardFilter(
      repo.client.from(repo.tables.posts).select('id', { count: 'exact', head: true }),
      board.boardId
    );
    const [totalRes, recentRes] = await Promise.all([
      base(),
      base().gte('created_at', sinceIso)
    ]);
    if (totalRes.error || recentRes.error) return;
    counts[board.boardId] = {
      total: Number(totalRes.count || 0),
      recent: Number(recentRes.count || 0)
    };
  }));

  repo._boardCountsCache = { at: Date.now(), data: counts };
  return counts;
}

async function listPosts(repo, boardId, options = {}) {
  const board = await getBoard(repo, boardId);
  assertBoardAccessible(board, options.context, repo.levelAliases);

  const pageSize = Math.max(1, Number(options.pageSize) || 15);
  const search = normalizeSearchOptions(options);
  let requestedPage = Math.max(1, Number(options.page) || 1);
  let result = await fetchPagedPosts(repo, boardId, requestedPage, pageSize, search);
  const totalPages = Math.max(1, Math.ceil((result.count || 0) / pageSize) || 1);

  if (requestedPage > totalPages) {
    requestedPage = totalPages;
    result = await fetchPagedPosts(repo, boardId, requestedPage, pageSize, search);
  }

  return {
    board,
    items: (result.data || []).map(mapPostRow),
    pagination: buildPagination(result.count || 0, requestedPage, pageSize),
    search
  };
}

// [LOG_ID: 20260728_1728] PDS 가상 게시판 및 검색 상태의 글보기 내비게이션 복원을 위해 virtualBoardId와 search를 연계하도록 함
async function getPost(repo, boardId, postId, options = {}) {
  const targetBoardId = resolveTrustedVirtualBoardId(options.virtualBoardId, boardId) || boardId;
  const board = await getBoard(repo, targetBoardId);
  if (!board) {
    throw createHttpError(404, '게시판을 찾을 수 없습니다.');
  }
  assertBoardAccessible(board, options.context, repo.levelAliases);

  const capabilities = await ensureCapabilities(repo);
  // 포스트 데이터 조회 시에는 중복 localId 충돌 방지를 위해 원래의 물리 게시판 id를 사용
  let post = await fetchPostByLocalId(repo, boardId, postId);
  if (!post) {
    throw createHttpError(404, '게시글을 찾을 수 없습니다.');
  }

  if (options.incrementHit && capabilities.hit && post.userId !== (options.viewerId || 'guest')) {
    const { data, error } = await repo.client
      .from(repo.tables.posts)
      .update({
        [capabilities.hit]: post.hit + 1
      })
      .eq('board_id', post.boardId)
      .eq('id', post.id)
      .select('*')
      .single();

    if (error) throw createHttpError(502, `조회수 갱신 실패: ${error.message}`);
    post = mapPostRow(data);
  }

  return {
    board,
    post,
    navigation: await getNavigation(repo, targetBoardId, post.id, options.search)
  };
}

async function fetchPagedPosts(repo, boardId, page, pageSize, search = null) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const capabilities = await ensureCapabilities(repo);

  let query = repo.client
    .from(repo.tables.posts)
    .select('*', { count: 'exact' });

  query = applyBoardFilter(query, boardId);
  query = applySupabaseSearch(query, capabilities, search);
  query = applyPostOrdering(query, repo, capabilities);

  const { data, error, count } = await query.range(start, end);
  if (error) throw createHttpError(502, `게시글 목록 조회 실패: ${error.message}`);

  return { data, count: count || 0 };
}

async function fetchPost(repo, boardId, postId) {
  let query = repo.client
    .from(repo.tables.posts)
    .select('*');

  query = applyBoardFilter(query, boardId);

  const { data, error } = await query
    .eq('id', Number(postId))
    .maybeSingle();

  if (error) throw createHttpError(502, `게시글 조회 실패: ${error.message}`);
  return mapPostRow(data);
}

// [LOG_ID: 20260726_1800] PDS(자료실)는 pds/pds_all/pds_util/pds_game/pds_graphic/pds_sound/
// pds_prog 7개 물리 게시판을 하나의 가상 게시판("pds")으로 병합하는데(BoardVirtualBoards.js
// MERGED_BOARD_SOURCES), local_id는 각 물리 게시판이 독립적으로 채번한다 — 즉 서로 다른
// 하위 게시판에 local_id가 같은 글이 동시에 존재할 수 있다(실측: 이 시스템의 실제 PDS
// 데이터에서 local_id 1/2/3이 전부 6개 하위 게시판에 걸쳐 충돌 중이었다). applyBoardFilter가
// 병합 시 여러 board_id를 `.in()`으로 한 번에 조회하므로, .maybeSingle()은 이런 충돌에서
// "복수 행" PostgREST 오류(502)를 던져 그 local_id를 가진 글은 전부 조회 자체가 막혔다
// (사용자 요청 "PDS 업로드/다운로드 전체 플로우 전수조사"로 발견 — 실제 서비스 데이터의
// 16건 중 15건이 이 충돌 때문에 열람 불가 상태였다). 정확한 대상은 호출부가 이미 아는
// 구체적 board_id(목록에서 가져온 개별 글의 boardId)를 넘겨야 확실히 구분되지만(클라이언트
// 쪽에서 별도로 고쳤다), URL 직접 접근·이전/다음 글 탐색처럼 구체적 board_id를 모르는
// 경로도 있어 여기서는 최소한 "조용히 막히는" 대신 결정적으로 하나를 골라 응답한다(가장
// 최근에 작성된 글 우선) — 완벽한 구분은 아니지만 오류로 완전히 막히는 것보다는 낫다.
async function fetchPostByLocalId(repo, boardId, localId) {
  let query = repo.client
    .from(repo.tables.posts)
    .select('*');

  query = applyBoardFilter(query, boardId);

  const { data, error } = await query
    .eq('local_id', Number(localId))
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw createHttpError(502, `게시글 조회 실패: ${error.message}`);
  return mapPostRow(Array.isArray(data) ? (data[0] || null) : data);
}

async function getNavigation(repo, boardId, postId, search = null) {
  const capabilities = await ensureCapabilities(repo);
  const pid = Number(postId);

  const post = await fetchPost(repo, boardId, pid);
  if (!post) {
    return { latestId: null, prevId: null, nextId: null };
  }
  const localPid = Number(post.localId || post.id);

  const extractNavId = (row) => (row ? Number(row.local_id ?? row.id ?? 0) : null);

  let latestQuery = applyBoardFilter(repo.client.from(repo.tables.posts).select('local_id, id'), boardId);
  latestQuery = applySupabaseSearch(latestQuery, capabilities, search);
  const { data: latestData } = await applyPostOrdering(latestQuery, repo, capabilities).limit(1).maybeSingle();

  if (capabilities.threaded) {
    const familyId = Number(post.family || 0);
    const sortOrder = Number(post.orderby || 0);

    let prevQuery = applyBoardFilter(repo.client.from(repo.tables.posts).select('local_id, id'), boardId);
    prevQuery = applySupabaseSearch(prevQuery, capabilities, search);
    prevQuery = prevQuery
      .or(`family_id.gt.${familyId},and(family_id.eq.${familyId},sort_order.lt.${sortOrder})`)
      .order('family_id', { ascending: true })
      .order('sort_order', { ascending: false })
      .limit(1);
    const { data: prevData } = await prevQuery.maybeSingle();

    let nextQuery = applyBoardFilter(repo.client.from(repo.tables.posts).select('local_id, id'), boardId);
    nextQuery = applySupabaseSearch(nextQuery, capabilities, search);
    nextQuery = nextQuery
      .or(`family_id.lt.${familyId},and(family_id.eq.${familyId},sort_order.gt.${sortOrder})`)
      .order('family_id', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1);
    const { data: nextData } = await nextQuery.maybeSingle();

    return {
      latestId: extractNavId(latestData),
      prevId: extractNavId(prevData),
      nextId: extractNavId(nextData)
    };
  }

  // [LOG: 20260429_0508] Non-threaded boards render in descending id order,
  // so previous/next ids must follow that visible order instead of numeric order.
  const idCol = capabilities.localId || 'id';
  let prevQuery = applyBoardFilter(repo.client.from(repo.tables.posts).select('local_id, id'), boardId);
  prevQuery = applySupabaseSearch(prevQuery, capabilities, search);
  const { data: prevData } = await prevQuery.gt(idCol, localPid).order(idCol, { ascending: true }).limit(1).maybeSingle();

  let nextQuery = applyBoardFilter(repo.client.from(repo.tables.posts).select('local_id, id'), boardId);
  nextQuery = applySupabaseSearch(nextQuery, capabilities, search);
  const { data: nextData } = await nextQuery.lt(idCol, localPid).order(idCol, { ascending: false }).limit(1).maybeSingle();

  return {
    latestId: extractNavId(latestData),
    prevId: extractNavId(prevData),
    nextId: extractNavId(nextData)
  };
}

async function listHotPosts(repo, options = {}) {
  const capabilities = await ensureCapabilities(repo);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
  const days = Math.max(1, Number(options.days) || 7);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = repo.client
    .from(repo.tables.posts)
    .select('*')
    .gte('created_at', sinceIso);

  if (capabilities.recommend) {
    query = query.order(capabilities.recommend, { ascending: false });
  }
  if (capabilities.hit) {
    query = query.order(capabilities.hit, { ascending: false });
  } else {
    query = query.order('id', { ascending: false });
  }
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw createHttpError(502, `인기 게시글 조회 실패: ${error.message}`);
  return (data || []).map(mapPostRow);
}

module.exports = {
  countPosts,
  countPostsSince,
  listBoardCounts,
  fetchPagedPosts,
  fetchPost,
  fetchPostByLocalId,
  getNavigation,
  getPost,
  listHotPosts,
  listPosts
};
