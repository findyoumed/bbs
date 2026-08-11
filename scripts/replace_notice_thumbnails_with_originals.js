// LOG_ID: 20260811_1623
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const sharp = require('sharp');

const candidateDir = path.join(process.cwd(), 'docs', '종료_candidates');
const manifestPath = path.join(candidateDir, 'manifest.json');
const hitelManifestPath = path.join(candidateDir, 'hitel_manifest.json');
const targetDir = path.join(process.cwd(), 'docs', '종료', '원본_공지');
const selected = {
  '나우누리_01.jpg': '나우누리_서비스종료_메인공지.jpg',
  '나우누리_05.jpg': '나우누리_서비스종료_공식공지.jpg',
  '천리안_01.jpg': '천리안_서비스종료_공식공지.jpg',
  '천리안_03.jpg': '천리안_서비스종료_상세공지.jpg',
  '유니텔_01.jpg': '유니텔_서비스종료_공식공지.jpg',
  '유니텔_02.jpg': '유니텔_서비스종료_상세공지.jpg',
  '하이텔_파란_01.jpg': '하이텔_서비스종료_파란공지.png',
  '하이텔_파란_02.jpg': '하이텔_서비스종료_데이터이전.png'
};
const forceReplace = new Set(['하이텔_파란_01.jpg', '하이텔_파란_02.jpg']);

function getOriginalUrl(imageUrl) {
  try {
    const parsed = new URL(imageUrl);
    return parsed.searchParams.get('src') || imageUrl;
  } catch (_) {
    return imageUrl;
  }
}

function download(url, destination) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;
      const req = transport.get(parsed, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, parsed).toString();
          res.resume();
          resolve(download(next, destination));
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve(false); return; }
        const stream = fs.createWriteStream(destination);
        res.pipe(stream);
        stream.on('finish', () => stream.close(() => resolve(true)));
        stream.on('error', () => resolve(false));
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch (_) { resolve(false); }
  });
}

async function main() {
  const manifest = [manifestPath, hitelManifestPath]
    .filter((filePath) => fs.existsSync(filePath))
    .flatMap((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')));
  const tempDir = path.join(process.cwd(), 'docs', '종료_original_tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const result = [];
  for (const [sourceName, targetName] of Object.entries(selected)) {
    const row = manifest.find((item) => item.file === sourceName);
    if (!row) { result.push({ targetName, status: 'manifest-missing' }); continue; }
    const original = getOriginalUrl(row.imageUrl);
    const tempPath = path.join(tempDir, targetName);
    const candidates = [original, original.replace(/^http:/, 'https:')];
    let downloaded = false;
    for (const url of candidates) {
      if (await download(url, tempPath)) { downloaded = true; break; }
    }
    if (!downloaded) { result.push({ targetName, status: 'original-unavailable', original }); continue; }
    try {
      const originalMeta = await sharp(tempPath).metadata();
      const currentPath = path.join(targetDir, targetName);
      const currentMeta = await sharp(currentPath).metadata();
      const originalPixels = (originalMeta.width || 0) * (originalMeta.height || 0);
      const currentPixels = (currentMeta.width || 0) * (currentMeta.height || 0);
      if (forceReplace.has(sourceName) || originalPixels > currentPixels) {
        const ext = originalMeta.format === 'png' ? '.png' : originalMeta.format === 'webp' ? '.webp' : '.jpg';
        const finalName = path.basename(targetName, path.extname(targetName)) + ext;
        const finalPath = path.join(targetDir, finalName);
        fs.copyFileSync(tempPath, finalPath);
        if (finalPath !== currentPath && fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
        result.push({ targetName: finalName, status: 'replaced', width: originalMeta.width, height: originalMeta.height, original });
      } else {
        result.push({ targetName, status: 'not-larger', width: originalMeta.width, height: originalMeta.height, original });
      }
    } catch (error) {
      result.push({ targetName, status: 'invalid-original', error: error.message, original });
    }
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
