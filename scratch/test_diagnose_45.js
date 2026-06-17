'use strict';

const path = require('path');
const rootDir = path.join(__dirname, '..');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

loadEnvFile(path.join(rootDir, '.env'), process.env);

const RssNewsService = require('../src/server/RssNewsService');

async function run() {
  const logger = console;
  const cacheStore = createRssCacheStoreFromEnv(process.env);

  // [LOG: 20260617_0945] Mute debug logs during diagnostic verification
  const newsService = new RssNewsService({
    logger: { log: () => {}, info: () => {}, warn: console.warn, error: console.error },
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch // global fetch
  });

  // 1페이지부터 5페이지까지 훑으며 '코스피'가 제목에 포함된 기사를 탐색
  let article = null;
  for (let p = 1; p <= 5; p++) {
    const feed = await newsService.getNewsTopicFeed('1', p);
    article = feed.items.find(item => item.title.includes('코스피') && item.title.includes('숨고르기'));
    if (article) {
      console.log(`Found article in Page ${p}`);
      break;
    }
  }

  if (!article) {
    console.log('Article containing "코스피" and "숨고르기" not found in pages 1-5');
    return;
  }

  console.log('Found Article:', article.title, 'No:', article.no);

  console.log('\n--- CALLING getNewsArticle ---');
  try {
    const result = await newsService.getNewsArticle('1', article.no, {
      key: newsService._buildNewsArticleKey(article),
      link: article.link
    });
    console.log('Success! Result metadata:');
    console.log('detailFetched:', result.article.detailFetched);
    console.log('Body Length:', result.article.body ? result.article.body.length : 0);
    console.log('Body Content:\n', result.article.body);
  } catch (err) {
    console.error('Failed to getNewsArticle:', err);
  }
}

run().catch(console.error);
