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
  generation,
  getCurrentGeneration
}) {
  const runIdle = (task) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 1500 });
    } else {
      setTimeout(task, 100);
    }
  };

  // [LOG_ID: 20260806_1025] 상위 3개 게시글 본문 백그라운드 무소음 사전 로드 (삭제/미존재 글 404 에러 로그 억제)
  if (Array.isArray(data.items) && data.items.length > 0 && typeof loadPost === 'function') {
    const topItems = data.items.slice(0, 3);
    runIdle(() => {
      if (typeof getCurrentGeneration === 'function' && getCurrentGeneration() !== generation) {
        return;
      }
      for (const item of topItems) {
        const pId = item.localId ?? item.id;
        if (pId) {
          loadPost(boardId, pId, '', searchParams, { silent: true, throwOnError: false }).catch(() => null);
        }
      }
    });
  }

  const currentPage = Number(data.page || 1);
  const totalPages = Number(data.totalPages || 1);
  if (currentPage >= totalPages) return;

  const nextPage = currentPage + 1;
  const cacheKey = buildListCacheKey(boardId, nextPage, searchParams);
  // fetchPostsPage owns TTL/LRU validation. Map.has() would treat an expired
  // entry as fresh and suppress the prefetch.
  if (pendingPrefetches.has(cacheKey)) return;

  const run = () => {
    if (typeof getCurrentGeneration === 'function' && getCurrentGeneration() !== generation) {
      // A board/search change cancels this idle task. Always release the key;
      // otherwise a later visit to the same page is treated as permanently
      // in-flight and never gets prefetched again.
      return Promise.resolve(null).finally(() => pendingPrefetches.delete(cacheKey));
    }
    return fetchPostsPage(boardId, nextPage, searchParams, generation)
      .catch(() => null)
      .finally(() => pendingPrefetches.delete(cacheKey));
  };
  const prefetchPromise = new Promise((resolve) => {
    const start = () => run().then(resolve, resolve);
    runIdle(start);
  });
  pendingPrefetches.set(cacheKey, prefetchPromise);
}
