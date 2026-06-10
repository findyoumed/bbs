'use strict';

async function run() {
  const url = 'http://localhost:3000/api/services/news/1';
  console.log('Fetching', url);
  const response = await fetch(url);
  const json = await response.json();

  if (!json.success) {
    console.error('Failed to fetch feed:', json.message);
    return;
  }

  const items = json.data.items || [];
  console.log(`Found ${items.length} items in feed.`);

  let foundCount = 0;
  items.forEach((item) => {
    // Check if title contains HTML tags like <...>, or HTML entities like &...;
    const hasTags = /<[^>]+>/g.test(item.title);
    const hasEntities = /&[A-Za-z0-9#]+;/g.test(item.title);
    if (hasTags || hasEntities) {
      foundCount++;
      console.log(`\nItem no: ${item.no}, Key: ${item.articleKey}`);
      console.log(`Title: "${item.title}"`);
      console.log(`Link: ${item.link}`);
      console.log(`Has Tags: ${hasTags}, Has Entities: ${hasEntities}`);
    }
  });

  if (foundCount === 0) {
    console.log('No titles with HTML tags or entities found in this feed.');
  }
}

run().catch(console.error);
