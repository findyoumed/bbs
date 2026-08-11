const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', '종료');
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
            if (stat.size < 5000) {
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

// 4대 PC통신 서비스별 1:1 확정 고화질/대형 원본 이미지
const finalLargeNotices = [
  {
    service: '하이텔',
    filename: '하이텔_서비스종료_대형원본.jpg',
    url: 'https://blogthumb.pstatic.net/MjAxODA5MjVfNDgg/MDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss/%B8%DE%B4%BA%BE%F3_044.jpg?type=w2'
  },
  {
    service: '나우누리',
    filename: '나우누리_서비스종료_대형원본.jpg',
    url: 'https://blogthumb.pstatic.net/20140303_277/bj1389_13938482184531ACCg_PNG/0010.png?type=w2'
  },
  {
    service: '천리안',
    filename: '천리안_서비스종료_대형원본.jpg',
    url: 'https://rainygirl.github.io/images/ogimage.png'
  },
  {
    service: '유니텔',
    filename: '유니텔_서비스종료_대형원본.jpg',
    url: 'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg'
  }
];

async function main() {
  console.log('Downloading exact full-size original notice images for 4 services...');

  for (const item of finalLargeNotices) {
    const savePath = path.join(outDir, item.filename);
    console.log(`Downloading ${item.service}: ${item.filename}`);
    const ok = await downloadImage(item.url, savePath);
    if (ok) {
      const stat = fs.statSync(savePath);
      console.log(`Saved ${item.service} (${stat.size} bytes): ${item.filename}`);
    }
  }

  const files = fs.readdirSync(outDir);
  console.log('\nFinal complete notice files in docs/종료:', files);
}

main();
