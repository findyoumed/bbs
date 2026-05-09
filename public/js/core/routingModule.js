import { createRoutingStateRestorer } from './routingStateRestorer.js';
import { createRoutingUrlBuilder } from './routingUrlBuilder.js';

export function createRoutingModule(deps) {
  const { state, statusManager } = deps;

  const {
    buildURLForState,
    isUnifiedPdsBoardId,
    showUnifiedPdsList,
    showUnifiedPdsPost
  } = createRoutingUrlBuilder(deps);

  const { restoreStateFromURL } = createRoutingStateRestorer({
    ...deps,
    isUnifiedPdsBoardId,
    showUnifiedPdsList,
    showUnifiedPdsPost
  });

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
