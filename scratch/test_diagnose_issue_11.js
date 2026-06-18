'use strict';

const path = require('path');
const rootDir = path.join(__dirname, '..');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

loadEnvFile(path.join(rootDir, '.env'), process.env);

const RssNewsService = require('../src/server/RssNewsService');
const { sanitizeArticleText, isLikelyNoisyBody } = require('../src/server/RssNewsArticleSanitizer');
const { scoreArticleText } = require('../src/server/RssNewsArticleParserScoring');

async function run() {
  const cacheStore = createRssCacheStoreFromEnv(process.env);

  const newsService = new RssNewsService({
    logger: console,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch
  });

  const feed = await newsService.getNewsTopicFeed('1', 1);
  const article = feed.items.find(item => item.no === 11 || item.title.includes('코스피'));
  
  if (!article) {
    console.log('Article 11 not found.');
    return;
  }

  console.log('--- ARTICLE METADATA FROM FEED ---');
  console.log('Title:', article.title);
  console.log('Link:', article.link);
  console.log('Description:', article.description);
  console.log('Body:', article.body);

  console.log('\n--- FETCHING RAW ARTICLE DETAIL ---');
  const detail = await newsService._fetchNewsArticleDetail(article.link);
  console.log('Unavailable:', detail?.unavailable);
  console.log('Detail Message:', detail?.message);
  console.log('Raw Detail Title:', detail?.title);
  console.log('Raw Detail Description:', detail?.description);
  console.log('Raw Detail Body Length:', detail?.body ? detail.body.length : 0);
  console.log('Raw Detail Body (first 500 chars):\n', detail?.body ? detail.body.substring(0, 500) : 'N/A');

  if (detail?.body) {
    const detailBody = sanitizeArticleText(detail.body, article.title || detail.title);
    const score = scoreArticleText(detailBody, 'body');
    const hasPenaltyWords = /(기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가|본문으로\s*바로가기|전체메뉴)/.test(detailBody);
    const isNoisy = isLikelyNoisyBody(detailBody);
    console.log('\n--- SANITIZED DETAIL BODY CHECK ---');
    console.log('detailBody Length:', detailBody.length);
    console.log('detailBody Score:', score);
    console.log('hasPenaltyWords:', hasPenaltyWords);
    console.log('isNoisy:', isNoisy);
    console.log('detailBody (first 500 chars):\n', detailBody.substring(0, 500));
  }
}

run().catch(console.error);
