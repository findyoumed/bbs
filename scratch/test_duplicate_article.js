'use strict';

const path = require('path');
const fs = require('fs');
const RssNewsService = require('../src/server/RssNewsService');
const projectPaths = require('../src/server/projectPaths');

async function run() {
  const rootDir = path.join(__dirname, '..');
  const { loadEnvFile, createAppServices } = require('../src/server/createAppServices');
  const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');
  
  loadEnvFile(path.join(rootDir, '.env'), process.env);
  
  const legacyPaths = projectPaths.resolveLegacyPaths(process.env, rootDir);
  const cacheStore = createRssCacheStoreFromEnv(process.env);

  const service = new RssNewsService({
    newsMenuPath: legacyPaths.newsMenuPath,
    fetchImpl: fetch,
    cacheStore
  });

  console.log('--- Testing getNewsTopicFeed ---');
  const feed = await service.getNewsTopicFeed('1');
  console.log(`Feed item count: ${feed.items?.length}`);

  // Write feed to a file for analysis
  fs.writeFileSync('scratch/feed_analysis.json', JSON.stringify(feed, null, 2), 'utf-8');
  console.log('Feed saved to scratch/feed_analysis.json');

  console.log('--- Testing getNewsArticle (26 with correct key vs SBS key) ---');
  
  // 1. article 26 with correct key (from feed)
  const item26 = feed.items.find(item => item.no === 26);
  if (item26) {
    console.log(`Found item 26 in feed: ${item26.title} (Key: ${item26.articleKey}, Source: ${item26.sourceTitle})`);
  }

  // 2. Fetch using incorrect key (SBS key '400c98d0101c3e0b933aabe12ccfd3e50475612b')
  const mockSbsKey = '400c98d0101c3e0b933aabe12ccfd3e50475612b';
  const cacheKey = `news:article:v27:${mockSbsKey}`;
  const storeKey = `rss:feed:${cacheKey}`;
  
  console.log('Attempting to write cache to Supabase...');
  try {
    const writeRes = await service._setPersistentCacheEntry(storeKey, {
      title: '[여담야담] 민주 이기헌 "정청래, 사퇴하고 대표 불출마 결단해야 미래"…정청래 "당의 주인은 당원"',
      link: 'https://news.sbs.co.kr/news/endPage.do?news_id=N1008613085&plink=RSSLINK&cooper=RSSREADER',
      description: 'SBS 뉴스 데스크 기사 복사본',
      body: '이것은 SBS 뉴스 기사의 실제 본문입니다. 아주 긴 기사 본문입니다. 최소 80자 이상이어야 복원 조건(body.length >= 80)을 만족할 수 있으므로 이렇게 길게 씁니다. 길게 길게 씁니다. SBS 뉴스 기사의 내용입니다.',
      date: '2026-06-16',
      dateTime: '2026-06-16T16:27:58',
      sourceTitle: 'SBS뉴스'
    }, 10 * 60 * 1000);
    console.log('Cache write method returned:', writeRes);
  } catch (err) {
    console.error('Cache write caught error:', err);
  }

  console.log('Attempting to read cache back from Supabase...');
  try {
    const readRes = await service._getPersistentCacheEntry(storeKey);
    console.log('Cache read method returned (body length):', readRes ? readRes.body?.length : 'null/undefined');
  } catch (err) {
    console.error('Cache read caught error:', err);
  }

  try {
    const res = await service.getNewsArticle('1', '26', {
      key: mockSbsKey
    });
    console.log('Successfully fetched article 26 with SBS key! (THIS IS THE BUG)');
    console.log('Returned Article Title:', res.article.title);
    console.log('Returned Article Source:', res.article.sourceTitle);
    console.log('Returned Article SourceDoor:', res.article.sourceDoor);
    console.log('Returned Article Link:', res.article.link);
    console.log('Returned Article Body:', res.article.body.substring(0, 200));
  } catch (err) {
    console.log('Failed to fetch article 26 with SBS key (expected behavior):', err.message);
  }
}

run().catch(console.error);
