const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const sharp = require('sharp');

const outDir = path.join(process.cwd(), 'docs', '종료_candidates');
const queries = [
  { key: '하이텔', query: '하이텔 서비스 종료 공지' },
  { key: '나우누리', query: '나우누리 서비스 종료 공지' },
  { key: '천리안', query: '천리안 서비스 종료 공지' },
  { key: '유니텔', query: '유니텔 서비스 종료 공지' }
];

fs.mkdirSync(outDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          resolve(download(next, dest));
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
        const stream = fs.createWriteStream(dest);
        res.pipe(stream);
        stream.on('finish', () => stream.close(() => resolve(true)));
        stream.on('error', () => resolve(false));
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch (_) { resolve(false); }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const manifest = [];
  for (const item of queries) {
    const url = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(item.query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1800);
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('img'))
      .map((img) => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'))
      .filter((src) => src && !src.includes('favicon') && !src.includes('blank.gif') && !src.includes('ssl.pstatic.net/sstatic')));
    const seen = new Set();
    let saved = 0;
    for (const imageUrl of urls) {
      if (seen.has(imageUrl) || saved >= 24) continue;
      seen.add(imageUrl);
      const fileName = `${item.key}_${String(saved + 1).padStart(2, '0')}.jpg`;
      const dest = path.join(outDir, fileName);
      if (!(await download(imageUrl, dest))) continue;
      try {
        const metadata = await sharp(dest).metadata();
        if ((metadata.width || 0) < 160 || (metadata.height || 0) < 100) {
          fs.unlinkSync(dest);
          continue;
        }
        manifest.push({ file: fileName, service: item.key, searchUrl: url, imageUrl, width: metadata.width, height: metadata.height });
        saved += 1;
      } catch (_) {
        try { fs.unlinkSync(dest); } catch (_) {}
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(JSON.stringify({ candidates: manifest.length, byService: manifest.reduce((acc, row) => { acc[row.service] = (acc[row.service] || 0) + 1; return acc; }, {}) }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
