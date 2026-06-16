const fs = require('fs');
if (fs.existsSync('.env')) {
  const env = fs.readFileSync('.env', 'utf-8');
  env.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const RssNewsService = require('../src/server/RssNewsService');

async function test() {
  const service = new RssNewsService({
    newsMenuPath: 'legacy/news.mnu', // local path
  });
  
  const testCases = [
    {
      publisher: '경향신문',
      url: 'https://www.khan.co.kr/article/202606161151001/?utm_source=khan_rss&utm_medium=rss&utm_campaign=total_news',
      rssSummary: '16일 국회에서 열린 조국혁신당 의원총회에서 3기 원내대표 선거에 단독 입후보해 의원 12명의 만장일치로 당선된 김준형 신임 원내대표가 웃고 있다. 연합뉴스조국혁신당 새 원내대표가 된 김준형 의원이 16일 “정치공학과 권력투쟁의 맥락이라면 합당은 물론 어떤 연대도 거부한다”고 밝혔다.김 신임 원내대표는 이날 오전 열린 의원총회에서 “민주당에 비해 우리는 왜소하지만...'
    },
    {
      publisher: '동아일보',
      url: 'https://www.donga.com/news/Politics/article/all/20260616/128157048/1',
      rssSummary: '더불어민주당이 16일 국회 본회의를 열어 법사·운영위 등 11개 상임위원장 선출을 단행하려다 야당의 거센 반발로 무산되었습니다. 민주당 지도부는 협의 실패 시 단독 표결을 추진하겠다는 입장을 고수하고 있으며...'
    }
  ];

  console.log('=== STARTING POLICY COMPARISON TEST ===\n');

  for (const tc of testCases) {
    console.log(`[Target Publisher]: ${tc.publisher}`);
    console.log(`URL: ${tc.url}`);
    
    // --- Option A (Force RSS summary, Skip Crawling) ---
    console.log('\n--- Option A: Force RSS Summary ---');
    const startA = Date.now();
    const resultA = service._sanitizeArticleText(tc.rssSummary);
    const durationA = Date.now() - startA;
    console.log(`- Fetch & Parse Time: ${durationA}ms`);
    console.log(`- Final Body Length: ${resultA.length} chars`);
    console.log(`- Text Snippet: "${resultA.slice(0, 150)}..."`);
    
    // --- Option B (Crawl detail & check score/noise, fallback if needed) ---
    console.log('\n--- Option B: Crawl Detail with Strict Filtering ---');
    const startB = Date.now();
    let resultB = '';
    let usedSource = 'Detail Crawl';
    try {
      const detail = await service._fetchNewsArticleDetail(tc.url);
      const detailBody = service._sanitizeArticleText(detail.body);
      const isNoisy = service._isLikelyNoisyBody(detailBody);
      
      // Strict fallback: If noisy or length under 100 or contains any strict flags
      if (detail.unavailable || isNoisy || detailBody.length < 100) {
        resultB = service._sanitizeArticleText(tc.rssSummary);
        usedSource = 'RSS Fallback (Triggered by strict filter)';
      } else {
        resultB = detailBody;
      }
    } catch (err) {
      resultB = service._sanitizeArticleText(tc.rssSummary);
      usedSource = `RSS Fallback (Error: ${err.message})`;
    }
    const durationB = Date.now() - startB;
    console.log(`- Fetch & Parse Time: ${durationB}ms`);
    console.log(`- Source Selected: ${usedSource}`);
    console.log(`- Final Body Length: ${resultB.length} chars`);
    console.log(`- Text Snippet: "${resultB.slice(0, 150)}..."`);
    console.log('\n=========================================\n');
  }
}

test();
