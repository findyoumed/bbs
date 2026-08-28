export const READ_CACHE_TTL_MS = 5 * 60 * 1000;
export const READ_CACHE_MAX_ENTRIES = 120;

export function readTimedCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at >= READ_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, { at: Date.now(), data: entry.data });
  return entry.data;
}

export function writeTimedCache(cache, key, data) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });
  while (cache.size > READ_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function buildPostCacheKey(boardId, postId, virtualBoardId = '', searchParams = {}) {
  let cacheKey = `${boardId}_${postId}`;
  if (virtualBoardId) cacheKey += `_v_${virtualBoardId}`;
  for (const k of ['lt', 'li', 'lc', 'k', 'la', 'recent']) {
    if (searchParams[k]) cacheKey += `_${k}_${searchParams[k]}`;
  }
  return cacheKey;
}

export function normalizePostListResponse(data, fallbackPage) {
  return {
    board: data?.board || null,
    items: Array.isArray(data?.items) ? data.items : (data?.posts || []),
    page: Number(data?.pagination?.page || data?.page || fallbackPage || 1),
    totalCount: Number(data?.pagination?.totalCount || data?.totalCount || 0),
    totalPages: Number(data?.pagination?.pageCount || data?.totalPages || 1),
    degraded: data?.degraded === true,
    degradedReason: String(data?.degradedReason || '')
  };
}

export function normalizePostViewResponse(data) {
  return data?.post ? { board: data.board || null, post: data.post } : { board: null, post: data || null };
}
