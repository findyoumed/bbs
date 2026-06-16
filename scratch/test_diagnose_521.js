'use strict';
const path = require('path');
const { createAppServices, loadEnvFile } = require('../src/server/createAppServices');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const env = {};
  loadEnvFile(path.join(rootDir, '.env'), env);
  
  // Merge keys to process.env
  Object.assign(process.env, env);

  const services = createAppServices(rootDir, process.env);
  const service = services.rssService;

  try {
    const article = await service.getNewsArticle('1', '521', {
      key: '3654bd5d4374f45256b0294e014b9aaa75b08bf5'
    });
    console.log('=== ARTICLE RESULT ===');
    console.log('Title:', article.title);
    console.log('Source:', article.source);
    console.log('Author:', article.author);
    console.log('Date:', article.date);
    console.log('Link:', article.link);
    console.log('ImageUrl:', article.imageUrl);
    console.log('Content Body (Length:', article.body ? article.body.length : 0, '):');
    console.log('-------------------------');
    console.log(article.body);
    console.log('-------------------------');
  } catch (error) {
    console.error('Error fetching article 521:', error);
  } finally {
    if (services.registry) {
      await services.registry.closeAll();
    }
  }
}

main();
