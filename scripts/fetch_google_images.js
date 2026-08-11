const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', 'google_ref_images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const googleSearchUrls = [
  'https://www.google.com/search?q=chollian&udm=2',
  'https://www.google.com/search?q=nownuri&udm=2',
  'https://www.google.com/search?q=hitel&udm=2',
  'https://www.google.com/search?q=01410&udm=2',
  'https://www.google.com/search?q=%ED%95%98%EC%9D%B4%ED%85%94&udm=2',
  'https://www.google.com/search?q=pc%ED%86%B5%EC%8B%A0&udm=2',
  'https://www.google.com/search?q=%EB%82%98%EC%9A%B0%EB%88%84%EB%A6%AC&udm=2',
  'https://www.google.com/search?q=%EC%B2%9C%EB%A6%AC%EC%95%88&udm=2'
];

function fetchText(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 12000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (!loc.startsWith('http')) {
            loc = new URL(loc, urlStr).toString();
          }
          return resolve(fetchText(loc));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
    } catch (e) {
      resolve('');
    }
  });
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
            if (stat.size < 800) { // 800 바이트 미만 제외
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
  console.log('Starting Google image search scraping for PC communication terms...');
  const foundImageUrls = new Set();

  for (const urlStr of googleSearchUrls) {
    console.log(`Fetching Google Search: ${urlStr}`);
    const html = await fetchText(urlStr);
    if (!html) continue;

    // Extract encrypted-tbn0.gstatic.com or direct image URLs from search results
    const matches = html.matchAll(/https?:\/\/(?:encrypted-tbn\d\.gstatic\.com\/images\?q=tbn:[^"'\s\\]+|[^"'\s\\]+\.(?:png|jpg|jpeg|webp))/gi);
    for (const match of matches) {
      let imgUrl = match[0];
      if (imgUrl && !imgUrl.includes('google.com/favicon') && !imgUrl.includes('logo')) {
        foundImageUrls.add(imgUrl);
      }
    }
  }

  console.log(`Found ${foundImageUrls.size} Google image URLs.`);
  let count = 0;

  for (const imgUrl of foundImageUrls) {
    if (count >= 80) break; // 최대 80개 이미지 수집
    count++;
    const filename = `google_ref_${String(count).padStart(3, '0')}.jpg`;
    const savePath = path.join(outDir, filename);

    console.log(`Downloading (${count}): ${imgUrl.slice(0, 80)}...`);
    const ok = await downloadImage(imgUrl, savePath);
    if (ok) {
      console.log(`Saved: ${filename}`);
    }
  }

  const finalCount = fs.readdirSync(outDir).filter(f => f.startsWith('google_ref_')).length;
  console.log(`Successfully saved ${finalCount} Google reference images into docs/google_ref_images.`);
}

main();
