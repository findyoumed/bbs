// [LOG: 20260801_0100] 물리 게시판 ID → 부모 가상 게시판 ID 매핑.
// 서버측 src/server/BoardVirtualBoards.js의 MERGED_BOARD_SOURCES와 동기화 유지 필요.
// 가상 게시판 자체('pds')는 포함하지 않는다 — invalidateListCache('pds')는 이미 'pds_*'
// 전체를 지우므로 추가 cascade가 필요 없다.
const PHYSICAL_TO_VIRTUAL = Object.freeze({
  pds_all: 'pds',
  pds_util: 'pds',
  pds_game: 'pds',
  pds_graphic: 'pds',
  pds_sound: 'pds',
  pds_prog: 'pds'
});

export function createPostService(deps) {
  const { apiFetch, state } = deps;
  // [LOG_ID: 20260804_1114] Attachment code stays outside the startup module graph
  // and is initialized once on the first attachment operation.
  let attachmentServicePromise;
  function getAttachmentService() {
    if (!attachmentServicePromise) {
      attachmentServicePromise = import('./postAttachmentService.js')
        .then((module) => module.createPostAttachmentService({ apiFetch, state }))
        .catch((error) => {
          attachmentServicePromise = null;
          throw error;
        });
    }
    return attachmentServicePromise;
  }

  // [LOG: 20260426_2300] 캐시 저장소 (목록 캐시는 boardId_page_search 형식, 본문 캐시는 boardId_postId 형식)
  const listCache = new Map();
  const postCache = new Map();
  let listCacheGeneration = 0;

  // [LOG_ID: 20260719_1600] 천리안 원전 6.4.7 ENV "목록 출력방식"(SET SORT) 재현.
  // 서버는 최신순(내림차순)으로 페이지 단위를 내려주므로, OLD 설정 시 현재 페이지 안에서만
  // 순서를 뒤집는다(페이지 경계를 다시 계산하는 서버 정렬 파라미터까지는 이번 스코프가 아니다).
  function applySortOrder(items) {
    const sort = String(state.envVars?.SORT || '').trim().toUpperCase();
    return sort === 'OLD' ? [...items].reverse() : items;
  }

  function normalizePostListResponse(data, fallbackPage) {
    return {
      board: data?.board || null,
      items: Array.isArray(data?.items) ? data.items : (data?.posts || []),
      page: Number(data?.pagination?.page || data?.page || fallbackPage || 1),
      totalCount: Number(data?.pagination?.totalCount || data?.totalCount || 0),
      totalPages: Number(data?.pagination?.pageCount || data?.totalPages || 1),
      // [LOG_ID: 20260805_1020] Keep outages distinct from genuinely empty boards.
      degraded: data?.degraded === true,
      degradedReason: String(data?.degradedReason || '')
    };
  }
  function normalizePostViewResponse(data) {
    return data?.post ? { board: data.board || null, post: data.post } : { board: null, post: data || null };
  }

  // [LOG: 20260801_0100] 관련 게시판의 모든 목록 캐시 삭제.
  // 물리 게시판(pds_util 등)이 가상 게시판(pds) 소속이면 부모 가상 게시판의 목록 캐시도
  // 함께 삭제한다. 예: pds_util 글 삭제 후 PDS 가상 목록으로 돌아올 때 stale 캐시가
  // 서비스되던 문제 해소 — 가상 게시판 키(pds_1 등)도 함께 제거된다.
  function invalidateListCache(boardId) {
    const keyPrefix = `${boardId}_`;
    const virtualParent = PHYSICAL_TO_VIRTUAL[String(boardId || '')];
    const virtualPrefix = virtualParent ? `${virtualParent}_` : null;
    listCacheGeneration += 1;
    for (const key of listCache.keys()) {
      if (key.startsWith(keyPrefix) || (virtualPrefix && key.startsWith(virtualPrefix))) {
        listCache.delete(key);
      }
    }
  }

  // [LOG: 20260801_0000] 특정 글의 모든 postCache 변형 키 삭제 — 단순 `${boardId}_${postId}` 뿐 아니라
  // loadPost가 만드는 가상게시판(_v_) 및 검색 파라미터(_lt_/_li_/_lc_ 등) 변형 키까지 포함한다.
  // 수정·삭제·추천 후 가상게시판(PDS 병합 보드 등)이나 검색 문맥에서 같은 글을 재조회하면
  // 기존 코드(단일 키 삭제)는 확장된 변형 키를 놔두어 구버전이 그대로 서비스되던 문제를 해소한다.
  function invalidatePostCache(boardId, postId) {
    const keyPrefix = `${boardId}_${postId}`;
    for (const key of postCache.keys()) {
      if (key === keyPrefix || key.startsWith(keyPrefix + '_')) {
        postCache.delete(key);
      }
    }
  }

  /**
   * [LOG: 20260426_2305] 검색 파라미터를 포함한 고유한 캐시 키 생성
   */
  function buildListCacheKey(boardId, page, searchParams = {}) {
    let key = `${boardId}_${page}`;
    if (searchParams.lt) key += `_lt_${searchParams.lt}`;
    if (searchParams.li) key += `_li_${searchParams.li}`;
    if (searchParams.lc) key += `_lc_${searchParams.lc}`;
    // [LOG_ID: 20260727_2340] 주제어검색(K)이 여기서 캐시 키에 반영되지 않고(k 누락) 아래 URL
    // 빌더에도 k가 빠져 있어, 명령이 화면 제목에 "[주제어검색: ...]"라고 표시만 될 뿐 실제 요청은
    // 항상 무필터 전체 목록과 동일했다(서버 라우트의 k 누락과 함께 고쳐야 실제로 동작함).
    if (searchParams.k) key += `_k_${searchParams.k}`;
    if (searchParams.la) key += `_la_${searchParams.la}`;
    if (searchParams.recent) key += `_recent_${searchParams.recent}`;
    return key;
  }

  function buildPostsUrl(boardId, page, searchParams) {
    let url = `/api/boards/${encodeURIComponent(boardId)}?page=${page}&pageSize=15`;
    if (searchParams.lt) url += `&lt=${encodeURIComponent(searchParams.lt)}`;
    if (searchParams.li) url += `&li=${encodeURIComponent(searchParams.li)}`;
    if (searchParams.lc) url += `&lc=${encodeURIComponent(searchParams.lc)}`;
    if (searchParams.k) url += `&k=${encodeURIComponent(searchParams.k)}`;
    if (searchParams.la) url += `&la=${encodeURIComponent(searchParams.la)}`;
    if (searchParams.recent) url += `&recent=${encodeURIComponent(searchParams.recent)}`;
    return url;
  }

  async function fetchPostsPage(boardId, page, searchParams, generation = listCacheGeneration) {
    const cacheKey = buildListCacheKey(boardId, page, searchParams);
    const cached = listCache.get(cacheKey);
    if (cached) return cached;

    const data = normalizePostListResponse(
      await apiFetch(buildPostsUrl(boardId, page, searchParams)),
      page
    );
    if (!data.degraded && generation === listCacheGeneration) {
      listCache.set(cacheKey, data);
    }
    return data;
  }

  function applyPostListState(data) {
    state.posts = applySortOrder(data.items);
    state.totalCount = data.totalCount;
    state.totalPages = data.totalPages;
    state.page = data.page;
  }

  function scheduleNextPagePrefetch(boardId, data, searchParams) {
    if (data.degraded) return;
    // [LOG_ID: 20260805_1412] 다음 페이지 및 상위 3개 게시물 본문을 유휴 시간에 사전 로드(Prefetch)
    void import('./postListPrefetchService.js')
      .then(({ scheduleNextPagePrefetch: schedule }) => schedule({
        boardId, data, searchParams, listCache, buildListCacheKey,
        fetchPostsPage, loadPost, generation: listCacheGeneration
      }))
      .catch(() => {});
  }

  async function loadPosts(boardId, page = 1, searchParams = {}) {
    const data = await fetchPostsPage(boardId, page, searchParams);

    applyPostListState(data);
    scheduleNextPagePrefetch(boardId, data, searchParams);
    return data;
  }

  // [LOG_ID: 20260728_1728] PDS 가상 게시판 및 검색 상태의 글보기 내비게이션 복원을 위해 virtualBoardId와 searchParams를 함께 실어 보내고 캐시하도록 함
  async function loadPost(boardId, postId, virtualBoardId = '', searchParams = {}) {
    let cacheKey = virtualBoardId ? `${boardId}_${postId}_v_${virtualBoardId}` : `${boardId}_${postId}`;
    if (searchParams.lt) cacheKey += `_lt_${searchParams.lt}`;
    if (searchParams.li) cacheKey += `_li_${searchParams.li}`;
    if (searchParams.lc) cacheKey += `_lc_${searchParams.lc}`;
    if (searchParams.k) cacheKey += `_k_${searchParams.k}`;
    if (searchParams.la) cacheKey += `_la_${searchParams.la}`;
    if (searchParams.recent) cacheKey += `_recent_${searchParams.recent}`;

    if (postCache.has(cacheKey)) {
      return postCache.get(cacheKey);
    }

    let url = `/api/boards/${encodeURIComponent(boardId)}/posts/${postId}?view=1`;
    if (virtualBoardId) {
      url += `&virtualBoardId=${encodeURIComponent(virtualBoardId)}`;
    }
    if (searchParams.lt) url += `&lt=${encodeURIComponent(searchParams.lt)}`;
    if (searchParams.li) url += `&li=${encodeURIComponent(searchParams.li)}`;
    if (searchParams.lc) url += `&lc=${encodeURIComponent(searchParams.lc)}`;
    if (searchParams.k) url += `&k=${encodeURIComponent(searchParams.k)}`;
    if (searchParams.la) url += `&la=${encodeURIComponent(searchParams.la)}`;
    if (searchParams.recent) url += `&recent=${encodeURIComponent(searchParams.recent)}`;

    const data = normalizePostViewResponse(await apiFetch(url));
    postCache.set(cacheKey, data);
    return data;
  }

  async function createPost(boardId, payload) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts`, { method: 'POST', body: JSON.stringify(payload) });
    invalidateListCache(boardId);
    return result;
  }

  async function updatePost(boardId, postId, payload) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    invalidatePostCache(boardId, postId);
    if (state.board?.id && state.board.id !== boardId) invalidatePostCache(state.board.id, postId);
    invalidateListCache(boardId);
    return result;
  }

  async function deletePost(boardId, postId) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}`, { method: 'DELETE' });
    invalidatePostCache(boardId, postId);
    invalidateListCache(boardId);
    return result;
  }

  async function replyPost(boardId, postId, payload) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/reply`, { method: 'POST', body: JSON.stringify(payload) });
    invalidateListCache(boardId);
    return result;
  }

  async function recommendPost(boardId, postId) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/recommend`, { method: 'POST' });
    invalidatePostCache(boardId, postId);
    return result;
  }

  async function loadAttachments(...args) { return (await getAttachmentService()).loadAttachments(...args); }
  async function uploadAttachment(...args) { return (await getAttachmentService()).uploadAttachment(...args); }
  async function downloadAttachment(...args) { return (await getAttachmentService()).downloadAttachment(...args); }

  /**
   * [LOG: 20260426_2310] 캐시 강제 무효화 메서드 노출
   */
  function clearCache() {
    listCacheGeneration += 1;
    listCache.clear();
    postCache.clear();
  }

  return {
    createPost,
    deletePost,
    downloadAttachment,
    loadPost,
    loadAttachments,
    loadPosts,
    recommendPost,
    replyPost,
    updatePost,
    uploadAttachment,
    clearCache,
    invalidateListCache
  };
}
