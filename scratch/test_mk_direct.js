'use strict';

const path = require('path');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');
loadEnvFile(path.join(__dirname, '../.env'), process.env);
const RssNewsService = require('../src/server/RssNewsService');

async function test() {
  const cacheStore = createRssCacheStoreFromEnv(process.env);
  const newsService = new RssNewsService({
    logger: console,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch
  });

  const link = 'https://www.mk.co.kr/news/stock/12077080';
  const key = newsService._buildNewsArticleKey({ link });

  // Clear cache to ensure fresh crawling
  const hash = newsService._hashUrl(link);
  const cacheKey = `news:article:v28:${hash}`;
  const storeKey = `rss:feed:${cacheKey}`;
  await cacheStore.delete(storeKey);

  console.log('Fetching directly...');
  try {
    const detail = await newsService._fetchNewsArticleDetail(link);
    console.log('Crawler detail returned:', {
      unavailable: detail?.unavailable,
      title: detail?.title,
      bodyLength: detail?.body?.length,
      body: detail?.body
    });
    
    const result = await newsService.getNewsArticle('1', '9999', { key, link });
    console.log('\n--- FETCH RESULT ---');
    console.log('DetailFetched:', result.article.detailFetched);
    console.log('Title:', result.article.title);
    console.log('Body:', result.article.body);
  } catch (err) {
    console.error('Error occurred:', err);
  }
}

test().catch(console.error);
