const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');

async function checkArticlesContent() {
  const svc = new RssNewsService({ 
    fetchImpl: fetch,
    newsMenuPath: path.resolve(__dirname, '../legacy/news.mnu')
  });
  
  try {
    const door = '2'; // Topic 2
    console.log(`\n--- Fetching Topic Door: ${door} ---`);
    const feed = await svc.getNewsTopicFeed(door);
    console.log(`Found ${feed.items.length} articles`);
    
    for (let i = 0; i < Math.min(feed.items.length, 5); i++) {
      const item = feed.items[i];
      const detail = await svc.getNewsArticle(door, item.no, { link: item.link, key: item.articleKey });
      
      console.log(`\n[Article ${item.no}] ${item.title}`);
      console.log(`- Body Length: ${detail.article.body.length} chars`);
      console.log(`- Preview: ${detail.article.body.slice(0, 150).replace(/\n/g, ' ')}...`);
      if (detail.article.body.length < 50) {
        console.warn('  ⚠️ WARNING: Very short body!');
      }
      if (/[.…]{2,}$/.test(detail.article.body.trim())) {
         console.warn('  ⚠️ WARNING: Ends with ellipsis (truncated)');
      }
    }
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

checkArticlesContent();
