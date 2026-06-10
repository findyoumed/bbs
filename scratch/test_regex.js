'use strict';

const testStrings = [
  "퇴직 후 뭘로 먹고 살아야 할까, 신간 <월급 받는 '직장인'에서…>",
  "일장기에 그려진 <b>검은 X</b>...한국 예로 들며 처벌하겠다는 일본",
  "[속보] <strong>카카오 노조</strong>, '성과급 보상' 이유로 10일 창사 이래 첫 파업 돌입",
  "Normal Title without any tags or brackets",
  "Title with <invalid tag like < 5 but starts with space>"
];

const regexOld = /<[^>]+>/g;
const regexNew = /<[a-zA-Z/!][^>]*>/g;

console.log('--- Old Regex Test ---');
testStrings.forEach((s) => {
  console.log(`Input:  "${s}"`);
  console.log(`Output: "${s.replace(regexOld, '')}"`);
});

console.log('\n--- New Regex Test ---');
testStrings.forEach((s) => {
  console.log(`Input:  "${s}"`);
  console.log(`Output: "${s.replace(regexNew, '')}"`);
});
