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
            if (stat.size < 2000) { // 2KB 미만 제외
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

// 하이텔, 나우누리, 천리안, 유니텔 4개 서비스별 원본 및 고화질 공지글/화면 URL
const serviceNotices = [
  {
    name: '하이텔_종료공지.png',
    urls: [
      'https://rainygirl.github.io/images/2022-10-30-01410coroke-hwp.png',
      'https://blogthumb.pstatic.net/MjAxODA5MjVfNDgg/MDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss/%B8%DE%B4%BA%BE%F3_044.jpg?type=w2'
    ]
  },
  {
    name: '나우누리_종료공지.png',
    urls: [
      'https://i.namu.wiki/i/0FaTV85udGzSjpjw2v-DWhh_ziFaVnmaNm_qU2LzrIh9vNQo58vA9fLXa5oHLKsU9o5hd5Jsilkpp4StP6CTRDZD8lb-YHDXsmpuRBLg1jLiIvnW3ZFYdl2W1VA3-LNcBgrNdGtiQyPFLuat6G2ITw.gif',
      'https://i.namu.wiki/i/CJgkurPn_yjamlha87jrCFanDRtUb9__G7VMvmX0VEVK8AA73hrkwu_XRzwHOOdd1Nanp9xSu-iIN_taVFf26HG9aAVeEw1XdhHEhYmCnO42kzNmRWjvWnSa2Ni7mj8G-k1h5laXzfN2TQAJrjt4BA.gif'
    ]
  },
  {
    name: '천리안_종료공지.png',
    urls: [
      'https://i.namu.wiki/i/FjKSo6pY-_foRgXZhDT3R3Gz1LYi66p0b74QjzkwmDv9P_MLZtWiW0XluxfNfS6duZWGBXrxbdiyvNXjmIZa1XtmGR5n50-Mh_MnXFErS3WhnFGO3IV6mYQp-B3KELetskTeJXDxyciNgD0V9Ij3Zw.png',
      'https://rainygirl.github.io/images/ogimage.png'
    ]
  },
  {
    name: '유니텔_종료공지.jpg',
    urls: [
      'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg',
      'https://tistory3.daumcdn.net/tistory/2324376/skin/images/BlogBanner.jpg'
    ]
  }
];

async function main() {
  console.log('Downloading readable 4 major PC communication termination notices...');

  for (const item of serviceNotices) {
    const savePath = path.join(outDir, item.name);
    let success = false;
    for (const url of item.urls) {
      console.log(`Downloading ${item.name} from ${url.slice(0, 60)}...`);
      const ok = await downloadImage(url, savePath);
      if (ok) {
        console.log(`Saved: ${item.name}`);
        success = true;
        break;
      }
    }
  }

  const resultFiles = fs.readdirSync(outDir);
  console.log('Final downloaded files in docs/종료:', resultFiles);
}

main();
