// LOG_ID: 20260811_1632
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', '종료', '나우누리_회고글_원본');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

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
  console.log('Navigating to user provided blog: https://blog.naver.com/PostView.naver?blogId=bravo__bang&logNo=60177527979');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const targetUrl = 'https://blog.naver.com/PostView.naver?blogId=bravo__bang&logNo=60177527979';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const imgSrcs = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => {
      let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
      if (s && (s.includes('postfiles') || s.includes('blogfiles') || s.includes('blogthumb') || s.includes('mblogthumb'))) {
        return s.replace(/\?[^#]+$/, '?type=w2');
      }
      return null;
    }).filter(Boolean);
  });

  console.log(`Found ${imgSrcs.length} images in user blog link.`);
  await browser.close();

  const names = [
    '01_나우누리_초기화면.jpg',
    '02_나우누리_메인화면.jpg',
    '03_나우누리_나우깨비.jpg',
    '04_나우누리_로고.jpg',
    '05_나우누리_이야기7.jpg',
    '06_나우누리_웃긴베스트.jpg'
  ];
  let idx = 1;
  for (const imgUrl of imgSrcs) {
    const filename = names[idx - 1] || `나우누리_회고글_이미지_${String(idx).padStart(2, '0')}.jpg`;
    const savePath = path.join(outDir, filename);
    console.log(`Downloading: ${filename} from ${imgUrl}`);
    const ok = await downloadImage(imgUrl, savePath);
    if (ok) {
      const stat = fs.statSync(savePath);
      console.log(`Saved (${stat.size} bytes): ${filename}`);
      idx++;
    }
  }

  console.log('Finished downloading user provided blog images. Files in target directory:', fs.readdirSync(outDir));
}

main();
