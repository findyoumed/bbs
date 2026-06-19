// Scratch: More comprehensive content check across all topics and pages
(async () => {
  const issues = [];
  
  // 1. 전체 토픽 description/body 깨진 엔티티 검사 (확장)
  for (let topic = 1; topic <= 11; topic++) {
    try {
      const res = await fetch(`http://localhost:3000/api/services/news/${topic}?page=1`);
      const d = await res.json();
      const items = d.data?.items || [];
      for (const item of items) {
        // title 중복 확인 (같은 번호에 다른 제목)
        const title = (item.title || '').trim();
        const author = (item.author || '').trim();
        
        // author에 HTML 태그 잔류
        if (/<[a-zA-Z][^>]*>/.test(author)) {
          issues.push({topic, no: item.no, type: 'author-html', value: author.slice(0,50)});
        }
        
        // 이미지 URL 깨짐 (상대경로 등)
        const img = (item.imageUrl || '').trim();
        if (img && !/^https?:\/\//i.test(img)) {
          issues.push({topic, no: item.no, type: 'bad-image-url', value: img.slice(0,80)});
        }
        
        // articleKey 누락
        if (!item.articleKey) {
          issues.push({topic, no: item.no, type: 'missing-articleKey', title: title.slice(0,40)});
        }
        
        // 날짜가 미래 (1일 이상)
        if (item.date) {
          const d = new Date(item.date);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (d > tomorrow) {
            issues.push({topic, no: item.no, type: 'future-date', value: item.date});
          }
        }
        
        // 제목에 연속 공백
        if (/  /.test(title)) {
          issues.push({topic, no: item.no, type: 'double-space', title: title.slice(0,50)});
        }
      }
    } catch(e) {
      issues.push({topic, type: 'fetch-error', msg: e.message});
    }
  }
  
  // 2. 날씨 데이터 검증
  try {
    const wRes = await fetch('http://localhost:3000/api/services/weather');
    const wData = await wRes.json();
    const regions = wData.data?.items || [];
    console.log(`Weather: ${regions.length} regions`);
    
    // 첫 3개 지역 상세 확인
    for (const region of regions.slice(0, 3)) {
      const rRes = await fetch(`http://localhost:3000/api/services/weather/${region.door}`);
      const rData = await rRes.json();
      const items = rData.data?.items || [];
      if (items.length === 0) {
        issues.push({type: 'weather-empty', door: region.door, title: region.title});
      }
    }
  } catch(e) {
    issues.push({type: 'weather-error', msg: e.message});
  }
  
  // 3. 게시판 글 검증
  try {
    const bRes = await fetch('http://localhost:3000/api/boards');
    const bData = await bRes.json();
    const boards = bData.data || [];
    console.log(`Boards: ${boards.length}`);
    
    for (const board of boards.slice(0, 3)) {
      const bid = board.id || board.board_id;
      if (!bid) continue;
      const pRes = await fetch(`http://localhost:3000/api/boards/${bid}/posts?page=1`);
      if (!pRes.ok) {
        issues.push({type: 'board-error', board: bid, status: pRes.status});
      }
    }
  } catch(e) {
    issues.push({type: 'board-error', msg: e.message});
  }
  
  console.log(`\n=== TOTAL ISSUES: ${issues.length} ===`);
  issues.forEach(i => console.log(JSON.stringify(i)));
})();
