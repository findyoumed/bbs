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
  loadPost,
  generation
}) {
  const runIdle = (task) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 1500 });
    } else {
      setTimeout(task, 100);
    }
  };

  // [LOG_ID: 20260805_1412] 상위 3개 게시글 본문 스마트 사전 로드 (글 클릭 시 0초 렌더링)
  if (Array.isArray(data.items) && data.items.length > 0 && typeof loadPost === 'function') {
    const topItems = data.items.slice(0, 3);
    runIdle(() => {
      for (const item of topItems) {
        const pId = item.localId ?? item.id;
        if (pId) {
          loadPost(boardId, pId, '', searchParams).catch(() => null);
        }
      }
    });
  }

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
    runIdle(start);
  });
  pendingPrefetches.set(cacheKey, prefetchPromise);
}
