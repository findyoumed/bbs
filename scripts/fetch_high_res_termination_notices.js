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

// 4대 PC통신 서비스
const services = [
  { name: '하이텔', key: 'hitel', queries: ['하이텔 서비스 종료 공지', '하이텔 종료 안내 팝업', 'hitel 서비스 종료'] },
  { name: '나우누리', key: 'nownuri', queries: ['나우누리 서비스 종료 공지', '나우누리 종료 안내 팝업', 'nownuri 서비스 종료'] },
  { name: '천리안', key: 'chollian', queries: ['천리안 서비스 종료 공지', '천리안 종료 안내 팝업', 'chollian 서비스 종료'] },
  { name: '유니텔', key: 'unitel', queries: ['유니텔 서비스 종료 공지', '유니텔 종료 안내 팝업', 'unitel 서비스 종료'] }
];

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 15000) return resolve(false); // 15KB 이상 고화질만
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
            if (stat.size < 15000) { // 15KB 미만 소형 이미지 제거
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
  console.log('Launching Playwright for high-resolution termination notice scraping...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const s of services) {
    console.log(`\n========================================`);
    console.log(`Searching high-resolution notice for: ${s.name}`);
    console.log(`========================================`);

    const candidateUrls = new Set();

    for (const q of s.queries) {
      const searchUrl = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(q)}`;
      console.log(`Navigating Naver: ${q}`);
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2500);

        const srcs = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img._image, img[data-lazy-src], img[src]'));
          return imgs.map(img => img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src')).filter(Boolean);
        });

        for (const src of srcs) {
          // Naver image CDN thumbnail vs original resolution link conversion
          let highResSrc = src;
          if (src.includes('type=f') || src.includes('type=b') || src.includes('type=s')) {
            highResSrc = src.replace(/type=[a-z0-9_]+/i, 'type=w966');
          }
          if (!src.includes('favicon') && !src.includes('blank.gif') && !src.includes('ssl.pstatic.net/sstatic')) {
            candidateUrls.add(highResSrc);
          }
        }
      } catch (e) {
        console.log(`Error navigating query ${q}: ${e.message}`);
      }
    }

    console.log(`Found ${candidateUrls.size} candidate image URLs for ${s.name}.`);
    let downloadedCount = 0;

    for (const imgUrl of candidateUrls) {
      if (downloadedCount >= 3) break; // 서비스별 가독성 우수한 3개 원본 이미지 수집
      const fileName = downloadedCount === 0
        ? `${s.name}_종료공지.jpg`
        : `${s.name}_종료공지_0${downloadedCount + 1}.jpg`;
      const savePath = path.join(outDir, fileName);

      console.log(`Downloading ${s.name} high-res notice (${downloadedCount + 1}): ${fileName}`);
      const ok = await downloadImage(imgUrl, savePath);
      if (ok) {
        console.log(`Saved high-res image: ${fileName}`);
        downloadedCount++;
      }
    }
  }

  await browser.close();

  const finalFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`\nSuccessfully downloaded ${finalFiles.length} readable termination notice images into docs/종료.`);
}

main();
