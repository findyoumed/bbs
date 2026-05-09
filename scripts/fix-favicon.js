const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const faviconPath = path.join(__dirname, '../public/favicon.png');
const tempPath = path.join(__dirname, '../public/favicon_temp.png');

async function fixFavicon() {
    try {
        console.log('작업 시작: 원본 디자인 유지 및 배경색 합성 중...');
        
        // 1. 기존 이미지를 읽어 하얀색(#FFFFFF) 배경과 합성 (flatten)
        await sharp(faviconPath)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .toFile(tempPath);
        
        // 2. 임시 파일을 원본 파일로 덮어쓰기
        fs.copyFileSync(tempPath, faviconPath);
        fs.unlinkSync(tempPath);
        
        console.log('✅ 성공: favicon.png가 꽉 찬 흰색 배경으로 수정되었습니다.');
    } catch (err) {
        console.error('❌ 실패:', err.message);
        process.exit(1);
    }
}

fixFavicon();
