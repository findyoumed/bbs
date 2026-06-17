const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

async function test() {
  console.log('--- Diagnosing listNewsTopics ---');
  const rootDir = path.resolve(__dirname, '..');
  const cacheStore = createRssCacheStoreFromEnv(process.env);
  
  const service = new RssNewsService({
    newsMenuPath: path.join(rootDir, 'legacy', 'news.mnu'),
    cacheStore
  });

  console.time('Total');
  
  console.time('loadMenu');
  const menu = await service._loadMenu('news', service.newsMenuPath, require('../src/server/RssServiceXmlParsers').parseNewsMenuXml);
  console.timeEnd('loadMenu');

  console.time('buildNewsTopics');
  const topics = service._buildNewsTopics(menu);
  console.timeEnd('buildNewsTopics');

  console.time('scheduleTopicFeedWarm');
  service._scheduleTopicFeedWarm(topics);
  console.timeEnd('scheduleTopicFeedWarm');

  console.timeEnd('Total');
}

test().catch(console.error);
