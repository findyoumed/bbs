const fs = require('fs');
const path = require('path');

async function test() {
  const url = 'https://www.mk.co.kr/news/stock/12077080';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const t = await res.text();
  fs.writeFileSync(path.join(__dirname, 'mk_12077080.html'), t, 'utf-8');
  console.log('Saved HTML to mk_12077080.html');
}
test();
