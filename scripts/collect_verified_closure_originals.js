// LOG_ID: 20260811_1658
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');

const root = process.cwd();
const targetDir = path.join(root, 'docs', '종료', '검증된_대형원본_4서비스');
const tempDir = path.join(targetDir, '.tmp');
fs.mkdirSync(targetDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

const manifestPath = path.join(root, 'docs', '종료_candidates', 'manifest.json');
const selections = {
  나우누리: ['나우누리_01.jpg'],
  천리안: ['천리안_01.jpg', '천리안_02.jpg', '천리안_03.jpg', '천리안_04.jpg', '천리안_05.jpg', '천리안_06.jpg'],
  유니텔: ['유니텔_01.jpg', '유니텔_02.jpg', '유니텔_03.jpg']
};
const directHitel = [
  'http://blogfiles.naver.net/20130714_225/yonggarri_13738088026508K6Q8_JPEG/2.jpg'
];
const directNownuri = [
  'https://i.namu.wiki/i/bjlNyvQpWDteSAkEXQnKqc6BN-JAodqO-XcvynjvlD_XaM31aHaBr04f1BRHJouC_Nv02iwD-xrgE--63I2Ny9-bIwWAYrKw7NbMVwfC93rQlZhCW5XvbXQlMSwKB3gXEQBFsaR51i3nHHwS-T0vzcUJVvnAc--R_cO9SMePnxUiFktfxJ3qPr9jFWWVPI5jIgTtBBjhiv6EjQuin8ly70_iWnddTDgPxN_Aztv5tWW-b9S_e7WzUYHV545oZ4lStgbxLSNM4ZmvJUDiBOIs9IXje_NkHg5V9Z3ZE8C2eHF4jF902HkXlyxT69ckO32L.png'
];

function sourceFrom(url) {
  try {
    return new URL(url).searchParams.get('src') || url;
  } catch (_) {
    return url;
  }
}

function download(url, destination) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch (_) { resolve(false); return; }
    const transport = parsed.protocol === 'https:' ? https : http;
    const options = { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 };
    if (parsed.protocol === 'https:' && /(?:naver\.net|pstatic\.net)$/.test(parsed.hostname)) options.rejectUnauthorized = false;
    const request = transport.get(parsed, options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(download(new URL(response.headers.location, parsed).toString(), destination));
        return;
      }
      if (response.statusCode !== 200) { response.resume(); resolve(false); return; }
      const stream = fs.createWriteStream(destination);
      response.pipe(stream);
      stream.on('finish', () => stream.close(() => resolve(true)));
      stream.on('error', () => resolve(false));
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

async function saveBest(service, number, urls, report) {
  let best = null;
  for (const [index, candidate] of urls.entries()) {
    const tempPath = path.join(tempDir, `${service}-${number}-${index}`);
    if (!(await download(candidate, tempPath))) continue;
    try {
      const metadata = await sharp(tempPath).metadata();
      const pixels = (metadata.width || 0) * (metadata.height || 0);
      if (!best || pixels > best.pixels) {
        if (best) fs.rmSync(best.path, { force: true });
        best = { path: tempPath, pixels, width: metadata.width, height: metadata.height, format: metadata.format, source: candidate };
      } else fs.rmSync(tempPath, { force: true });
    } catch (_) { fs.rmSync(tempPath, { force: true }); }
  }
  if (!best) { report.push({ service, number, status: 'download-failed' }); return; }
  const extension = best.format === 'png' ? 'png' : best.format === 'gif' ? 'gif' : 'jpg';
  const filename = `${service}_종료공지_${String(number).padStart(2, '0')}.${extension}`;
  fs.copyFileSync(best.path, path.join(targetDir, filename));
  fs.rmSync(best.path, { force: true });
  report.push({ service, filename, status: 'saved', width: best.width, height: best.height, source: best.source });
}

async function main() {
  const report = [];
  await saveBest('하이텔', 1, directHitel, report);
  await saveBest('나우누리', 2, directNownuri, report);
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  for (const [service, files] of Object.entries(selections)) {
    for (const [index, file] of files.entries()) {
      const row = manifest.find((item) => item.file === file);
      if (!row) { report.push({ service, number: index + 1, status: 'manifest-missing', file }); continue; }
      const original = sourceFrom(row.imageUrl);
      await saveBest(service, index + 1, [original, original.replace(/^http:/, 'https:'), row.imageUrl], report);
    }
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
