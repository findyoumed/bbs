const { extractArticleContainerBodies } = require('../src/server/RssNewsArticleParserExtractors');

async function test() {
  const url = 'https://www.mk.co.kr/news/economy/12076366';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const bodies = extractArticleContainerBodies(html);
  console.log('Extracted Bodies Count:', bodies.length);
  bodies.forEach((b, i) => console.log(`Body ${i} [${b.length}]: "${b}"`));
}
test();
