const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', '종료');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 1500) return resolve(false);
        fs.writeFileSync(savePath, buffer);
        return resolve(true);
      }
      const parsed = new URL(imgUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (!loc.startsWith('http')) {
            loc = new URL(loc, imgUrl).toString();
          }
          return resolve(downloadImage(loc, savePath));
        }
        if (res.statusCode !== 200) {
          return resolve(false);
        }
        const fileStream = fs.createWriteStream(savePath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          try {
            const stat = fs.statSync(savePath);
            if (stat.size < 1500) {
              try { fs.unlinkSync(savePath); } catch (e) {}
              return resolve(false);
            }
          } catch (e) {}
          resolve(true);
        });
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch (e) {
      resolve(false);
    }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const hitelUrls = [
    'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%ED%95%98%EC%9D%B4%ED%85%94%20%EC%84%9C%EB%B9%84%EC%8A%A4%20%EC%A2%85%EB%A3%8C%20%EC%95%88%EB%84%B4',
    'https://www.google.com/search?q=hitel+%EC%84%9C%EB%B9%84%EC%8A%A4+%EC%A2%85%EB%A3%8C+%EA%B3%B5%EC%A7%80&udm=2'
  ];

  const imgSet = new Set();
  for (const u of hitelUrls) {
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const srcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img._image, img')).map(i => i.src || i.getAttribute('data-src')).filter(Boolean);
      });
      srcs.forEach(s => {
        if (!s.includes('favicon') && !s.includes('blank.gif') && !s.includes('logo')) {
          imgSet.add(s);
        }
      });
    } catch (e) {}
  }
  await browser.close();

  let count = 0;
  for (const imgUrl of imgSet) {
    if (count >= 4) break;
    count++;
    const savePath = path.join(outDir, `하이텔_종료공지_${String(count).padStart(2, '0')}.jpg`);
    await downloadImage(imgUrl, savePath);
  }
  console.log('Hitel termination images saved.');
}

main();
