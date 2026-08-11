const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', 'ref_images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const targetUrls = [
  'https://rainygirl.github.io/2022/10/01410coroke',
  'https://01410.coroke.net/top',
  'https://raw.githubusercontent.com/rainygirl/01410.coroke.net/main/README.md',
  'https://github.com/darkcircle/atdt01410',
  'https://github.com/chunghee/ezbbs',
  'https://github.com/liza183/clienBBS',
  'https://github.com/Kangmo/mighty',
  'https://namu.wiki/w/%EB%82%98%EC%9A%B0%EB%88%84%EB%A6%AC',
  'https://namu.wiki/w/%ED%95%98%EC%9D%B4%ED%85%94',
  'https://blog.naver.com/jhtsss/221365190752',
  'https://blog.naver.com/bj1389/130186761619',
  'https://m.blog.naver.com/jhtsss/221365190752',
  'https://m.blog.naver.com/bj1389/130186761619',
  'https://tcltk.co.kr/249',
  'https://nemo838.tistory.com/category/Dos%20Games/Dos-%ED%85%8D%EC%8A%A4%ED%8A%B8%20%EC%96%B4%EB%93%9C%EB%B2%A4%EC%B2%98',
  'https://brunch.co.kr/@c463602d6b22464/68',
  'https://brunch.co.kr/@kedunews/19',
  'https://m.hanbit.co.kr/store/books/book_view.html?p_code=B2099312073',
  'https://ls2.zipel.info/m/348',
  'https://dreamphp.com/classic/classic_etc/?mode=read&idx=82&page=3&where=subject&keyword=',
  'http://bbs.segang.kr/',
  'https://gmapds.oscc.kr/',
  'https://bbsweb.oscc.kr/',
  'https://v0-remix-of-01410-ten.vercel.app/'
];

function fetchText(urlStr) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const req = mod.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
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
            if (stat.size < 1000) { // 1KB 미만 극소형 아이콘만 제거
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
  console.log('Starting comprehensive image extraction from all bookmark URLs...');
  const foundImageUrls = new Set();

  for (const pageUrl of targetUrls) {
    console.log(`Fetching page: ${pageUrl}`);
    const html = await fetchText(pageUrl);
    if (!html) continue;

    // Regex for image src, data-src, content, og:image
    const matches = html.matchAll(/(?:src|data-src|href|content)=["']([^"']+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^"']*)?)["']/gi);
    for (const match of matches) {
      let rawImg = match[1];
      if (!rawImg) continue;
      try {
        let absUrl = rawImg.startsWith('http') ? rawImg : new URL(rawImg, pageUrl).toString();
        if (!absUrl.includes('google-analytics') && !absUrl.includes('facebook') && !absUrl.includes('favicon.ico')) {
          foundImageUrls.add(absUrl);
        }
      } catch (e) {}
    }
  }

  console.log(`Found ${foundImageUrls.size} candidate image URLs.`);
  let count = fs.readdirSync(outDir).filter(f => f.startsWith('bookmark_ref_')).length;
  let downloadedCount = 0;

  for (const imgUrl of foundImageUrls) {
    if (downloadedCount >= 100) break; // 최대 100개 확장
    const ext = (imgUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp)/i) || [])[1] || 'png';
    count++;
    const filename = `bookmark_ref_${String(count).padStart(3, '0')}.${ext.toLowerCase()}`;
    const savePath = path.join(outDir, filename);

    console.log(`Downloading (${count}): ${imgUrl}`);
    const ok = await downloadImage(imgUrl, savePath);
    if (ok) {
      console.log(`Saved: ${filename}`);
      downloadedCount++;
    }
  }

  console.log(`Successfully downloaded ${downloadedCount} additional reference images into docs/ref_images.`);
}

main();
