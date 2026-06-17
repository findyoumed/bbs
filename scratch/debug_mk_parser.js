const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');

async function test() {
  const url = 'https://www.mk.co.kr/news/economy/12076366';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const detail = parseNewsArticleHtml(html);
  console.log('Parsed Detail:');
  console.log('Title:', detail.title);
  console.log('Body Length:', detail.body ? detail.body.length : 0);
  console.log('Body Snippet:', detail.body ? detail.body.substring(0, 200) : 'N/A');
}

test().catch(console.error);
