export function createPostService(deps) {
  const { apiFetch, state } = deps;

  // [LOG: 20260426_2300] 캐시 저장소 (목록 캐시는 boardId_page_search 형식, 본문 캐시는 boardId_postId 형식)
  const listCache = new Map();
  const postCache = new Map();

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
    };
  }

  function normalizePostViewResponse(data) {
    return data?.post ? { board: data.board || null, post: data.post } : { board: null, post: data || null };
  }

  // 관련 게시판의 모든 목록 캐시 삭제
  function invalidateListCache(boardId) {
    const keyPrefix = `${boardId}_`;
    for (const key of listCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        listCache.delete(key);
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
    if (searchParams.recent) key += `_recent_${searchParams.recent}`;
    return key;
  }

  async function loadPosts(boardId, page = 1, searchParams = {}) {
    const cacheKey = buildListCacheKey(boardId, page, searchParams);
    if (listCache.has(cacheKey)) {
      const cached = listCache.get(cacheKey);
      state.posts = applySortOrder(cached.items);
      state.totalCount = cached.totalCount;
      state.totalPages = cached.totalPages;
      state.page = cached.page;
      return cached;
    }

    let url = `/api/boards/${encodeURIComponent(boardId)}?page=${page}&pageSize=15`;
    if (searchParams.lt) url += `&lt=${encodeURIComponent(searchParams.lt)}`;
    if (searchParams.li) url += `&li=${encodeURIComponent(searchParams.li)}`;
    if (searchParams.lc) url += `&lc=${encodeURIComponent(searchParams.lc)}`;
    if (searchParams.recent) url += `&recent=${encodeURIComponent(searchParams.recent)}`;

    const data = normalizePostListResponse(await apiFetch(url), page);
    
    // 결과 캐싱
    listCache.set(cacheKey, data);
    
    state.posts = applySortOrder(data.items);
    state.totalCount = data.totalCount;
    state.totalPages = data.totalPages;
    state.page = data.page;
    return data;
  }

  async function loadPost(boardId, postId) {
    const cacheKey = `${boardId}_${postId}`;
    if (postCache.has(cacheKey)) {
      return postCache.get(cacheKey);
    }

    const data = normalizePostViewResponse(await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}?view=1`));
    
    // 결과 캐싱
    postCache.set(cacheKey, data);
    
    return data;
  }

  async function createPost(boardId, payload) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts`, { method: 'POST', body: JSON.stringify(payload) });
    invalidateListCache(boardId); // 새 글 작성 시 목록 캐시 무효화
    return result;
  }

  async function updatePost(boardId, postId, payload) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    postCache.delete(`${boardId}_${postId}`);
    if (state.board?.id) postCache.delete(`${state.board.id}_${postId}`);
    invalidateListCache(boardId);
    return result;
  }

  async function deletePost(boardId, postId) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}`, { method: 'DELETE' });
    postCache.delete(`${boardId}_${postId}`);
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
    postCache.delete(`${boardId}_${postId}`); // 추천수 업데이트를 위해 캐시 삭제
    return result;
  }

  async function loadAttachments(boardId, postId) {
    const result = await apiFetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/attachments`);
    return Array.isArray(result) ? result : [];
  }

  function pickAttachmentDownloadName(fileName, contentDisposition) {
    const preferredName = String(fileName || '').trim();
    if (preferredName) {
      return preferredName;
    }

    const headerValue = String(contentDisposition || '');
    const encodedMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1]);
      } catch (error) {
        console.error('첨부 파일명 decode 실패:', error.message);
      }
    }

    const quotedMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
    if (quotedMatch?.[1]) {
      return quotedMatch[1].trim();
    }

    return 'attachment.bin';
  }

  async function downloadAttachment(boardId, postId, attachmentId, fileName = '') {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/posts/${postId}/attachments/${attachmentId}/download`, {
      method: 'GET',
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {}
    });

    if (!response.ok) {
      const rawText = await response.text();
      let message = `첨부 파일 다운로드 실패 (${response.status})`;
      if (rawText) {
        try {
          const payload = JSON.parse(rawText);
          message = String(payload?.message || payload?.error?.message || message);
        } catch (error) {
          message = rawText.trim() || message;
        }
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = pickAttachmentDownloadName(fileName, response.headers.get('content-disposition'));
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  }

  /**
   * [LOG: 20260426_2310] 캐시 강제 무효화 메서드 노출
   */
  function clearCache() {
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
    clearCache,
    invalidateListCache
  };
}
