const path = require('path');
const { createAppServices } = require('../src/server/createAppServices');

const rootDir = path.resolve(__dirname, '..');
const services = createAppServices(rootDir);
const rssService = services.rssService;

async function run() {
  try {
    const topicDoor = "1";
    console.log(`Fetching topic feed ${topicDoor}...`);
    const feed = await rssService.getNewsTopicFeed(topicDoor);
    const items = feed.items || [];
    
    const targetKey = "a791ab0c1386c4ab2af9ef9d38617ca60b75f101";
    const item = items.find(i => i.articleKey === targetKey);
    
    if (!item) {
      console.log(`Could not find item with key ${targetKey} in feed items!`);
      return;
    }

    console.log("\n==========================================");
    console.log("TEST: 특정 기사 디버깅 (우선순위 룰 적용 후)");
    console.log("Title:", item.title);
    
    // Clear memory cache
    rssService.news.feedCache.clear();
    
    // Simulate selection logic with our updated pickPreferredArticleBody policy
    const detail = await rssService.getNewsArticle(topicDoor, "175", {
      articleKey: item.articleKey,
      link: item.link
    });
    
    console.log("BODY (Newline count):", (detail.article?.body?.match(/\n/g) || []).length);
    console.log("BODY TEXT:\n", detail.article?.body);
    console.log("==========================================");
    
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
