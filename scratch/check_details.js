// Scratch: Test news article detail pages
(async () => {
  // 첫 번째 토픽에서 기사 3개 상세 조회 테스트
  const res = await fetch('http://localhost:3000/api/services/news/1?page=1');
  const d = await res.json();
  const items = (d.data?.items || []).slice(0, 5);
  
  console.log('=== Testing', items.length, 'article details ===\n');
  
  for (const item of items) {
    if (!item.articleKey) {
      console.log(`#${item.no}: NO articleKey`);
      continue;
    }
    try {
      const artRes = await fetch(`http://localhost:3000/api/services/news/1/article/${item.articleKey}`);
      const artData = await artRes.json();
      const detail = artData.data || {};
      
      const titleOK = detail.title ? '✓' : '✗';
      const bodyOK = detail.body ? `✓ (${detail.body.length} chars)` : '✗ empty';
      const status = artRes.status;
      
      console.log(`#${item.no} [${status}] title:${titleOK} body:${bodyOK} -- ${(item.title || '').slice(0, 50)}`);
      
      // body에 깨진 엔티티 있는지 확인
      const body = detail.body || '';
      if (/(?:amp|quot|apos|nbsp|middot|hellip|lsquo|rsquo|ldquo|rdquo|ndash|mdash);/i.test(body)) {
        console.log('  ⚠ BROKEN ENTITY in body!');
      }
    } catch (e) {
      console.log(`#${item.no}: FETCH ERROR - ${e.message}`);
    }
  }
  
  // 날씨 상세도 확인
  console.log('\n=== Testing weather detail ===');
  try {
    const wRes = await fetch('http://localhost:3000/api/services/weather/1');
    const wData = await wRes.json();
    const items = wData.data?.items || [];
    console.log(`Weather region 1: ${wRes.status}, ${items.length} items`);
    if (items.length > 0) {
      console.log('Sample:', JSON.stringify(items[0]));
    }
  } catch (e) {
    console.log('Weather ERROR:', e.message);
  }
  
  // 게시판 목록 확인
  console.log('\n=== Testing board endpoints ===');
  try {
    const bRes = await fetch('http://localhost:3000/api/boards');
    const bData = await bRes.json();
    const boards = bData.data || bData.boards || [];
    console.log(`Boards: ${bRes.status}, ${Array.isArray(boards) ? boards.length : 'N/A'} boards`);
    
    // 첫 게시판 글 목록
    if (Array.isArray(boards) && boards.length > 0) {
      const firstBoard = boards[0];
      const bid = firstBoard.id || firstBoard.board_id || firstBoard.door;
      if (bid) {
        const pRes = await fetch(`http://localhost:3000/api/boards/${bid}/posts?page=1`);
        console.log(`Board ${bid} posts: ${pRes.status}`);
      }
    }
  } catch (e) {
    console.log('Board ERROR:', e.message);
  }
})();
