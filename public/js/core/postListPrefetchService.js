// [LOG_ID: 20260805_0152] Next-page prefetching is optional startup work, so
// keep its scheduler out of the initial module graph until a board list loads.
const pendingPrefetches = new Map();

export function scheduleNextPagePrefetch({
  boardId,
  data,
  searchParams,
  listCache,
  buildListCacheKey,
  fetchPostsPage,
  generation
}) {
  const currentPage = Number(data.page || 1);
  const totalPages = Number(data.totalPages || 1);
  if (currentPage >= totalPages) return;

  const nextPage = currentPage + 1;
  const cacheKey = buildListCacheKey(boardId, nextPage, searchParams);
  if (listCache.has(cacheKey) || pendingPrefetches.has(cacheKey)) return;

  const run = () => fetchPostsPage(boardId, nextPage, searchParams, generation)
    .catch(() => null)
    .finally(() => pendingPrefetches.delete(cacheKey));
  const prefetchPromise = new Promise((resolve) => {
    const start = () => run().then(resolve, resolve);
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(start, { timeout: 1000 });
    } else if (typeof queueMicrotask === 'function') {
      queueMicrotask(start);
    } else {
      Promise.resolve().then(start);
    }
  });
  pendingPrefetches.set(cacheKey, prefetchPromise);
}
