import { createRoutingUrlBuilder } from './routingUrlBuilder.js';

export function createRoutingModule(deps) {
  const { state, statusManager } = deps;

  const {
    buildURLForState,
    isUnifiedPdsBoardId,
    showUnifiedPdsList,
    showUnifiedPdsPost
  } = createRoutingUrlBuilder(deps);

  // [LOG_ID: 20260805_1435] 루트 첫 화면은 URL 복원기가 필요하지 않으므로
  // deep link/뒤로가기에서 처음 호출될 때만 큰 라우팅 테이블을 로드한다.
  let restorerPromise = null;
  async function restoreStateFromURL(...args) {
    if (!restorerPromise) {
      restorerPromise = import('./routingStateRestorer.js')
        .then(({ createRoutingStateRestorer }) => createRoutingStateRestorer({
          ...deps,
          isUnifiedPdsBoardId,
          showUnifiedPdsList,
          showUnifiedPdsPost
        }))
        .catch((error) => {
          restorerPromise = null;
          throw error;
        });
    }
    const restorer = await restorerPromise;
    return restorer.restoreStateFromURL(...args);
  }

  async function updateURL(replace = false) {
    const newURL = buildURLForState();
    const currentFull = window.location.pathname + window.location.search;

    if (replace) {
      window.history.replaceState({ screen: state.screen }, '', newURL);
    } else if (currentFull !== newURL) {
      window.history.pushState({ screen: state.screen }, '', newURL);
    }

    if (statusManager) {
      statusManager.update();
    }
  }

  return {
    updateURL,
    restoreStateFromURL
  };
}
