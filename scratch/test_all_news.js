const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');

async function testAll() {
  const svc = new RssNewsService({ 
    fetchImpl: fetch,
    newsMenuPath: path.resolve(__dirname, '../legacy/news.mnu')
  });
  
  try {
    let totalTested = 0;
    let failed = 0;

    // Test a few topics (e.g. SBS, Google News, etc)
    const testDoors = ['2', '1', '10', '15']; 
    
    for (const door of testDoors) {
      console.log(`\n--- Testing Topic Door: ${door} ---`);
      const feed = await svc.getNewsTopicFeed(door);
      console.log(`Found ${feed.items.length} articles`);
      
      for (const item of feed.items.slice(0, 10)) { // test first 10
        try {
          const detail = await svc.getNewsArticle(door, item.no, { link: item.link, key: item.articleKey });
          totalTested++;
          if (!detail.available) {
            console.error(`❌ Article ${item.no} unavailable: ${item.title}`);
            failed++;
          } else {
            console.log(`✅ Article ${item.no} OK (Body length: ${detail.article.body.length})`);
          }
        } catch (err) {
            console.error(`❌ Error fetching ${item.no} (${item.title}):`, err.message);
            failed++;
        }
      }
    }
    console.log(`\n=== Summary ===\nTotal Tested: ${totalTested}\nFailed: ${failed}`);
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

testAll();
