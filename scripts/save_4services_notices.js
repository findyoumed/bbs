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
            if (stat.size < 10000) {
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

// 4대 PC통신 서비스별 고화질 종료 공지글 원본 이미지 URL 리스트
const directNoticeMap = {
  '하이텔': [
    'https://blogthumb.pstatic.net/MjAxODA5MjVfNDgg/MDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss/%B8%DE%B4%BA%BE%F3_044.jpg?type=w2',
    'https://img.news.naver.net/image/001/2007/06/28/KP1_20070628100500_0_99_20070628101511.jpg',
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxODA5MjVfNDgg%2FMDAxNTM3ODQ3NDQ2ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss%2F%25B8%25DE%25B4%25BA%25BE%25F3_044.jpg&type=w966'
  ],
  '나우누리': [
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20130107_122%2Fbj1389_1357545934523B0m4V_PNG%2F000.png&type=w966',
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20130107_207%2Fbj1389_1357545935028XwJ0l_PNG%2F001.png&type=w966'
  ],
  '천리안': [
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDA3MDFfMjgy%2FMDAxNzE5ODE0NzUwOTAw.s-cQx57Wz4xZ33yT8y5xZ_77x88y.JPEG.jhtsss%2F01410.jpg&type=w966',
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20150920_11%2Fjhtsss_1442749877443sXl2G_JPEG%2F01410_01.jpg&type=w966'
  ],
  '유니텔': [
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAyMjhfNDkg%2FMDAxNjQ2MDU2Njc0MTU1.821yH52J0L-qY7n38h6r9j_Ym3L3x77p.JPEG.jhtsss%2Funitel.jpg&type=w966',
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20150920_58%2Fjhtsss_1442749878100Y2yX_JPEG%2Funitel_notice.jpg&type=w966'
  ]
};

async function main() {
  console.log('Downloading high-resolution notice images for 4 major PC communication services...');

  for (const [serviceName, urls] of Object.entries(directNoticeMap)) {
    let saved = false;
    let idx = 1;
    for (const url of urls) {
      const fileName = idx === 1 ? `${serviceName}_종료공지.jpg` : `${serviceName}_종료공지_0${idx}.jpg`;
      const savePath = path.join(outDir, fileName);
      console.log(`Trying ${serviceName} (${idx}): ${fileName}`);
      const ok = await downloadImage(url, savePath);
      if (ok) {
        console.log(`Successfully saved ${serviceName} notice: ${fileName}`);
        saved = true;
      }
      idx++;
    }
  }

  const files = fs.readdirSync(outDir);
  console.log(`Final files in docs/종료:`, files);
}

main();
