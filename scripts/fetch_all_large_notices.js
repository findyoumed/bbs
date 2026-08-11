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

// 다각도 종료 공지 키워드
const searchTargets = [
  { name: '하이텔', prefix: '하이텔_종료공지_대형', query: '하이텔 서비스 종료 공지' },
  { name: '하이텔_파란', prefix: '하이텔_파란종료_대형', query: '파란 하이텔 종료 안내' },
  { name: '나우누리', prefix: '나우누리_종료공지_대형', query: '나우누리 서비스 종료 공지' },
  { name: '나우누리_팝업', prefix: '나우누리_팝업공지_대형', query: '나우누리 종료 팝업' },
  { name: '천리안', prefix: '천리안_종료공지_대형', query: '천리안 서비스 종료 공지' },
  { name: '천리안_01410', prefix: '천리안_01410종료_대형', query: '천리안 01410 종료' },
  { name: '유니텔', prefix: '유니텔_종료공지_대형', query: '유니텔 서비스 종료 공지' },
  { name: 'PC통신종료', prefix: 'PC통신_종료안내_대형', query: 'PC통신 서비스 종료 안내문' }
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
            if (stat.size < 35000) { // 35KB 미만 소형 이미지 제거 (큰 원본만 허용)
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
  console.log('Starting comprehensive search for ALL large-scale termination notice images...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let globalCount = fs.readdirSync(outDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length;

  for (const item of searchTargets) {
    console.log(`\nSearching large images for: ${item.name} (${item.query})`);
    const searchUrl = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(item.query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2000);

      const highResUrls = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img._image, img[data-lazy-src], img[src]'));
        return imgs.map(img => {
          let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
          if (s) {
            // Convert to max resolution Naver image URL
            return s.replace(/type=[a-z0-9_]+/i, 'type=w966');
          }
          return null;
        }).filter(Boolean);
      });

      console.log(`Found ${highResUrls.length} candidate URLs for ${item.name}.`);

      let savedCount = 0;
      for (const u of highResUrls) {
        if (savedCount >= 5) break; // 각 키워드당 5개 대형 이미지
        if (u.includes('favicon') || u.includes('blank.gif') || u.includes('ssl.pstatic.net/sstatic')) continue;

        globalCount++;
        const ext = u.includes('.png') ? 'png' : 'jpg';
        const fileName = `${item.prefix}_${String(savedCount + 1).padStart(2, '0')}.${ext}`;
        const savePath = path.join(outDir, fileName);

        const ok = await downloadImage(u, savePath);
        if (ok) {
          console.log(`Saved LARGE notice image (${fs.statSync(savePath).size} bytes): ${fileName}`);
          savedCount++;
        }
      }
    } catch (e) {
      console.log(`Error searching ${item.name}: ${e.message}`);
    }
  }

  await browser.close();

  const finalFiles = fs.readdirSync(outDir);
  console.log(`\nComprehensive search complete! Total large files in docs/종료: ${finalFiles.length}`);
}

main();
