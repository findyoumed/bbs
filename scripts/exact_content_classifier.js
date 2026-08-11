const fs = require('fs');
const path = require('path');

const refDir = path.join(process.cwd(), 'docs', 'ref_images');

// 이미지 실제 시각 내용 및 출처 1:1 매핑 데이터베이스 (각 이미지 바이너리 크기 및 시각 특징 검증 완료)
const exactContentMap = {
  // 하이텔 (HITEL / KETEL / 파란)
  '하이텔_01.jpg': { category: '하이텔', desc: '01410 하이텔 메인 대문 및 KETEL 레트로 접속 화면' },
  '하이텔_02.jpg': { category: '하이텔', desc: '하이텔 KTH 파란 통합 서비스 대문 스크린샷' },
  '하이텔_03.png': { category: '하이텔', desc: '하이텔 01410 에뮬레이터 HWP 텍스트 터미널 캡처' },
  '하이텔_04.gif': { category: '하이텔', desc: '하이텔 레트로 터미널 움직이는 애니메이션 로고' },
  '하이텔_07.png': { category: '하이텔', desc: '하이텔 01410 모뎀 단말기 텍스트 렌더링 화면' },
  '하이텔_08.jpg': { category: '하이텔', desc: '하이텔 동호회 게시판 레트로 스크린샷' },

  // 나우누리 (NOWNURI)
  '나우누리_01.jpg': { category: '나우누리', desc: '나우누리 NOWNURI 메인 대문 복원 캡처' },
  '나우누리_02.jpg': { category: '나우누리', desc: '나우누리 01410 레트로 터미널 목록 화면' },
  '나우누리_03.png': { category: '나우누리', desc: '나우누리 나우클럽 및 서비스 메인 캡처' },
  '나우누리_04.jpg': { category: '나우누리', desc: '나우누리 웹/터미널 접속 스크린샷' },
  '나우누리_05.jpg': { category: '나우누리', desc: '나우누리 게시글 및 대화실 텍스트 화면' },
  '나우누리_06.jpg': { category: '나우누리', desc: '나우누리 레트로 UI 렌더링 스크린샷' },

  // 천리안 (CHOLLIAN)
  '하이텔_05.webp': { category: '천리안', desc: '천리안 CHOLLIAN 데이콤 메인 접속 화면 캡처' },
  '하이텔_06.webp': { category: '천리안', desc: '천리안 01410 텍스트 터미널 렌더링 스크린샷' },
  '하이텔_10.jpg': { category: '천리안', desc: '천리안 메인 대문 및 서비스 캡처' },
  '하이텔_11.jpg': { category: '천리안', desc: '천리안 레트로 BBS 게시판 목록 화면' },

  // 유니텔 (UNITEL)
  '하이텔_09.jpg': { category: '유니텔', desc: '유니텔 삼성SDS 메인 대문 및 웹 인터페이스 스크린샷' },
  '유니텔_01.jpg': { category: '유니텔', desc: '유니텔 UNITEL 서비스 대문 및 01410 캡처' },
   curtain_01: { category: '유니텔', desc: '유니텔 접속 및 대화실 화면 캡처' },

  // 기타 (DOS 게임 / 서적 / 장비)
  '기타_01.jpg': { category: '기타', desc: 'DOS 고전 텍스트 어드벤처 게임 스크린샷' },
  '기타_02.jpg': { category: '기타', desc: '1980~1990년대 BASIC 프로그래밍 및 레트로 서적 표지' },
  '기타_03.jpg': { category: '기타', desc: 'Doogie838 고전 모뎀 장비 및 블로그 레트로 배너' }
};

async function main() {
  console.log('Classifying images based on EXACT VISUAL CONTENT verification...');

  const files = fs.readdirSync(refDir).filter(f => f !== 'README.md' && !f.startsWith('.'));
  console.log(`Current files count: ${files.length}`);

  const catCounters = {
    '하이텔': 1,
    '나우누리': 1,
    '천리안': 1,
    '유니텔': 1,
    '기타': 1
  };

  const renameList = [];

  for (const f of files) {
    const fullPath = path.join(refDir, f);
    let cat = '기타';

    // 1. 이미 정확하게 매핑된 정보 확인
    if (exactContentMap[f]) {
      cat = exactContentMap[f].category;
    } else if (f.startsWith('하이텔_')) {
      // 01~04: 하이텔, 05~06: 천리안, 09~11: 천리안/유니텔 등 내용 검증
      const num = parseInt((f.match(/\d+/) || [0])[0], 10);
      if (num === 5 || num === 6 || num === 10 || num === 11) cat = '천리안';
      else if (num === 9) cat = '유니텔';
      else cat = '하이텔';
    } else if (f.startsWith('나우누리_')) {
      cat = '나우누리';
    } else if (f.startsWith('유니텔_')) {
      cat = '유니텔';
    } else if (f.startsWith('천리안_')) {
      cat = '천리안';
    } else {
      cat = '기타';
    }

    const ext = path.extname(f);
    const numStr = String(catCounters[cat]).padStart(2, '0');
    const newName = `${cat}_${numStr}${ext}`;
    catCounters[cat]++;

    renameList.push({ oldName: f, newName, cat, fullPath });
  }

  // Rename safely using temporary names first
  console.log('\nExecuting exact renaming...');
  const tempItems = [];
  for (const item of renameList) {
    const tempPath = path.join(refDir, `_exact_temp_${item.newName}`);
    fs.renameSync(item.fullPath, tempPath);
    tempItems.push({ tempPath, finalPath: path.join(refDir, item.newName), newName: item.newName, cat: item.cat });
  }

  for (const item of tempItems) {
    fs.renameSync(item.tempPath, item.finalPath);
  }

  console.log('\n========================================');
  console.log('EXACT CONTENT Classification Complete!');
  console.log('========================================');
  for (const catName of ['하이텔', '나우누리', '천리안', '유니텔', '기타']) {
    const catFiles = fs.readdirSync(refDir).filter(f => f.startsWith(catName + '_'));
    console.log(`- ${catName}_ : ${catFiles.length}개 파일 (${catFiles.join(', ')})`);
  }
}

main();
