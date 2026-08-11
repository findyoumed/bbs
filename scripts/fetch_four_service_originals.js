// LOG_ID: 20260811_1648
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');

const targetDir = path.join(process.cwd(), 'docs', '종료', '대형원본_4서비스');
const tempDir = path.join(targetDir, '.tmp');
fs.mkdirSync(targetDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

const sources = {
  하이텔: [
    'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxODA5MjVfNDgg%2FMDAxNTM3ODQ3NDQ2ODk3.tHfifjYg9pyd0N-rHg5WODqsIOO4VRNBsKdqpgYMyNsg.pu40LEfw1f_QOOO3MiwbZCpSV8MxdHqqoGLwZijAUmUg.JPEG.jhtsss%2F%25B8%25DE%25B4%25BA%25BE%25F3_044.jpg&type=w966',
    'http://blogfiles.naver.net/20130714_225/yonggarri_13738088026508K6Q8_JPEG/2.jpg'
  ],
  나우누리: [
    'https://i.namu.wiki/i/bjlNyvQpWDteSAkEXQnKqc6BN-JAodqO-XcvynjvlD_XaM31aHaBr04f1BRHJouC_Nv02iwD-xrgE--63I2Ny9-bIwWAYrKw7NbMVwfC93rQlZhCW5XvbXQlMSwKB3gXEQBFsaR51i3nHHwS-T0vzcUJVvnAc--R_cO9SMePnxUiFktfxJ3qPr9jFWWVPI5jIgTtBBjhiv6EjQuin8ly70_iWnddTDgPxN_Aztv5tWW-b9S_e7WzUYHV545oZ4lStgbxLSNM4ZmvJUDiBOIs9IXje_NkHg5V9Z3ZE8C2eHF4jF902HkXlyxT69ckO32L.png',
    'https://i.namu.wiki/i/0FaTV85udGzSjpjw2v-DWhh_ziFaVnmaNm_qU2LzrIh9vNQo58vA9fLXa5oHLKsU9o5hd5Jsilkpp4StP6CTRDZD8lb-YHDXsmpuRBLg1jLiIvnW3ZFYdl2W1VA3-LNcBgrNdGtiQyPFLuat6G2ITw.gif'
  ],
  천리안: [
    'https://i.namu.wiki/i/FjKSo6pY-_foRgXZhDT3R3Gz1LYi66p0b74QjzkwmDv9P_MLZtWiW0XluxfNfS6duZWGBXrxbdiyvNXjmIZa1XtmGR5n50-Mh_MnXFErS3WhnFGO3IV6mYQp-B3KELetskTeJXDxyciNgD0V9Ij3Zw.png',
    'https://rainygirl.github.io/images/ogimage.png'
  ],
  유니텔: [
    'https://cdn-prod.hanbit.co.kr/books/B2099312073_l.jpg'
  ]
};

function originalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('src') || url;
  } catch (_) {
    return url;
  }
}

function download(url, destination) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const requestOptions = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 };
    if (parsed.protocol === 'https:' && /(?:naver\.net|pstatic\.net)$/.test(parsed.hostname)) {
      requestOptions.rejectUnauthorized = false;
    }
    const request = transport.get(parsed, requestOptions, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(download(new URL(response.headers.location, parsed).toString(), destination));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        resolve(false);
        return;
      }
      const stream = fs.createWriteStream(destination);
      response.pipe(stream);
      stream.on('finish', () => stream.close(() => resolve(true)));
      stream.on('error', () => resolve(false));
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

async function main() {
  const report = [];
  let index = 0;
  for (const [service, urls] of Object.entries(sources)) {
    for (const [sourceIndex, url] of urls.entries()) {
      const original = originalUrl(url);
      const candidates = [original, original.replace(/^http:/, 'https:'), url];
      let best = null;
      for (const candidate of candidates) {
        const tempPath = path.join(tempDir, `candidate-${index++}`);
        if (!(await download(candidate, tempPath))) continue;
        try {
          const metadata = await sharp(tempPath).metadata();
          const pixels = (metadata.width || 0) * (metadata.height || 0);
          if (!best || pixels > best.pixels) {
            if (best) fs.rmSync(best.path, { force: true });
            best = { path: tempPath, pixels, width: metadata.width, height: metadata.height, format: metadata.format, original: candidate };
          } else {
            fs.rmSync(tempPath, { force: true });
          }
        } catch (_) {
          fs.rmSync(tempPath, { force: true });
        }
      }
      if (!best) {
        report.push({ service, sourceIndex: sourceIndex + 1, status: 'download-failed' });
        continue;
      }
      const extension = best.format === 'png' ? 'png' : best.format === 'gif' ? 'gif' : 'jpg';
      const filename = `${service}_종료공지_${String(sourceIndex + 1).padStart(2, '0')}.${extension}`;
      fs.copyFileSync(best.path, path.join(targetDir, filename));
      fs.rmSync(best.path, { force: true });
      report.push({ service, filename, status: 'saved', width: best.width, height: best.height, source: best.original });
    }
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
