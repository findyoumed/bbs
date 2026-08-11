const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const outDir = path.join(process.cwd(), 'docs', '종료');

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

const highResMap = [
  {
    name: '하이텔_종료공지_원본대형.jpg',
    url: 'https://blogthumb.pstatic.net/MjAxODA5MjVfNDgg/MDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss/%B8%DE%B4%BA%BE%F3_044.jpg?type=w2'
  },
  {
    name: '나우누리_종료공지_원본대형.png',
    url: 'https://i.namu.wiki/i/bjlNyvQpWDteSAkEXQnKqc6BN-JAodqO-XcvynjvlD_XaM31aHaBr04f1BRHJouC_Nv02iwD-xrgE--63I2Ny9-bIwWAYrKw7NbMVwfC93rQlZhCW5XvbXQlMSwKB3gXEQBFsaR51i3nHHwS-T0vzcUJVvnAc--R_cO9SMePnxUiFktfxJ3qPr9jFWWVPI5jIgTtBBjhiv6EjQuin8ly70_iWnddTDgPxN_Aztv5tWW-b9S_e7WzUYHV545oZ4lStgbxLSNM4ZmvJUDiBOIs9IXje_NkHg5V9Z3ZE8C2eHF4jF902HkXlyxT69ckO32L.png'
  },
  {
    name: '천리안_종료공지_원본대형.png',
    url: 'https://rainygirl.github.io/images/ogimage.png'
  },
  {
    name: '유니텔_종료공지_원본대형.jpg',
    url: 'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg'
  }
];

async function main() {
  console.log('Organizing exact full-size original notice images for 4 services...');

  // Clean subfolder if exists
  const subFolder = path.join(outDir, '선별_공지');
  if (fs.existsSync(subFolder)) {
    fs.rmSync(subFolder, { recursive: true, force: true });
  }

  for (const item of highResMap) {
    const savePath = path.join(outDir, item.name);
    console.log(`Downloading ${item.name}...`);
    const ok = await downloadImage(item.url, savePath);
    if (ok) {
      const stat = fs.statSync(savePath);
      console.log(`Saved ${item.name} (${stat.size} bytes).`);
    }
  }

  const files = fs.readdirSync(outDir);
  console.log('\nFinal clean files in docs/종료:', files);
}

main();
