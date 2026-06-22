'use strict';

async function diagnose() {
  const targetApi = 'http://localhost:3000/api/services/news/10/50';
  console.log(`--- Fetching Live API: ${targetApi} ---`);
  try {
    const res = await fetch(targetApi, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`Response Status: ${res.status}`);
    if (!res.ok) {
      const text = await res.text();
      console.log(`Error Response:\n${text}`);
      return;
    }

    const data = await res.json();
    console.log(`\nResponse Data Envelope Keys:`, Object.keys(data));
    const payload = data.data || {};
    console.log(`Payload Keys:`, Object.keys(payload));

    const article = payload.article;
    if (article) {
      console.log(`Article Title: ${article.title}`);
      console.log(`Article Link: ${article.link}`);
      console.log(`Article detailFetched: ${article.detailFetched}`);
      console.log(`Article Body Length: ${article.body ? article.body.length : 0} chars`);
      console.log(`Article Body Snippet:\n---\n${article.body ? article.body.slice(0, 300) : 'NO BODY'}\n---`);
      console.log(`Article Body End Snippet:\n---\n${article.body ? article.body.slice(-300) : 'NO BODY'}\n---`);
    } else {
      console.log('❌ Article field missing in data payload!');
    }
  } catch (error) {
    console.error('❌ Connection or Fetch Error:', error.message);
  }
}

diagnose();
