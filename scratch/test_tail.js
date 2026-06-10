'use strict';

const fullText = `카오 노조가 10일 첫 부분 파업에 들어갔다. 카카오 창사 이래 첫 파업이다.

전국화학섬유식품산업노동조합 카카오지회는 이날 오전 10시부터 부분 파업에 돌입했으며 오후 3시까지 이뤄진다. 이날 부분 파업에 참여하는 법인은 카카오 본사와 카카오페이, 카카오엔터프라이즈, 디케이테크인, 엑스엘게임즈 등 5곳이다.
이날 정오부터 오후 1시까지는 휴식 시간이므로 총 4시간 동안 부분 파업이 이뤄지는 셈이다.
카카오 노조원들은 이날 성남 사옥인 판교아지트 일대를 행진할 예정이다.
이번 카카오 노조 파업은 성과급 보상 구조가 주된 이유로 꼽힌다.
허환주 기자`;

const patterns = [
  /RSS\s*피드는\s*개인\s*리더\s*이용\s*목적으로\s*허용[\s\S]*$/i,
  /(?:▶\s*)?이\s*기사의\s*전체\s*내용\s*확인하기[\s\S]*$/i,
  /(?:▶\s*)?SBS\s*뉴스\s*앱\s*다운로드[\s\S]*$/i,
  /(?:▶\s*)?뉴스에\s*지식을\s*담다\s*-\s*스브스프리미엄\s*앱\s*다운로드[\s\S]*$/i,
  /[ⓒ©]\s*SBS\s*&\s*SBS\s*i[\s\S]*$/i,
  /◎\s*공감언론\s*뉴시스[\s\S]*$/i,
  /\n{1,2}\s*[^\n]{0,40}기자\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i,
  /\n{1,2}\s*좋아요\s*\n\s*싫어요[\s\S]*$/i,
  /\n{1,2}\s*후속기사\s*원해요[\s\S]*$/i,
  /\n{1,2}\s*전체\s*내용보기[\s\S]*$/i,
  /\n{1,2}\s*기사\s*전체보기[\s\S]*$/i,
  /\n{1,2}\s*관련기사[\s\S]*$/i,
  /\n{1,2}\s*(?:독자들의\s*PICK!?|많이\s*본\s*(?:뉴스|기사)|실시간\s*인기\s*(?:뉴스|기사)|인기\s*(?:뉴스|기사)|추천\s*(?:뉴스|기사)|이\s*시각\s*추천\s*(?:뉴스|기사)|당신이\s*좋아할\s*만한\s*(?:뉴스|기사))[\s\S]*$/i,
  /\n{1,2}\s*\[뉴스리뷰\][\s\S]*$/i,
  /\n{1,2}\s*연합뉴스TV\s*기사문의\s*및\s*제보\s*:[\s\S]*$/i,
  /\n{1,2}\s*헬스조선을\s*만나는\s*또다른\s*방법[\s\S]*$/i,
  /\n{1,2}\s*PC버전[\s\S]*$/i,
  /\n{1,2}\s*맨위로\s*[↑↗↥]?\s*[\s\S]*$/i,
  /\n{1,2}\s*저작권자[\s\S]*$/i,
  /\n{1,2}\s*(?:한국경제|한경프리미엄9)\s*구독신청[\s\S]*$/i,
  /\n{1,2}\s*이\s*시각\s*관심정보[\s\S]*$/i,
  /\n{1,2}\s*ADVERTISEMENT[\s\S]*$/i,
  /\n{1,2}\s*AD\s*\n[\s\S]*$/i,
  /[ⓒ©][^\n]{0,120}무단\s*전재[\s\S]*$/i,
  /무단\s*전재[\s\S]*$/i,
  /무단\s*복제\s*(?:및\s*재배포)?\s*금지[\s\S]*$/i,
  /▲\s*$/i
];

const minTailIndex = Math.max(0, Math.floor(fullText.length * 0.15));
console.log('minTailIndex:', minTailIndex, 'fullText length:', fullText.length);

patterns.forEach((pattern) => {
  const match = fullText.match(pattern);
  if (match) {
    console.log('--- Matched Pattern:', pattern);
    console.log('Match index:', match.index);
    console.log('Is index >= minTailIndex?', match.index >= minTailIndex);
    if (match.index >= minTailIndex) {
      console.log('Cut text is:');
      console.log(fullText.slice(0, match.index));
      console.log('--- cut end ---');
    }
  }
});
