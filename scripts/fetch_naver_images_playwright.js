const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', 'naver_ref_images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const naverSearchUrls = [
  'https://search.naver.com/search.naver?ssc=tab.image.all&where=image&sm=tab_jum&query=chollian',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%EC%B2%9C%EB%A6%AC%EC%95%88',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%ED%95%98%EC%9D%B4%ED%85%94',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=hitel',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=nownuri',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=%EB%82%98%EC%9A%B0%EB%88%84%EB%A6%AC',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=pc%ED%86%B5%EC%8B%A0',
  'https://search.naver.com/search.naver?where=image&ssc=tab.image.all&query=01410'
];

function downloadImage(imgUrl, savePath) {
  return new Promise((resolve) => {
    try {
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length < 800) return resolve(false);
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
            if (stat.size < 800) {
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
  console.log('Launching Playwright for Naver Image scraping...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const collectedUrls = new Set();

  for (const urlStr of naverSearchUrls) {
    console.log(`Navigating to Naver Search: ${urlStr}`);
    try {
      await page.goto(urlStr, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);

      const imgSrcs = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img._image, img'));
        return imgs.map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')).filter(Boolean);
      });

      console.log(`Found ${imgSrcs.length} images on page.`);
      for (const src of imgSrcs) {
        if (src && !src.includes('ssl.pstatic.net/sstatic') && !src.includes('favicon') && !src.includes('blank.gif')) {
          collectedUrls.add(src);
        }
      }
    } catch (e) {
      console.log(`Failed page navigation: ${e.message}`);
    }
  }

  await browser.close();

  console.log(`Total candidate Naver image URLs collected: ${collectedUrls.size}`);
  let count = 0;
  for (const imgUrl of collectedUrls) {
    if (count >= 60) break; // 최대 60개 이미지 수집
    count++;
    const ext = imgUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = `naver_ref_${String(count).padStart(3, '0')}.${ext}`;
    const savePath = path.join(outDir, filename);

    console.log(`Saving Naver image (${count}): ${filename}`);
    const ok = await downloadImage(imgUrl, savePath);
    if (ok) {
      console.log(`Saved successfully: ${filename}`);
    }
  }

  const finalCount = fs.readdirSync(outDir).filter(f => f.startsWith('naver_ref_')).length;
  console.log(`Completed: ${finalCount} Naver reference images saved in docs/naver_ref_images.`);
}

main();
