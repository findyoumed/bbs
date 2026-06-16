'use strict';
const https = require('https');
const url = require('url');

const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

function fetchHttps(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const options = {
      hostname: parsed.hostname,
      path: parsed.path,
      method: 'GET',
      headers: CHROME_HEADERS
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function run() {
  const target = 'https://www.chosun.com/economy/market_trend/2026/06/16/GFRDGZBTGE3DINTGMNTDIOJUMM/';
  try {
    const html = await fetchHttps(target);
    console.log('Contains "롯데":', html.includes('롯데'));
    console.log('Contains "신동빈":', html.includes('신동빈'));
    console.log('Contains "아카데미":', html.includes('아카데미'));
    
    // 만약 찾을 수 있다면, 그 주변 텍스트 500글자를 출력해보자
    const idx = html.indexOf('롯데');
    if (idx !== -1) {
      console.log('Found surrounding text:', html.substring(idx - 100, idx + 400));
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

run();
