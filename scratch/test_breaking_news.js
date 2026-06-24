const path = require('path');
const RssNewsService = require('../src/server/RssNewsService');

async function test() {
  const svc = new RssNewsService({ 
    fetchImpl: fetch,
    newsMenuPath: path.resolve(__dirname, '../legacy/news.mnu')
  });
  try {
    const feed = await svc.getNewsTopicFeed('2'); // SBS
    console.log('Feed items:', feed.items.map(i => `${i.no}: ${i.title}`));
    
    // Find item with "송옥주"
    const target = feed.items.find(i => i.title.includes('송옥주'));
    if (!target) {
      console.log('송옥주 article not found in feed');
      return;
    }
    
    console.log('Fetching detail for:', target.no);
    const detail = await svc.getNewsArticle('2', target.no, { link: target.link });
    console.log('Result:', JSON.stringify(detail, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
