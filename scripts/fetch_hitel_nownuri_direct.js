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
        if (buffer.length < 10000) return resolve(false);
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
            if (stat.size < 10000) {
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
  console.log('Fetching Hitel and Nownuri readable notice images...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Search Naver specifically for Hitel & Nownuri termination popup images
  const searchMap = {
    '하이텔': 'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%ED%95%98%EC%9D%B4%ED%85%94%20%EC%A2%85%EB%A3%8C%20%EA%B3%B5%EC%A7%80%20%ED%8C%9D%EC%97%85',
    '나우누리': 'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%EB%82%98%EC%9A%B0%EB%88%84%EB%A6%AC%20%EC%A2%85%EB%A3%8C%20%EA%B3%B5%EC%A7%80%20%ED%8C%9D%EC%97%85'
  };

  for (const [name, sUrl] of Object.entries(searchMap)) {
    console.log(`Navigating for ${name}: ${sUrl}`);
    try {
      await page.goto(sUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);

      const srcs = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img._image, img[data-lazy-src], img[src]'));
        return imgs.map(i => i.getAttribute('data-lazy-src') || i.src || i.getAttribute('data-src')).filter(Boolean);
      });

      let count = 1;
      for (const src of srcs) {
        if (count > 3) break;
        if (src.includes('ssl.pstatic.net/sstatic') || src.includes('blank.gif')) continue;
        let highResSrc = src.replace(/type=[a-z0-9_]+/i, 'type=w966');
        const filename = count === 1 ? `${name}_종료공지.jpg` : `${name}_종료공지_0${count}.jpg`;
        const savePath = path.join(outDir, filename);

        console.log(`Downloading ${name} (${count}): ${filename}`);
        const ok = await downloadImage(highResSrc, savePath);
        if (ok) {
          console.log(`Saved: ${filename}`);
          count++;
        }
      }
    } catch (e) {
      console.log(`Error fetching ${name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Direct Hitel/Nownuri fetch complete. Final files in docs/종료:', fs.readdirSync(outDir));
}

main();
