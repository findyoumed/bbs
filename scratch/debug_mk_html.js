async function test() {
  const url = 'https://www.mk.co.kr/news/economy/12076366';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const t = await res.text();
  console.log('view_art:', t.match(/<div[^>]+class=["'][^"']*view_art[^"']*["'][^>]*>/i)?.[0]);
  console.log('news_cnt:', t.match(/<div[^>]+class=["'][^"']*news_cnt[^"']*["'][^>]*>/i)?.[0]);
  console.log('newsct_article:', t.match(/<div[^>]+id=["'][^"']*newsct_article[^"']*["'][^>]*>/i)?.[0]);
}
test();
