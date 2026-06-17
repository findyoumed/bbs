'use strict';

const path = require('path');
const rootDir = path.join(__dirname, '..');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

loadEnvFile(path.join(rootDir, '.env'), process.env);

const RssNewsService = require('../src/server/RssNewsService');

async function run() {
  const cacheStore = createRssCacheStoreFromEnv(process.env);
  const newsService = new RssNewsService({
    logger: console,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch
  });

  const topicDoor = '1';
  const articleNo = '45';
  const requestedKey = '77cdfe7d3025b686e402a9360d31b7676e6aa26a';

  // 0. Inspect Cache
  const cacheKey = `news:article:v28:${requestedKey}`;
  const storeKey = `rss:feed:${cacheKey}`;
  console.log(`--- Fetching Cache Entry for ${storeKey} ---`);
  try {
    const entry = await cacheStore.get(storeKey);
    console.log('Cache Entry:', entry);
  } catch (err) {
    console.error('Cache retrieve failed:', err);
  }

  // 1. Get the topic feed to resolve the article
  console.log(`--- Fetching topic feed ${topicDoor} ---`);
  const feed = await newsService.getNewsTopicFeed(topicDoor);
  const resolved = feed.items.find(item => String(item.no) === articleNo);
  
  if (resolved) {
    console.log('Resolved article from feed:', resolved);
    console.log('Built Key from feed item:', newsService._buildNewsArticleKey(resolved));
  } else {
    console.log(`Article No ${articleNo} not found in the first page of feed.`);
  }

  // 2. Fetch the article details
  console.log('\n--- Fetching News Article Detail (Direct Link) ---');
  try {
    const result = await newsService.getNewsArticle(topicDoor, articleNo, {
      key: requestedKey,
      link: 'https://www.yna.co.kr/view/AKR20260617122100009'
    });

    console.log('\n=== RESULT ===');
    console.log('title:', result.article.title);
    console.log('link:', result.article.link);
    console.log('detailFetched:', result.article.detailFetched);
    console.log('body (Length:', result.article.body ? result.article.body.length : 0, '):');
    console.log(result.article.body);
  } catch (err) {
    console.error('Failed to get news article:', err);
  }
}

run().catch(console.error);
