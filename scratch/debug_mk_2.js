async function test() {
  const url = 'https://www.mk.co.kr/news/economy/12076131';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const t = await res.text();
  const start = t.indexOf('news_cnt_detail_wrap');
  if (start !== -1) {
    console.log('Area:', t.substring(start - 20, start + 3000));
  } else {
    console.log('news_cnt_detail_wrap not found');
  }
}
test();
