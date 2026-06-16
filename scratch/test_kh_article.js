const RssNewsService = require('../src/server/RssNewsService');

async function test() {
  const service = new RssNewsService({
    newsMenuPath: 'legacy/news.mnu', // local path
  });
  
  // Mobile URL for the same Kyunghyang article
  const mobileUrl = 'https://m.khan.co.kr/view.html?art_id=202606161151001';
  try {
    console.log('Fetching mobile detail from:', mobileUrl);
    const detail = await service._fetchNewsArticleDetail(mobileUrl);
    console.log('Parsed Title:', detail.title);
    
    console.log('--- ALL EXTRACTED LINES FROM MOBILE RAW ---');
    const rawLines = detail.body.split('\n');
    rawLines.forEach((line, idx) => {
      console.log(`[RAW LINE ${idx}]: "${line}"`);
    });
    
    console.log('--- SANITIZED MOBILE BODY ---');
    const sanitized = service._sanitizeArticleText(detail.body);
    const sanitizedLines = sanitized.split('\n');
    sanitizedLines.forEach((line, idx) => {
      console.log(`[SAN LINE ${idx}]: "${line}"`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
