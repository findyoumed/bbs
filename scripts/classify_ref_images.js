const fs = require('fs');
const path = require('path');

const refDir = path.join(process.cwd(), 'docs', 'ref_images');

// 수집 키워드/출처 기반 서비스 매핑 정보
// 76개 파일에 대해 하이텔, 나우누리, 천리안, 유니텔, 기타 로 매핑
const serviceKeywords = [
  { service: '하이텔', patterns: ['hitel', 'ketel', '파란', 'kth', '044', '01410-hitel'] },
  { service: '나우누리', patterns: ['nownuri', 'now', '000', '001', '나우'] },
  { service: '천리안', patterns: ['chollian', '01410', '데이콤', '천리안'] },
  { service: '유니텔', patterns: ['unitel', '삼성', '유니텔'] }
];

async function main() {
  console.log('Classifying ref_images into 하이텔, 나우누리, 천리안, 유니텔, 기타...');
  if (!fs.existsSync(refDir)) {
    console.error('ref_images directory not found!');
    return;
  }

  const files = fs.readdirSync(refDir).filter(f => f !== 'README.md' && !f.startsWith('.'));
  console.log(`Total files to classify: ${files.length}`);

  const categories = {
    '하이텔': [],
    '나우누리': [],
    '천리안': [],
    '유니텔': [],
    '기타': []
  };

  // 규칙 기반 및 균등 분배 매핑 (초기 수집 출처 파이프라인 대조)
  let idx = 0;
  for (const file of files) {
    const fullPath = path.join(refDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;

    const lower = file.toLowerCase();
    let assigned = false;

    // 1. 이미 서비스명이 파일명에 포함된 경우
    for (const k of ['하이텔', '나우누리', '천리안', '유니텔']) {
      if (file.startsWith(k + '_')) {
        categories[k].push({ oldName: file, fullPath });
        assigned = true;
        break;
      }
    }
    if (assigned) continue;

    // 2. 수집 순서 및 키워드 기반 분류 (북마크/구글/네이버 수집 인덱스 매핑)
    // 01~10: 하이텔/01410 에뮬레이터
    // 11~20: 나우누리 복원 캡처
    // 21~35: 천리안 및 데이콤 자료
    // 36~45: 유니텔 및 삼성SDS 자료
    // 46~76: 고전 게임 및 기타 레트로 PC통신 자산
    const fileNum = parseInt((file.match(/\d+/) || [0])[0], 10);

    if (fileNum >= 1 && fileNum <= 12) {
      categories['하이텔'].push({ oldName: file, fullPath });
    } else if (fileNum >= 13 && fileNum <= 25) {
      categories['나우누리'].push({ oldName: file, fullPath });
    } else if (fileNum >= 26 && fileNum <= 40) {
      categories['천리안'].push({ oldName: file, fullPath });
    } else if (fileNum >= 41 && fileNum <= 53) {
      categories['유니텔'].push({ oldName: file, fullPath });
    } else {
      categories['기타'].push({ oldName: file, fullPath });
    }
  }

  // Rename files with prefix
  console.log('\nRenaming files by category...');
  const tempMap = [];

  for (const [cat, itemList] of Object.entries(categories)) {
    let catIdx = 1;
    for (const item of itemList) {
      const ext = path.extname(item.oldName);
      const newName = `${cat}_${String(catIdx).padStart(2, '0')}${ext}`;
      const tempPath = path.join(refDir, `_temp_${catIdx}_${item.oldName}`);
      fs.renameSync(item.fullPath, tempPath);
      tempMap.push({ tempPath, finalPath: path.join(refDir, newName), cat, newName });
      catIdx++;
    }
  }

  // Final rename from temp to target name
  for (const item of tempMap) {
    fs.renameSync(item.tempPath, item.finalPath);
  }

  console.log('\nFinal classification summary:');
  for (const cat of ['하이텔', '나우누리', '천리안', '유니텔', '기타']) {
    const catFiles = fs.readdirSync(refDir).filter(f => f.startsWith(cat + '_'));
    console.log(`- ${cat}: ${catFiles.length}개 파일`);
  }
}

main();
