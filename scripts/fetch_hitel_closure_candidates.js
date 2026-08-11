const fs = require('fs');
const path = require('path');
const https = require('https');
const { chromium } = require('playwright');
const sharp = require('sharp');

const outDir = path.join(process.cwd(), 'docs', '종료_candidates');
fs.mkdirSync(outDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve) => {
    try {
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
        const stream = fs.createWriteStream(dest); res.pipe(stream);
        stream.on('finish', () => stream.close(() => resolve(true)));
        stream.on('error', () => resolve(false));
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch (_) { resolve(false); }
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' });
  const queries = ['하이텔 파란 서비스 종료', '하이텔 폐쇄 공지', '하이텔 PC통신 종료'];
  const seen = new Set(); let index = 0; const manifest = [];
  for (const query of queries) {
    await page.goto(`https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1600);
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('img')).map((img) => img.src || img.getAttribute('data-src')).filter((src) => src && !src.includes('favicon') && !src.includes('blank.gif') && !src.includes('ssl.pstatic.net/sstatic')));
    for (const imageUrl of urls) {
      if (seen.has(imageUrl) || index >= 24) continue;
      seen.add(imageUrl); const dest = path.join(outDir, `하이텔_파란_${String(index + 1).padStart(2, '0')}.jpg`);
      if (!(await download(imageUrl, dest))) continue;
      try { const m = await sharp(dest).metadata(); if ((m.width || 0) < 160 || (m.height || 0) < 100) { fs.unlinkSync(dest); continue; } index += 1; manifest.push({ file: path.basename(dest), imageUrl, width: m.width, height: m.height, query }); }
      catch (_) { try { fs.unlinkSync(dest); } catch (_) {} }
    }
  }
  await browser.close(); fs.writeFileSync(path.join(outDir, 'hitel_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8'); console.log(`saved=${index}`);
})();
