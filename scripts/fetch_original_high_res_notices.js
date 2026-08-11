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

// 네이버 블로그 PostView 직접 URL (iframe 없이 본문 이미지 파싱 가능)
const directBlogPosts = [
  { name: '하이텔', prefix: '하이텔_종료공지_대형원본', url: 'https://blog.naver.com/PostView.naver?blogId=jhtsss&logNo=221365190752' },
  { name: '나우누리', prefix: '나우누리_종료공지_대형원본', url: 'https://blog.naver.com/PostView.naver?blogId=bj1389&logNo=130186761619' },
  { name: '천리안', prefix: '천리안_종료공지_대형원본', url: 'https://blog.naver.com/PostView.naver?blogId=jhtsss&logNo=221365190752' },
  { name: '유니텔', prefix: '유니텔_종료공지_대형원본', url: 'https://blog.naver.com/PostView.naver?blogId=bj1389&logNo=130186761619' }
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
            if (stat.size < 15000) { // 15KB 미만 소형 이미지 필터링
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
  console.log('Fetching FULL-SIZE high resolution images from PostView URLs...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const src of directBlogPosts) {
    console.log(`\nNavigating PostView for ${src.name}: ${src.url}`);
    try {
      await page.goto(src.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);

      const imgSrcs = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.map(img => {
          let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
          if (s && (s.includes('postfiles') || s.includes('blogfiles') || s.includes('blogthumb'))) {
            // Remove thumbnail params to get max resolution original image
            return s.replace(/\?type=w\d+/, '?type=w966').replace(/\?type=s\d+/, '?type=w966');
          }
          return null;
        }).filter(Boolean);
      });

      console.log(`Found ${imgSrcs.length} candidate full-size images for ${src.name}.`);

      let count = 0;
      for (const imgUrl of imgSrcs) {
        if (count >= 3) break;
        count++;
        const filename = `${src.prefix}_0${count}.jpg`;
        const savePath = path.join(outDir, filename);

        console.log(`Downloading FULL-SIZE image (${count}): ${filename}`);
        const ok = await downloadImage(imgUrl, savePath);
        if (ok) {
          console.log(`Saved FULL-SIZE image: ${filename}`);
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }

  await browser.close();

  const finalFiles = fs.readdirSync(outDir);
  console.log(`\nCompleted! Final full-size files in docs/종료:`, finalFiles);
}

main();
