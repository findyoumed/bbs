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

  async function loadNewsArticles(topicId) {
    return await apiFetch(`/api/services/news/${encodeURIComponent(topicId)}`);
  }

  async function loadNewsArticle(topicId, articleNo, options = {}) {
    const query = new URLSearchParams();
    const articleKey = String(options?.articleKey || options?.key || '').trim();
    const link = String(options?.link || '').trim();
    if (articleKey) query.set('key', articleKey);
    if (link) query.set('link', link);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return await apiFetch(`/api/services/news/${encodeURIComponent(topicId)}/${encodeURIComponent(articleNo)}${suffix}`);
  }

  return { loadLocalWeather, loadNewsArticle, loadNewsArticles, loadNewsMenu, loadStats, loadWeatherFeed, loadWeatherRegions };
}
