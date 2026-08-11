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

// 서비스별 검색 키워드
const targetServices = [
  { name: '하이텔', key: 'hitel', query: '하이텔 서비스 종료 공지' },
  { name: '나우누리', key: 'nownuri', query: '나우누리 서비스 종료 공지' },
  { name: '천리안', key: 'chollian', query: '천리안 서비스 종료 공지' },
  { name: '유니텔', key: 'unitel', query: '유니텔 서비스 종료 공지' }
];

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 30000) return resolve(false); // 30KB 미만 제거
        fs.writeFileSync(savePath, buffer);
        return resolve(true);
      }
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
            if (stat.size < 30000) { // 최소 30KB 이상 대형 원본 이미지
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
  console.log('Starting Playwright full-size image extraction by clicking search result items...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const s of targetServices) {
    console.log(`\n========================================`);
    console.log(`Scraping full-size images for ${s.name}`);
    console.log(`========================================`);

    const fullSizeUrls = new Set();

    // Naver Image search: click items to open side panel for full-size image
    const searchUrl = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(s.query)}`;
    console.log(`Navigating: ${searchUrl}`);
    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      // Extract image links directly from page
      const rawUrls = await page.evaluate(() => {
        const results = [];
        const imgs = Array.from(document.querySelectorAll('img._image, img'));
        for (const img of imgs) {
          let src = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
          if (src) {
            // Convert Naver image thumbnail params to full resolution params (w966 or original)
            let fullRes = src.replace(/type=[a-z0-9_]+/i, 'type=w966');
            if (fullRes.includes('blogfiles.naver.net') || fullRes.includes('postfiles.naver.net')) {
              fullRes = fullRes.replace('/common/?src=', '').replace(/&type=w\d+/, '');
              try { fullRes = decodeURIComponent(fullRes); } catch (e) {}
            }
            results.push(fullRes);
          }
        }
        return results;
      });

      for (const u of rawUrls) {
        if (u.startsWith('http') && !u.includes('favicon') && !u.includes('blank.gif') && !u.includes('ssl.pstatic.net/sstatic')) {
          fullSizeUrls.add(u);
        }
      }
    } catch (e) {
      console.log(`Error navigating ${searchUrl}: ${e.message}`);
    }

    console.log(`Collected ${fullSizeUrls.size} potential full-size image URLs for ${s.name}.`);

    let count = 0;
    for (const imgUrl of fullSizeUrls) {
      if (count >= 3) break; // 서비스 당 3개의 큰 원본 이미지 저장
      const ext = imgUrl.includes('.png') ? 'png' : 'jpg';
      const fileName = count === 0 ? `${s.name}_종료공지_대형.jpg` : `${s.name}_종료공지_대형_0${count + 1}.jpg`;
      const savePath = path.join(outDir, fileName);

      console.log(`Downloading full-size image for ${s.name} (${count + 1}): ${fileName}`);
      const ok = await downloadImage(imgUrl, savePath);
      if (ok) {
        console.log(`Saved FULL-SIZE image: ${fileName}`);
        count++;
      }
    }
  }

  await browser.close();

  const finalFiles = fs.readdirSync(outDir);
  console.log(`\nCompleted! Full-size image files in docs/종료:`, finalFiles);
}

main();
