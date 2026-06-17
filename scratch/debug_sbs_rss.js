const fetch = require('node-fetch');
const { parseNewsFeedXml } = require('../src/server/RssServiceXmlParsers');

async function test() {
  const url = 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER';
  console.log(`Fetching SBS RSS: ${url}...`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await res.text();
  const feed = parseNewsFeedXml(text);
  
  if (feed && feed.items) {
    console.log(`Found ${feed.items.length} items.`);
    feed.items.slice(0, 50).forEach((item, index) => {
      console.log(`[${index + 1}] ${item.title}`);
      console.log(`    Link: ${item.link}`);
    });
  }
}

test().catch(console.error);
