async function test() {
  const topicDoor = '1';
  const url = `http://localhost:3000/api/services/news/topics/${topicDoor}?page=1`;
  console.log(`Fetching ${url}...`);
  const res = await fetch(url);
  const envelope = await res.json();
  const data = envelope.data;
  
  if (data && data.items) {
    console.log(`Found ${data.items.length} items.`);
    const item14 = data.items.find(item => item.no === 14);
    if (item14) {
      console.log('Item #14 found:');
      console.log(`Title: ${item14.title}`);
      console.log(`Link: ${item14.link}`);
      console.log(`Date: ${item14.date || item14.dateTime}`);
      
      const detailUrl = `http://localhost:3000/api/services/news/topics/${topicDoor}/articles/14?link=${encodeURIComponent(item14.link)}&key=${item14.articleKey}`;
      console.log(`\nFetching detail: ${detailUrl}...`);
      const dRes = await fetch(detailUrl);
      const dEnvelope = await dRes.json();
      const dData = dEnvelope.data;
      
      if (dData && dData.article) {
        console.log('\nDetail for #14:');
        console.log(`Title: ${dData.article.title}`);
        console.log(`Body Length: ${dData.article.body ? dData.article.body.length : 0}`);
        console.log(`Body Snippet: ${dData.article.body ? dData.article.body.substring(0, 100) : 'N/A'}`);
      }
    } else {
      console.log('Item #14 not found in the first page/batch.');
      // Print first few items to see what's there
      console.log('First 3 items:');
      data.items.slice(0, 3).forEach(it => console.log(`${it.no}: ${it.title}`));
    }
  }
}

test().catch(console.error);
