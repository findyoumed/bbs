const http = require('http');

// 3002 포트로 뉴스 목록 API 호출 시도
http.get('http://localhost:3002/api/news/topic?door=1&page=1', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      const items = result.items || [];
      console.log('총 기사 개수:', items.length);
      
      const targetNo = 532;
      const targetIdx = items.findIndex(item => Number(item.no) === targetNo);
      console.log(`\n=== 532번 기사 위치 진단 ===`);
      console.log('532번 인덱스:', targetIdx);
      
      const start = Math.max(0, targetIdx - 3);
      const end = Math.min(items.length, targetIdx + 4);
      
      console.log('\n--- 주변 기사 리스트 ---');
      for (let i = start; i < end; i++) {
        if (items[i]) {
          console.log(`인덱스 [${i}]: 기사번호 ${items[i].no} - ${items[i].title.slice(0, 30)}`);
        }
      }
    } catch (e) {
      console.error('파싱 에러:', e.message);
      console.log('응답 내용 헤드:', data.slice(0, 100));
    }
  });
}).on('error', err => {
  console.error('서버 요청 에러:', err.message);
});
