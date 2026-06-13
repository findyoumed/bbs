const path = require('path');
const { createAppServices } = require('../src/server/createAppServices');

const rootDir = path.resolve(__dirname, '..');
const services = createAppServices(rootDir);
const rssService = services.rssService;

async function run() {
  try {
    console.log("Loading news topics...");
    const topics = await rssService.listNewsTopics();
    console.log("Topics:", topics.items.map(t => `${t.door}: ${t.title}`));
    
    // We get the current date in KST (UTC+9)
    // The system time is 2026-06-13T11:27...
    const todayStr = "2026-06-13";
    console.log("Checking news for date:", todayStr);
    
    for (const t of topics.items) {
      const feed = await rssService.getNewsTopicFeed(t.door);
      const items = feed.items || [];
      const todayItems = items.filter(item => {
        const dateStr = item.dateTime || item.date || '';
        return dateStr.startsWith(todayStr);
      });
      const pagesNeeded = Math.ceil(todayItems.length / 15);
      console.log(`Topic ${t.door} (${t.title}): Total ${items.length}, Today ${todayItems.length}, Pages needed for today's news: ${pagesNeeded}`);
    }
  } catch (err) {
    console.error("Error fetching news:", err);
  }
}

run();
