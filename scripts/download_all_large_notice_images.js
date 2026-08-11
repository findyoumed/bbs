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

// 4대 PC통신 서비스별 다양한 시대별 대형 종료 공지글 이미지 URL 리스트
const largeNoticeList = [
  // 하이텔 (HITEL / KETEL / 파란)
  { filename: '하이텔_01_파란서비스종료_공식공지_대형.jpg', url: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxODA5MjVfNDgg%2FMDAxNTM3ODQ3NDQ6ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss%2F%25B8%25DE%25B4%25BA%25BE%25F3_044.jpg&type=w966' },
  { filename: '하이텔_02_데이터이전_공지_대형.jpg', url: 'https://img.news.naver.net/image/001/2007/06/28/KP1_20070628100500_0_99_20070628101511.jpg' },
  { filename: '하이텔_03_01410접속종료_대형.png', url: 'https://rainygirl.github.io/images/2022-10-30-01410coroke-hwp.png' },

  // 나우누리 (NOWNURI)
  { filename: '나우누리_01_2013년서비스종료_공식공지_대형.png', url: 'https://i.namu.wiki/i/bjlNyvQpWDteSAkEXQnKqc6BN-JAodqO-XcvynjvlD_XaM31aHaBr04f1BRHJouC_Nv02iwD-xrgE--63I2Ny9-bIwWAYrKw7NbMVwfC93rQlZhCW5XvbXQlMSwKB3gXEQBFsaR51i3nHHwS-T0vzcUJVvnAc--R_cO9SMePnxUiFktfxJ3qPr9jFWWVPI5jIgTtBBjhiv6EjQuin8ly70_iWnddTDgPxN_Aztv5tWW-b9S_e7WzUYHV545oZ4lStgbxLSNM4ZmvJUDiBOIs9IXje_NkHg5V9Z3ZE8C2eHF4jF902HkXlyxT69ckO32L.png' },
  { filename: '나우누리_02_메인화면_종료안내_대형.jpg', url: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20130107_207%2Fbj1389_1357545935028XwJ0l_PNG%2F001.png&type=w966' },
  { filename: '나우누리_03_나우클럽_종료공지_대형.gif', url: 'https://i.namu.wiki/i/0FaTV85udGzSjpjw2v-DWhh_ziFaVnmaNm_qU2LzrIh9vNQo58vA9fLXa5oHLKsU9o5hd5Jsilkpp4StP6CTRDZD8lb-YHDXsmpuRBLg1jLiIvnW3ZFYdl2W1VA3-LNcBgrNdGtiQyPFLuat6G2ITw.gif' },

  // 천리안 (CHOLLIAN)
  { filename: '천리안_01_2024년최종종료_공식공지_대형.png', url: 'https://i.namu.wiki/i/FjKSo6pY-_foRgXZhDT3R3Gz1LYi66p0b74QjzkwmDv9P_MLZtWiW0XluxfNfS6duZWGBXrxbdiyvNXjmIZa1XtmGR5n50-Mh_MnXFErS3WhnFGO3IV6mYQp-B3KELetskTeJXDxyciNgD0V9Ij3Zw.png' },
  { filename: '천리안_02_01410전용접속_종료안내_대형.png', url: 'https://rainygirl.github.io/images/ogimage.png' },
  { filename: '천리안_03_이메일백업_종료공지_대형.jpg', url: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDA3MDFfMjgy%2FMDAxNzE5ODE0NzUwOTAw.s-cQx57Wz4xZ33yT8y5xZ_77x88y.JPEG.jhtsss%2F01410.jpg&type=w966' },

  // 유니텔 (UNITEL)
  { filename: '유니텔_01_PC통신웹_서비스종료_대형.jpg', url: 'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg' },
  { filename: '유니텔_02_서비스종료_상세안내_대형.jpg', url: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjAyMjhfNDkg%2FMDAxNjQ2MDU2Njc0MTU1.821yH52J0L-qY7n38h6r9j_Ym3L3x77p.JPEG.jhtsss%2Funitel.jpg&type=w966' },
  { filename: '유니텔_03_유니텔아카이브_대형.jpg', url: 'https://tistory3.daumcdn.net/tistory/2324376/skin/images/BlogBanner.jpg' }
];

async function main() {
  console.log('Downloading ALL large-scale PC communication termination notice images...');

  // Subfolder cleanup if exists
  const subFolder = path.join(outDir, '나우누리_회고글_원본');
  if (fs.existsSync(subFolder)) {
    fs.rmSync(subFolder, { recursive: true, force: true });
  }

  for (const item of largeNoticeList) {
    const savePath = path.join(outDir, item.filename);
    console.log(`Downloading: ${item.filename}`);
    const ok = await downloadImage(item.url, savePath);
    if (ok) {
      const stat = fs.statSync(savePath);
      console.log(`Saved (${(stat.size / 1024).toFixed(1)} KB): ${item.filename}`);
    }
  }

  const resultFiles = fs.readdirSync(outDir);
  console.log('\nFinal large notice files in docs/종료:');
  for (const f of resultFiles) {
    if (f === 'README.md') continue;
    const stat = fs.statSync(path.join(outDir, f));
    console.log(`- ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

main();
