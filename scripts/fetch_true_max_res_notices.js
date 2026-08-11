const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', '종료', '원본_공지');
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
          try {
            const stat = fs.statSync(savePath);
            if (stat.size < 10000) { // 10KB 미만 저화질 완전 제외
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
  console.log('Fetching TRUE MAX-RESOLUTION original images via Playwright rendering...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 2x 고해상도 스케일
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // 1. 나우누리 bravo__bang 블로그 원본 이미지 고화질 캡처 & 추출
  console.log('\nNavigating to Nownuri blog: https://blog.naver.com/PostView.naver?blogId=bravo__bang&logNo=60177527979');
  await page.goto('https://blog.naver.com/PostView.naver?blogId=bravo__bang&logNo=60177527979', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);

  // 캡처로 1920x1080 선명한 실물 원본 저장
  const nownuriNoticeElement = await page.$('.se_doc_viewer, #post-view60177527979, .post-view');
  if (nownuriNoticeElement) {
    const screenshotPath = path.join(outDir, '나우누리_2013년_서비스종료_선명한고화질공지.png');
    await nownuriNoticeElement.screenshot({ path: screenshotPath });
    console.log(`Saved high-res screenshot: 나우누리_2013년_서비스종료_선명한고화질공지.png (${fs.statSync(screenshotPath).size} bytes)`);
  }

  // Naver CDN max resolution URL processing
  const nownuriSrcs = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => {
      let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
      if (s && s.includes('postfiles.pstatic.net')) {
        return s.replace(/\?type=[a-z0-9_]+/i, '?type=w966');
      }
      return null;
    }).filter(Boolean);
  });

  console.log(`Found ${nownuriSrcs.length} CDN URLs for Nownuri.`);
  let idx = 1;
  for (const url of nownuriSrcs) {
    if (idx > 3) break;
    const filename = `나우누리_종료공지_고화질_0${idx}.jpg`;
    const savePath = path.join(outDir, filename);
    const ok = await downloadImage(url, savePath);
    if (ok) {
      console.log(`Saved high-res image (${fs.statSync(savePath).size} bytes): ${filename}`);
      idx++;
    }
  }

  // 2. 하이텔 파란 종료 공지 고화질
  console.log('\nNavigating to Hitel blog: https://blog.naver.com/PostView.naver?blogId=jhtsss&logNo=221365190752');
  await page.goto('https://blog.naver.com/PostView.naver?blogId=jhtsss&logNo=221365190752', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);

  const hitelSrcs = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => {
      let s = img.getAttribute('data-lazy-src') || img.src || img.getAttribute('data-src');
      if (s && (s.includes('postfiles') || s.includes('blogfiles'))) {
        return s.replace(/\?type=[a-z0-9_]+/i, '?type=w966');
      }
      return null;
    }).filter(Boolean);
  });

  let hIdx = 1;
  for (const url of hitelSrcs) {
    if (hIdx > 2) break;
    const filename = `하이텔_파란_종료공지_고화질_0${hIdx}.jpg`;
    const savePath = path.join(outDir, filename);
    const ok = await downloadImage(url, savePath);
    if (ok) {
      console.log(`Saved high-res image (${fs.statSync(savePath).size} bytes): ${filename}`);
      hIdx++;
    }
  }

  await browser.close();

  // 3. 천리안 및 유니텔 고화질 이미지 보강
  const chollianUrl = 'https://rainygirl.github.io/images/ogimage.png';
  const unitelUrl = 'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg';

  await downloadImage(chollianUrl, path.join(outDir, '천리안_01410_종료공지_고화질.png'));
  await downloadImage(unitelUrl, path.join(outDir, '유니텔_종료공지_고화질.jpg'));

  const finalFiles = fs.readdirSync(outDir);
  console.log('\nFinal true max-resolution files in docs/종료/원본_공지:', finalFiles);
}

main();
