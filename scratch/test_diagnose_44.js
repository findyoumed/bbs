'use strict';

const path = require('path');
const rootDir = path.join(__dirname, '..');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

loadEnvFile(path.join(rootDir, '.env'), process.env);

const RssNewsService = require('../src/server/RssNewsService');
const { isLikelyNoisyBody } = require('../src/server/RssNewsArticleSanitizer');
const { scoreArticleText } = require('../src/server/RssNewsArticleParserScoring');

async function run() {
  const cacheStore = createRssCacheStoreFromEnv(process.env);
  const newsService = new RssNewsService({
    logger: console,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu'),
    fetchImpl: fetch
  });

  const articleLink = 'https://www.yna.co.kr/view/AKR20260617153100004';
  
  console.log('--- Fetching Raw Detail ---');
  const detail = await newsService._fetchNewsArticleDetail(articleLink);
  console.log('detail object:', {
    title: detail.title,
    bodyLength: detail.body ? detail.body.length : 0,
    unavailable: detail.unavailable,
    descriptionLength: detail.description ? detail.description.length : 0
  });

  console.log('\n--- Raw Body Preview ---');
  console.log(detail.body);

  const detailBody = newsService._sanitizeArticleText(detail.body, detail.title);
  console.log('\n--- Sanitized Body Preview (Length:', detailBody.length, ') ---');
  console.log(detailBody);

  const score = scoreArticleText(detailBody, 'body');
  const hasPenaltyWords = /(기사\s*읽기|기사를\s*재생\s*중이에요|왼쪽으로|오른쪽으로|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가|본문으로\s*바로가기|전체메뉴)/.test(detailBody);
  const isNoisy = isLikelyNoisyBody(detailBody);
  const trimmed = detailBody.trim();
  const isTruncated = /[.]{2,}$|[…,\-:/]$/.test(trimmed) || /[며고나면지를을은는이가와과의로]$/.test(trimmed.slice(-1));

  console.log('\n--- Validation Stats ---');
  console.log({
    score,
    hasPenaltyWords,
    isNoisy,
    isTruncated,
    endsWith: trimmed.slice(-1)
  });
}

run().catch(console.error);
