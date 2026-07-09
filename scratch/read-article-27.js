// 기사 27번의 실제 텍스트 형태 진단 스크립트
const path = require('path');
const { loadEnvFile, createAppServices } = require('../src/server/createAppServices');

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  // loadEnvFile(rootDir);
  
  const services = createAppServices(rootDir, process.env);
  const { rssService } = services;
  
  try {
    // topic '1'의 27번 기사를 로드
    // 기사 상세 내용을 가져옴 (캐시 우회는 안함, 현재 캐시된 내용을 그대로 가져옴)
    const result = await rssService.getNewsArticle('1', '27');
    console.log('=== ARTICLE 27 INFO ===');
    console.log('Title:', result.article?.title);
    console.log('=== BODY CONTENT ===');
    console.log(result.article?.body);
    console.log('====================');
    
    // 만약 "구글에서 선호하는 매체"와 유사한 문구가 있다면 그 부분만 추출
    const body = result.article?.body || '';
    const match = body.match(/[^\n]*구글[^\n]*/gi);
    if (match) {
      console.log('Matched Jaso Lines:');
      console.log(match);
      console.log('Hex representation of match:');
      for (const line of match) {
        const hex = Array.from(line).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
        console.log(`"${line}" -> ${hex}`);
      }
    } else {
      console.log('No matches for "구글" found in the body!');
    }
  } catch (error) {
    console.error('Error fetching article 27:', error);
  }
}

run();
