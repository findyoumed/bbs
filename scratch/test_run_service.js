'use strict';

const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');
const projectPaths = require('../src/server/projectPaths');

async function run() {
  const rootDir = path.join(__dirname, '..');
  const legacyPaths = projectPaths.resolveLegacyPaths(process.env, rootDir);

  const service = new RssNewsService({
    newsMenuPath: legacyPaths.newsMenuPath,
    fetchImpl: fetch
  });

  const res = await service.getNewsArticle('1', '87', {
    key: 'ad5cae274cc87b5d115ca50e7f534713dd8ecdb2'
  });

  console.log('--- API RESULT ARTICLE ---');
  console.log('Title:', res.article.title);
  console.log('Body Length:', res.article.body.length);
  console.log('Body:');
  console.log(JSON.stringify(res.article.body));
}

run().catch(console.error);
