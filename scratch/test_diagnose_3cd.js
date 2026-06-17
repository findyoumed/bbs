'use strict';

const path = require('path');
const rootDir = path.join(__dirname, '..');
const { loadEnvFile } = require('../src/server/createAppServices');
const { createRssCacheStoreFromEnv } = require('../src/server/RssCacheStore');

loadEnvFile(path.join(rootDir, '.env'), process.env);

const RssNewsService = require('../src/server/RssNewsService');
const Sanitizer = require('../src/server/RssNewsArticleSanitizer');

async function run() {
  const logger = console;
  const cacheStore = createRssCacheStoreFromEnv(process.env);

  const newsService = new RssNewsService({
    logger,
    cacheStore,
    newsMenuPath: path.join(__dirname, '../legacy/news.mnu')
  });

  const key = '3cd43e17ba6fbed1340d6dbf164148432184227e';
  const cacheKey = `rss:feed:news:article:v27:${key}`;

  console.log('--- DIAGNOSING ARTICLE KEY:', key, '---');
  
  try {
    const entry = await cacheStore.get(cacheKey);
    if (entry) {
      console.log('Exists in cache: true');
      console.log('Title:', entry.title);
      console.log('Link:', entry.link);
      console.log('Unavailable:', entry.unavailable);
      console.log('Body Length:', entry.body ? entry.body.length : 0);
      console.log('--- Raw Body in Cache ---\n', entry.body);
      
      console.log('\n--- Re-running Sanitizer on Raw Cache Body ---');
      const sanitized = testSanitizeArticleText(entry.body, entry.title);
      console.log('Sanitized Length:', sanitized.length);
      console.log('--- Sanitized Body ---\n', sanitized);
    } else {
      console.log('Exists in cache: false');
    }
  } catch (err) {
    console.error('Failed to query cache:', err.message);
  }
}

function testSanitizeArticleText(value, title) {
  let text = String(value || '').trim();
  const lines = text.split('\n');
  const filtered = [];
  
  const boilerplatePatterns = [
    /^(이전|다음)\s*기사보기$/i,
    /^기사\s*스크랩(?:하기)?$/i,
    /^다른\s*공유\s*찾기$/i,
    /^본문\s*글씨\s*(키우기|줄이기)$/i,
    /^스크롤\s*이동\s*상태바$/i,
    /^[^\n]{1,30}기자$/i,
    /^저작권자\s*(?:[ⓒ©]|&copy;).*$/i
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    let normalizedLine = String(line || '').replace(/\s+/g, ' ').trim();
    if (!normalizedLine) continue;

    let skip = false;
    for (const pattern of boilerplatePatterns) {
      if (pattern.test(normalizedLine)) {
        console.log(`[MOCK FILTER] Skipped boilerplate line: "${normalizedLine}" due to pattern: ${pattern}`);
        skip = true;
        break;
      }
    }
    if (!skip) {
      filtered.push(normalizedLine);
    }
  }

  // Title deduplication check
  if (title && filtered.length > 0) {
    let coreTitle = String(title).split(/\s+[-|]\s+/)[0].trim();
    if (coreTitle) {
      const cleanCore = coreTitle.replace(/\s+/g, '').toLowerCase();
      const firstLineClean = filtered[0].replace(/\s+/g, '').toLowerCase();
      if (firstLineClean === cleanCore || (firstLineClean.length >= 10 && (cleanCore.includes(firstLineClean) || firstLineClean.includes(cleanCore)))) {
        console.log(`[MOCK FILTER] Skipped duplicate title line: "${filtered[0]}" (Matched title: "${coreTitle}")`);
        filtered.shift();
      }
    }
  }

  return filtered.join('\n');
}

run().catch(console.error);
