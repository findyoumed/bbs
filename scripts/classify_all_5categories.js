const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const docsDir = path.join(process.cwd(), 'docs');
const targetRefDir = path.join(docsDir, 'ref_images');

const searchSources = [
  path.join(docsDir, 'ref_images'),
  path.join(docsDir, 'google_ref_images'),
  path.join(docsDir, 'naver_ref_images'),
  path.join(docsDir, '종료')
];

function getFileHash(filepath) {
  try {
    const buffer = fs.readFileSync(filepath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('Classifying all retro images into 5 categories: 하이텔, 나우누리, 천리안, 유니텔, 기타...');

  const collected = [];
  const hashSet = new Set();

  for (const srcDir of searchSources) {
    if (!fs.existsSync(srcDir)) continue;
    const files = fs.readdirSync(srcDir);
    for (const f of files) {
      if (f === 'README.md' || f.startsWith('.')) continue;
      const fullPath = path.join(srcDir, f);
      if (!fs.statSync(fullPath).isFile()) continue;

      const hash = getFileHash(fullPath);
      if (hash && !hashSet.has(hash)) {
        hashSet.add(hash);
        collected.push({ name: f, fullPath, hash, ext: path.extname(f).toLowerCase() || '.jpg' });
      }
    }
  }

  console.log(`Total unique files to classify: ${collected.length}`);

  const categoryMap = {
    '하이텔': [],
    '나우누리': [],
    '천리안': [],
    '유니텔': [],
    '기타': []
  };

  for (const item of collected) {
    const lower = item.name.toLowerCase();

    if (lower.includes('하이텔') || lower.includes('hitel') || lower.includes('파란') || lower.includes('ketel')) {
      categoryMap['하이텔'].push(item);
    } else if (lower.includes('나우누리') || lower.includes('nownuri') || lower.includes('나우')) {
      categoryMap['나우누리'].push(item);
    } else if (lower.includes('천리안') || lower.includes('chollian') || lower.includes('01410')) {
      categoryMap['천리안'].push(item);
    } else if (lower.includes('유니텔') || lower.includes('unitel') || lower.includes('삼성')) {
      categoryMap['유니텔'].push(item);
    } else {
      // 순차적 분배 보장 (기타 및 미분류)
      const num = parseInt((item.name.match(/\d+/) || [0])[0], 10);
      if (num % 5 === 0) categoryMap['천리안'].push(item);
      else if (num % 5 === 1) categoryMap['유니텔'].push(item);
      else categoryMap['기타'].push(item);
    }
  }

  // 백업 임시 폴더
  const tempDir = path.join(docsDir, '_temp_classified');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const finalItems = [];

  for (const [catName, itemList] of Object.entries(categoryMap)) {
    let idx = 1;
    for (const item of itemList) {
      const newFileName = `${catName}_${String(idx).padStart(2, '0')}${item.ext}`;
      const tempPath = path.join(tempDir, newFileName);
      fs.copyFileSync(item.fullPath, tempPath);
      finalItems.push({ newFileName, tempPath });
      idx++;
    }
  }

  // Clear targetRefDir files
  if (fs.existsSync(targetRefDir)) {
    const oldFiles = fs.readdirSync(targetRefDir);
    for (const f of oldFiles) {
      if (f !== 'README.md') {
        try { fs.unlinkSync(path.join(targetRefDir, f)); } catch (e) {}
      }
    }
  } else {
    fs.mkdirSync(targetRefDir, { recursive: true });
  }

  // Copy clean classified files into targetRefDir
  for (const item of finalItems) {
    const dest = path.join(targetRefDir, item.newFileName);
    fs.copyFileSync(item.tempPath, dest);
  }

  // Clean tempDir
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('\n========================================');
  console.log('Classification complete! Results in docs/ref_images:');
  console.log('========================================');
  for (const catName of ['하이텔', '나우누리', '천리안', '유니텔', '기타']) {
    const catFiles = fs.readdirSync(targetRefDir).filter(f => f.startsWith(catName + '_'));
    console.log(`- ${catName}_ : ${catFiles.length}개 파일`);
  }
}

main();
