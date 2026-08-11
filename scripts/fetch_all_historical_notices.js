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

const queries = [
  { prefix: '하이텔_종료공지', q: '하이텔 서비스 종료 공지' },
  { prefix: '하이텔_파란종료', q: '파란 하이텔 종료 안내' },
  { prefix: '나우누리_종료공지', q: '나우누리 서비스 종료 공지' },
  { prefix: '나우누리_팝업공지', q: '나우누리 종료 팝업' },
  { prefix: '천리안_종료공지', q: '천리안 서비스 종료 공지' },
  { prefix: '천리안_01410종료', q: '천리안 01410 종료' },
  { prefix: '유니텔_종료공지', q: '유니텔 서비스 종료 공지' },
  { prefix: '유니텔_PC통신종료', q: '유니텔 PC통신 종료' },
  { prefix: '01410_종료안내', q: 'PC통신 01410 종료 안내' },
  { prefix: 'PC통신역사_종료', q: 'PC통신 서비스 중단 공지' }
];

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(imgUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 20000
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
            if (stat.size < 10000) { // 10KB 미만만 제거하여 풍부하게 수집
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
  console.log('Launching Playwright for all historical PC communication notice images...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const item of queries) {
    console.log(`\nFetching query: ${item.q}`);
    const searchUrl = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(item.q)}`;

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      const highResUrls = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img._image, img[data-lazy-src], img[src]'));
        return imgs.map(img => {
          let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
          if (s) {
            return s.replace(/type=[a-z0-9_]+/i, 'type=w966');
          }
          return null;
        }).filter(Boolean);
      });

      console.log(`Found ${highResUrls.length} candidate URLs.`);
      let savedCount = 0;
      for (const u of highResUrls) {
        if (savedCount >= 4) break;
        if (u.includes('favicon') || u.includes('blank.gif') || u.includes('ssl.pstatic.net/sstatic')) continue;

        const ext = u.includes('.png') ? 'png' : 'jpg';
        const fileName = `${item.prefix}_${String(savedCount + 1).padStart(2, '0')}.${ext}`;
        const savePath = path.join(outDir, fileName);

        const ok = await downloadImage(u, savePath);
        if (ok) {
          console.log(`Saved notice image (${fs.statSync(savePath).size} bytes): ${fileName}`);
          savedCount++;
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  await browser.close();

  const finalFiles = fs.readdirSync(outDir);
  console.log(`\nCompleted historical search! Saved ${finalFiles.length} files in docs/종료.`);
}

main();
