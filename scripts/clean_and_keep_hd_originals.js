const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), 'docs', '종료');
const subDir = path.join(targetDir, '원본_공지');

// 최상위 HD 원본 파일 목록
const hdFilesToKeep = [
  { src: path.join(subDir, '나우누리_2013년_서비스종료_선명한고화질공지.png'), name: '나우누리_2013년_서비스종료_공식공지_HD.png' },
  { src: path.join(subDir, '나우누리_종료공지_고화질_01.jpg'), name: '나우누리_서비스종료_메인화면_HD.jpg' },
  { src: path.join(subDir, '하이텔_서비스종료_파란공지.jpg'), name: '하이텔_파란_서비스종료_공식공지_HD.jpg' },
  { src: path.join(subDir, '천리안_01410_종료공지_고화질.png'), name: '천리안_01410_서비스종료_공식공지_HD.png' },
  { src: path.join(subDir, '유니텔_종료공지_고화질.jpg'), name: '유니텔_PC통신_서비스종료_공식공지_HD.jpg' }
];

async function main() {
  console.log('Cleaning up docs/종료 and keeping only 100% TRUE HD Original images...');

  // Move HD files to root docs/종료
  for (const item of hdFilesToKeep) {
    if (fs.existsSync(item.src)) {
      const dest = path.join(targetDir, item.name);
      fs.copyFileSync(item.src, dest);
      console.log(`Copied HD file: ${item.name} (${fs.statSync(dest).size} bytes)`);
    }
  }

  // Remove subDir
  if (fs.existsSync(subDir)) {
    fs.rmSync(subDir, { recursive: true, force: true });
  }

  // Remove old low-res files in targetDir
  const existingFiles = fs.readdirSync(targetDir);
  for (const f of existingFiles) {
    if (!f.endsWith('_HD.png') && !f.endsWith('_HD.jpg') && f !== 'README.md') {
      try { fs.unlinkSync(path.join(targetDir, f)); } catch (e) {}
    }
  }

  const finalFiles = fs.readdirSync(targetDir);
  console.log('\nFinal HD original files in docs/종료:');
  for (const f of finalFiles) {
    if (f === 'README.md') continue;
    const stat = fs.statSync(path.join(targetDir, f));
    console.log(`- ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

main();
