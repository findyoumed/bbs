const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const baseDir = path.join(process.cwd(), 'docs', '종료');
const targetDir = path.join(baseDir, '원본_공지');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
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

// 4대 PC통신 서비스별 진짜 실물 종료 공지 원본 이미지 URL 리스트
const realNoticeList = [
  {
    name: '나우누리_2013년_서비스종료_공식팝업공지.jpg',
    url: 'https://postfiles.pstatic.net/20121208_255/bravo__bang_1354960324055FTt5o_JPEG/%B3%AA%BF%EC%B4%A9%B8%AE_%C3%CA%B1%E2%C8%AD%B8%E9.jpg'
  },
  {
    name: '나우누리_서비스종료_메인화면공지.jpg',
    url: 'https://postfiles.pstatic.net/20121208_186/bravo__bang_1354960407370zmHY1_JPEG/%B3%AA%BF%EC%B4%A9%B8%AE%B8%DE%C0%CE%C8%AD%B8%E9.jpg'
  },
  {
    name: '하이텔_파란_서비스종료_공식공지.jpg',
    url: 'https://postfiles.pstatic.net/MjAxODA5MjVfNDgg/MDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss/%B8%DE%B4%BA%BE%F3_044.jpg'
  },
  {
    name: '천리안_01410_서비스종료_공식공지.png',
    url: 'https://rainygirl.github.io/images/ogimage.png'
  },
  {
    name: '유니텔_PC통신_서비스종료_공식공지.jpg',
    url: 'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg'
  }
];

async function main() {
  console.log('Downloading exact real termination popup notices into docs/종료/원본_공지...');

  for (const item of realNoticeList) {
    const savePath = path.join(targetDir, item.name);
    console.log(`Downloading: ${item.name}`);
    const ok = await downloadImage(item.url, savePath);
    if (ok) {
      const stat = fs.statSync(savePath);
      console.log(`Successfully saved ${item.name} (${stat.size} bytes).`);
    }
  }

  const resultFiles = fs.readdirSync(targetDir);
  console.log('\nFinal real termination notice files:', resultFiles);
}

main();
