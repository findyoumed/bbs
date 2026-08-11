const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const targetDir = path.join(process.cwd(), 'docs', 'ref_images');
const sourceDir = path.join(process.cwd(), 'docs', 'naver_ref_images');
const MIN_WIDTH = 160;
const MIN_HEIGHT = 100;

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function extensionForFormat(format, fallback) {
  const map = { jpeg: '.jpg', jpg: '.jpg', png: '.png', webp: '.webp', gif: '.gif', avif: '.avif' };
  return map[format] || fallback || '.jpg';
}

async function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const hashes = new Set();
  for (const file of fs.readdirSync(targetDir)) {
    const fullPath = path.join(targetDir, file);
    if (fs.statSync(fullPath).isFile() && file !== 'README.md') {
      hashes.add(hashFile(fullPath));
    }
  }

  const existingNumbers = fs.readdirSync(targetDir)
    .map((file) => /^ref_image_(\d+)\./.exec(file))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  let nextNumber = Math.max(0, ...existingNumbers) + 1;
  const summary = { downloaded: 0, added: 0, duplicate: 0, small: 0, invalid: 0, addedFiles: [] };

  for (const file of fs.readdirSync(sourceDir).sort()) {
    const sourcePath = path.join(sourceDir, file);
    if (!fs.statSync(sourcePath).isFile()) continue;
    summary.downloaded += 1;

    let metadata;
    try {
      metadata = await sharp(sourcePath).metadata();
    } catch (_) {
      summary.invalid += 1;
      continue;
    }
    if ((metadata.width || 0) < MIN_WIDTH || (metadata.height || 0) < MIN_HEIGHT) {
      summary.small += 1;
      continue;
    }

    const hash = hashFile(sourcePath);
    if (hashes.has(hash)) {
      summary.duplicate += 1;
      continue;
    }

    const ext = extensionForFormat(metadata.format, path.extname(file).toLowerCase());
    const destinationName = `ref_image_${String(nextNumber).padStart(3, '0')}${ext}`;
    const destinationPath = path.join(targetDir, destinationName);
    fs.copyFileSync(sourcePath, destinationPath);
    hashes.add(hash);
    summary.added += 1;
    summary.addedFiles.push(`${destinationName} (${metadata.width}x${metadata.height})`);
    nextNumber += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
