const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const refDir = path.join(process.cwd(), 'docs', 'ref_images');
if (!fs.existsSync(refDir)) {
  fs.mkdirSync(refDir, { recursive: true });
}

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 2000) return resolve(false);
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
            if (stat.size < 2000) { // 2KB 미만 아이콘 제거
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

// 5개 카테고리별 검색 키워드 및 접두사
const categories = [
  { prefix: '하이텔', queries: ['하이텔 pc통신', 'hitel pc통신대문', 'ketel 터미널'] },
  { prefix: '나우누리', queries: ['나우누리 pc통신', 'nownuri 대문', '나우클럽 01410'] },
  { prefix: '천리안', queries: ['천리안 pc통신', 'chollian 대문', '데이콤 01410'] },
  { prefix: '유니텔', queries: ['유니텔 pc통신', 'unitel 대문', '삼성 유니텔'] },
  { prefix: '기타', queries: ['dos 고전게임 텍스트어드벤처', 'pc통신 모뎀 01410 장비', 'basic 프로그래밍 책'] }
];

async function main() {
  console.log('Building balanced 5-category ref_images dataset...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (const cat of categories) {
    console.log(`\n========================================`);
    console.log(`Fetching category: ${cat.prefix}`);
    console.log(`========================================`);

    const imgCandidateUrls = new Set();

    for (const q of cat.queries) {
      const searchUrl = `https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=${encodeURIComponent(q)}`;
      try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        const srcs = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img._image, img'));
          return imgs.map(i => i.getAttribute('data-lazy-src') || i.src || i.getAttribute('data-src')).filter(Boolean);
        });

        for (const src of srcs) {
          if (!src.includes('ssl.pstatic.net/sstatic') && !src.includes('favicon') && !src.includes('blank.gif')) {
            let highRes = src.replace(/type=[a-z0-9_]+/i, 'type=w966');
            imgCandidateUrls.add(highRes);
          }
        }
      } catch (e) {
        console.log(`Error on ${q}: ${e.message}`);
      }
    }

    console.log(`Found ${imgCandidateUrls.size} image candidates for category [${cat.prefix}].`);

    let savedCount = 0;
    for (const imgUrl of imgCandidateUrls) {
      if (savedCount >= 8) break; // 카테고리당 8개씩 균형 수집
      savedCount++;
      const ext = imgUrl.includes('.png') ? 'png' : 'jpg';
      const fileName = `${cat.prefix}_${String(savedCount).padStart(2, '0')}.${ext}`;
      const savePath = path.join(refDir, fileName);

      console.log(`Downloading (${savedCount}): ${fileName}`);
      const ok = await downloadImage(imgUrl, savePath);
      if (ok) {
        console.log(`Saved: ${fileName}`);
      }
    }
  }

  await browser.close();

  console.log('\n========================================');
  console.log('5-Category ref_images build complete!');
  console.log('========================================');
  for (const c of categories) {
    const files = fs.readdirSync(refDir).filter(f => f.startsWith(c.prefix + '_'));
    console.log(`- ${c.prefix}_ : ${files.length}개 파일`);
  }
}

main();
