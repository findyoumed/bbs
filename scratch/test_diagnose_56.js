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

  const newsService = new RssNewsService({
    logger,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu')
  });

  const key = '302dc86acce9d391413453ac7eed727046b55ce7';
  const cacheKey = `rss:feed:news:article:v27:${key}`;

  console.log('--- DIAGNOSING ARTICLE KEY:', key, '---');
  
  // 1. Fetch persistent cache entry
  try {
    const entry = await cacheStore.get(cacheKey);
    console.log('\n[1] Persistent Cache Entry:');
    if (entry) {
      console.log('Exists:', true);
      console.log('Title:', entry.title);
      console.log('Link:', entry.link);
      console.log('Unavailable:', entry.unavailable);
      console.log('Body Length:', entry.body ? entry.body.length : 0);
      console.log('Body Snapshot:', entry.body ? entry.body.substring(0, 200) + '...' : 'none');
      console.log('Raw Entry Keys:', Object.keys(entry));
    } else {
      console.log('Exists: false (Not found in Supabase Cache)');
    }
  } catch (err) {
    console.error('Failed to query cache:', err.message);
  }

  // 2. Fetch via RSS Feed items to see if it exists in current feed
  try {
    const feed = await newsService.getNewsTopicFeed('1'); // 1 = 주요 뉴스 or 토픽 1
    const item = feed.items.find(i => newsService._buildNewsArticleKey(i) === key);
    console.log('\n[2] Feed Item matching key:');
    if (item) {
      console.log('Found in feed!');
      console.log('Title:', item.title);
      console.log('Link:', item.link);
      console.log('No:', item.no);
    } else {
      console.log('Not found in current feed items.');
    }
  } catch (err) {
    console.error('Failed to get feed:', err.message);
  }

  // 3. Resolve the Google News URL and crawl details
  const testUrl = 'https://news.google.com/rss/articles/CBMisQFVX31xTFBfcWZncE5VQTJSdDdzZlVExMDh1QmhfUU9DX31fQmJWUXJMWViycXgteW1IbUNSY2JaenBtWnVT3Z2bVJtYTNrQnJiS2piMTkxZ2pZYTZqVVgyNVZaemM1YlYxYlZxeTlRd1NnMHJWSF93MHBDWS16MnJMdDZnMmItNVk0WDA?oc=5';
  console.log('\n[3] Resolving Google News URL:', testUrl);
  try {
    const { resolveGoogleNewsSourceUrl } = require('../src/server/GoogleNewsUrlResolver');
    const resolvedUrl = await resolveGoogleNewsSourceUrl(testUrl, fetch);
    console.log('Resolved Target URL:', resolvedUrl);

    console.log('\n[4] Attempting to crawl target URL...');
    if (resolvedUrl) {
      const result = await newsService._fetchNewsArticleDetail(resolvedUrl);
      console.log('Crawl Result:');
      console.log('Success / Valid Body:', !!(result && result.body && result.body.length >= 80));
      console.log('Title:', result?.title);
      console.log('Body Length:', result?.body?.length || 0);
      console.log('Body Snapshot:', result?.body ? result.body.substring(0, 300) + '...' : 'none');
    } else {
      console.log('Cannot crawl: Resolved URL is empty.');
    }
  } catch (err) {
    console.error('Failed to resolve or crawl:', err);
  }
}

run().catch(console.error);
