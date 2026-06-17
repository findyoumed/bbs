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
    // [LOG: 20260617_0945] Mute logs to clean diagnostic output
    logger: { log: () => {}, info: () => {}, warn: () => {}, error: console.error },
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch // global fetch
  });

  // 9페이지 기사 목록을 불러온다
  const feed = await newsService.getNewsTopicFeed('1', 9);
  console.log('Total items in page 9:', feed.items.length);
  
  // 125번 기사 찾기
  const targetNo = '125';
  const article = feed.items.find(item => String(item.no) === targetNo);
  if (!article) {
    console.log(`Article ${targetNo} not found in page 9. List of items in page 9:`);
    feed.items.forEach(item => {
      console.log(`[No ${item.no}] Title: ${item.title}`);
    });
    return;
  }

  console.log('\nFound target article in Page 9:');
  console.log('No:', article.no);
  console.log('Title:', article.title);
  console.log('Link:', article.link);
  console.log('Key:', newsService._buildNewsArticleKey(article));

  // getNewsArticle 호출
  console.log('\n--- CALLING getNewsArticle(topicDoor=1, articleNo=125) ---');
  const result = await newsService.getNewsArticle('1', article.no, {
    key: newsService._buildNewsArticleKey(article),
    link: article.link
  });

  console.log('\nResult returned by getNewsArticle:');
  console.log('No:', result.article.no);
  console.log('Title:', result.article.title);
  console.log('Link:', result.article.link);
  console.log('Body length:', result.article.body ? result.article.body.length : 0);
  console.log('Body Preview:\n', result.article.body ? result.article.body.substring(0, 300) : 'None');
}

run().catch(console.error);
