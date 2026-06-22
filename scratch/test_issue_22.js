'use strict';

const { sanitizeArticleText } = require('../src/server/RssNewsArticleSanitizer');

const sampleBody = `이것은 정상적인 뉴스 본문입니다.

바로가기
복사하기

정상적인 문장이 이어집니다.`;

const result = sanitizeArticleText(sampleBody);
console.log('=== 원래 본문 ===');
console.log(sampleBody);
console.log('\n=== 정제된 본문 ===');
console.log(result);

if (result.includes('바로가기') || result.includes('복사하기')) {
  console.error('\n❌ 실패: "바로가기" 또는 "복사하기"가 걸러지지 않았습니다.');
  process.exit(1);
} else {
  console.log('\n✅ 성공: "바로가기"와 "복사하기" 라인이 정상적으로 제거되었습니다.');
}
