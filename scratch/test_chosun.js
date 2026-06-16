'use strict';
const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

async function run() {
  const url = 'https://www.chosun.com/economy/market_trend/2026/06/16/GFRDGZBTGE3DINTGMNTDIOJUMM/';
  console.log('Fetching URL:', url);
  try {
    const res = await fetch(url, {
      headers: CHROME_HEADERS,
      redirect: 'follow'
    });
    console.log('Status:', res.status, res.statusText);
    console.log('Response Headers:', [...res.headers.entries()]);
    const text = await res.text();
    console.log('HTML Length:', text.length);
    console.log('HTML Snippet:', text.substring(0, 1000));
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

run();
