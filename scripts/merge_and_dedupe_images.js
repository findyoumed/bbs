const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDocsDir = path.join(process.cwd(), 'docs');
const targetDir = path.join(baseDocsDir, 'ref_images');
const sourceDirs = [
  path.join(baseDocsDir, 'ref_images'),
  path.join(baseDocsDir, 'google_ref_images'),
  path.join(baseDocsDir, 'naver_ref_images')
];

function getFileHash(filepath) {
  try {
    const buffer = fs.readFileSync(filepath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (e) {
    return null;
  }
}

function safeRemoveFile(file) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (e) {}
}

function safeRemoveDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
          safeRemoveDir(p);
        } else {
          safeRemoveFile(p);
        }
      }
      fs.rmdirSync(dir);
    }
  } catch (e) {}
}

async function main() {
  console.log('Starting image merge and SHA-256 deduplication...');

  const tempBackupDir = path.join(baseDocsDir, '_temp_merge');
  if (!fs.existsSync(tempBackupDir)) {
    fs.mkdirSync(tempBackupDir, { recursive: true });
  } else {
    safeRemoveDir(tempBackupDir);
    fs.mkdirSync(tempBackupDir, { recursive: true });
  }

  const hashSet = new Set();
  const uniqueFiles = [];

  // Collect all images across directories
  for (const srcDir of sourceDirs) {
    if (!fs.existsSync(srcDir)) continue;
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
      if (file === 'README.md' || file.startsWith('.')) continue;
      const fullPath = path.join(srcDir, file);
      if (!fs.statSync(fullPath).isFile()) continue;

      const hash = getFileHash(fullPath);
      if (hash && !hashSet.has(hash)) {
        hashSet.add(hash);
        const ext = path.extname(file).toLowerCase() || '.jpg';
        uniqueFiles.push({ fullPath, ext, hash });
      }
    }
  }

  console.log(`Total unique images found by SHA-256: ${uniqueFiles.length}`);

  // Copy unique files to temp backup
  let idx = 1;
  const newRefFiles = [];
  for (const item of uniqueFiles) {
    const newName = `ref_image_${String(idx).padStart(3, '0')}${item.ext}`;
    const destPath = path.join(tempBackupDir, newName);
    fs.copyFileSync(item.fullPath, destPath);
    newRefFiles.push({ name: newName, path: destPath });
    idx++;
  }

  // Clear existing target directory files
  if (fs.existsSync(targetDir)) {
    const targetFiles = fs.readdirSync(targetDir);
    for (const tf of targetFiles) {
      if (tf !== 'README.md') {
        safeRemoveFile(path.join(targetDir, tf));
      }
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Move back from temp backup to docs/ref_images
  for (const item of newRefFiles) {
    const dest = path.join(targetDir, item.name);
    fs.copyFileSync(item.path, dest);
  }

  // Remove temporary folders
  safeRemoveDir(path.join(baseDocsDir, 'google_ref_images'));
  safeRemoveDir(path.join(baseDocsDir, 'naver_ref_images'));
  safeRemoveDir(tempBackupDir);

  console.log(`Successfully merged ${newRefFiles.length} unique images into docs/ref_images.`);
}

main();
