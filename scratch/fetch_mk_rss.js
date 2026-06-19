// Scratch: Fetch MK RSS and find the matching item
const fs = require('fs');

(async () => {
  try {
    const res = await fetch('https://www.mk.co.kr/rss/30000001/');
    // 매일경제 RSS는 EUC-KR 인코딩일 가능성이 있습니다. ArrayBuffer로 받아서 디코딩 해보겠습니다.
    const buffer = await res.arrayBuffer();
    
    // Node.js iconv-lite가 설치되어 있으면 편하지만 기본 text()로도 한글이 잘 읽히는지 봅니다.
    // 만약 EUC-KR이라면 UTF-8로 잘못 디코딩될 경우 깨질 수 있으므로, euc-kr을 처리해야 합니다.
    const decoder = new TextDecoder('euc-kr');
    let xmlText = decoder.decode(buffer);
    
    // 만약 한글이 깨진다면 utf-8로도 시도해봅니다.
    if (xmlText.includes('')) {
      const utfDecoder = new TextDecoder('utf-8');
      xmlText = utfDecoder.decode(buffer);
    }
    
    console.log('XML snippet length:', xmlText.length);
    fs.writeFileSync('scratch/mk_rss.xml', xmlText, 'utf-8');
    
    // "윤두준" 검색
    const idx = xmlText.indexOf('윤두준');
    if (idx !== -1) {
      console.log('Found "윤두준" in RSS! Snippet:');
      console.log(xmlText.slice(Math.max(0, idx - 200), idx + 300));
    } else {
      console.log('Could not find "윤두준" in current RSS feed XML.');
    }
  } catch (err) {
    console.error('Error fetching RSS:', err);
  }
})();
