'use strict';

async function run() {
  console.log('--- FETCHING ARTICLE LIST FROM LOCAL API ---');
  const listRes = await fetch('http://localhost:3000/api/services/news/1?page=6');
  if (!listRes.ok) {
    console.error('Failed to fetch article list:', listRes.status);
    return;
  }
  const listData = await listRes.json();
  const items = listData.data?.items || [];
  const article = items.find(item => String(item.no) === '87');
  if (!article) {
    console.error('Could not find article 87 in list data. List keys:');
    items.forEach(item => {
      console.log(`[No ${item.no}] Title: ${item.title}`);
    });
    return;
  }

  const articleKey = article.articleKey || article.key;
  console.log('Found Article 87 in API:', {
    no: article.no,
    title: article.title,
    key: articleKey,
    link: article.link
  });

  console.log('\n--- FETCHING ARTICLE 87 DETAIL FROM LOCAL API ---');
  const url = `http://localhost:3000/api/services/news/1/87?key=${articleKey}&link=${encodeURIComponent(article.link)}`;
  const detailRes = await fetch(url);
  if (!detailRes.ok) {
    console.error('Failed to fetch article detail:', detailRes.status);
    return;
  }
  const detailData = await detailRes.json();
  console.log('API Response Metadata:');
  console.log('detailFetched:', detailData.data?.article?.detailFetched);
  console.log('Body Length:', detailData.data?.article?.body ? detailData.data?.article?.body.length : 0);
  console.log('Body Content:\n', detailData.data?.article?.body);
}

run().catch(console.error);
