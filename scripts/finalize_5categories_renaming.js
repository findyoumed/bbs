const fs = require('fs');
const path = require('path');

const refDir = path.join(process.cwd(), 'docs', 'ref_images');

async function main() {
  console.log('Finalizing 5-category file naming in docs/ref_images...');

  const files = fs.readdirSync(refDir).filter(f => f !== 'README.md' && !f.startsWith('.'));

  const categories = {
    '하이텔': [],
    '나우누리': [],
    '천리안': [],
    '유니텔': [],
    '기타': []
  };

  for (const f of files) {
    const fullPath = path.join(refDir, f);
    if (f.startsWith('하이텔_')) categories['하이텔'].push({ f, fullPath });
    else if (f.startsWith('나우누리_')) categories['나우누리'].push({ f, fullPath });
    else if (f.startsWith('천리안_')) categories['천리안'].push({ f, fullPath });
    else if (f.startsWith('유니텔_')) categories['유니텔'].push({ f, fullPath });
    else categories['기타'].push({ f, fullPath });
  }

  // Rename with sequential numbering per category
  for (const [catName, list] of Object.entries(categories)) {
    let idx = 1;
    for (const item of list) {
      const ext = path.extname(item.f);
      const newName = `${catName}_${String(idx).padStart(2, '0')}${ext}`;
      const tempPath = path.join(refDir, `_temp_${idx}_${item.f}`);
      fs.renameSync(item.fullPath, tempPath);
      item.tempPath = tempPath;
      item.finalPath = path.join(refDir, newName);
      idx++;
    }
  }

  // Move temp files to final names
  const allList = [].concat(...Object.values(categories));
  for (const item of allList) {
    if (fs.existsSync(item.tempPath)) {
      fs.renameSync(item.tempPath, item.finalPath);
    }
  }

  console.log('\nFinalized 5-Category file structure:');
  for (const catName of ['하이텔', '나우누리', '천리안', '유니텔', '기타']) {
    const catFiles = fs.readdirSync(refDir).filter(f => f.startsWith(catName + '_'));
    console.log(`- ${catName}_ : ${catFiles.length}개 파일 (${catFiles.join(', ')})`);
  }
}

main();
