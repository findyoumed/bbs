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

const targets = [
  { name: '하이텔', prefix: '하이텔_종료공지', query: '하이텔 서비스 종료 공지' },
  { name: '나우누리', prefix: '나우누리_종료공지', query: '나우누리 서비스 종료 공지' },
  { name: '천리안', prefix: '천리안_종료공지', query: '천리안 서비스 종료 공지' },
  { name: '유니텔', prefix: '유니텔_종료공지', query: '유니텔 서비스 종료 공지' }
];

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
  console.log('Launching Playwright to search termination notice images...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const item of targets) {
    console.log(`\n=== Searching termination notices for ${item.name} ===`);
    const searchUrls = [
      `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(item.query)}`,
      `https://www.google.com/search?q=${encodeURIComponent(item.query)}&udm=2`
    ];

    const collectedImgUrls = new Set();

    for (const sUrl of searchUrls) {
      try {
        console.log(`Navigating: ${sUrl}`);
        await page.goto(sUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        const imgSrcs = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img._image, img'));
          return imgs.map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')).filter(Boolean);
        });

        for (const src of imgSrcs) {
          if (src && !src.includes('favicon') && !src.includes('blank.gif') && !src.includes('googlelogo') && !src.includes('ssl.pstatic.net/sstatic')) {
            collectedImgUrls.add(src);
          }
        }
      } catch (e) {
        console.log(`Error navigating ${sUrl}: ${e.message}`);
      }
    }

    console.log(`Found ${collectedImgUrls.size} candidate images for ${item.name}.`);
    let count = 0;
    for (const imgUrl of collectedImgUrls) {
      if (count >= 5) break; // 서비스 당 5개 이미지 저장
      count++;
      const filename = `${item.prefix}_0${count}.jpg`;
      const savePath = path.join(outDir, filename);

      console.log(`Downloading ${item.name} (${count}): ${filename}`);
      const ok = await downloadImage(imgUrl, savePath);
      if (ok) {
        console.log(`Saved: ${filename}`);
      }
    }
  }

  await browser.close();
  const resultFiles = fs.readdirSync(outDir);
  console.log(`\nCompleted downloading termination notice images! Saved ${resultFiles.length} files in docs/종료.`);
}

main();
