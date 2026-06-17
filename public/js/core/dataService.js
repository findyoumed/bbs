export function createDataService(deps) {
  const { apiFetch, state } = deps;

  async function loadStats() {
    state.stats = (await apiFetch('/api/system/stats')) || {};
  }

  async function loadWeatherRegions() {
    return await apiFetch('/api/services/weather');
  }

  async function loadWeatherFeed(regionId) {
    return await apiFetch(`/api/services/weather/${encodeURIComponent(regionId)}`);
  }

  async function loadLocalWeather() {
    return await apiFetch('/api/services/weather/local');
  }

  async function loadNewsMenu() {
    return await apiFetch('/api/services/news');
  }

  async function loadNewsArticles(topicId, pageNo = 1) {
    // [LOG: 20260616_0937] Pass page query parameter to optimize news loading speed
    return await apiFetch(`/api/services/news/${encodeURIComponent(topicId)}?page=${encodeURIComponent(pageNo)}`);
  }

  async function loadNewsArticle(topicId, articleNo, options = {}) {
    const articleKey = String(options?.articleKey || options?.key || '').trim();
    const link = String(options?.link || '').trim();

    // [LOG: 20260617_2158] Send key and link via headers to keep the API URL clean and concise
    const headers = {};
    if (articleKey) headers['X-Article-Key'] = articleKey;
    if (link) headers['X-Article-Link'] = encodeURIComponent(link);

    return await apiFetch(`/api/services/news/${encodeURIComponent(topicId)}/${encodeURIComponent(articleNo)}`, {
      headers
    });
  }

  return { loadLocalWeather, loadNewsArticle, loadNewsArticles, loadNewsMenu, loadStats, loadWeatherFeed, loadWeatherRegions };
}
