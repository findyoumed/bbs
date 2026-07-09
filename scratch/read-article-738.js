const http = require('http');

http.get('http://localhost:3000/api/services/news/1/738', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('=== 738번 기사 API 응답 데이터 ===');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('파싱 에러:', e.message);
      console.log('응답 내용 헤드:', data.slice(0, 200));
    }
  });
}).on('error', err => {
  console.error('서버 요청 에러:', err.message);
});
