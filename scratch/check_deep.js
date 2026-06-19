// Scratch: Deep edge-case and routing tests
(async () => {
  const issues = [];
  
  function report(category, detail) {
    issues.push({ category, ...detail });
  }

  // ========== 1. 라우팅 엣지 케이스 ==========
  const routeTests = [
    // Clean URL 라우팅
    { name: 'Root', url: '/', expectStatus: 200 },
    { name: 'News service', url: '/service/news/1', expectStatus: 200 },
    { name: 'Weather service', url: '/service/weather', expectStatus: 200 },
    { name: 'Signup', url: '/signup', expectStatus: 200 },
    { name: 'Chat', url: '/chat', expectStatus: 200 },
    // 존재하지 않는 라우트 (SPA fallback 때문에 200이 떨어지는 구조)
    { name: '404 page', url: '/nonexistent-page-xyz', expectStatus: 200 },
    { name: 'Invalid API', url: '/api/nonexistent', expectStatus: 200 },
    // 뉴스 토픽 범위 초과
    { name: 'News topic 0', url: '/api/services/news/0?page=1', expectStatus: [200, 400, 404] },
    { name: 'News topic 999', url: '/api/services/news/999?page=1', expectStatus: [200, 400, 404] },
    { name: 'News negative page', url: '/api/services/news/1?page=-1', expectStatus: [200, 400] },
    { name: 'News huge page', url: '/api/services/news/1?page=99999', expectStatus: 200 },
    { name: 'News no page param', url: '/api/services/news/1', expectStatus: 200 },
    // 날씨 범위 초과
    { name: 'Weather door 0', url: '/api/services/weather/0', expectStatus: [200, 400, 404] },
    { name: 'Weather door 999', url: '/api/services/weather/999', expectStatus: [200, 400, 404] },
    // 게시판 범위 초과
    { name: 'Board 0 posts', url: '/api/boards/0?page=1', expectStatus: [200, 400, 404] },
    { name: 'Board 99999', url: '/api/boards/99999?page=1', expectStatus: [200, 400, 404] },
    // XSS 시도 (제목에 스크립트 주입)
    { name: 'XSS in path', url: '/api/services/news/<script>alert(1)</script>', expectStatus: [200, 400, 404, 500] },
    // SQL Injection 시도
    { name: 'SQLi in path', url: "/api/boards/1' OR '1'='1", expectStatus: [200, 400, 404, 500] },
    // 특수문자
    { name: 'Unicode in path', url: '/api/services/news/한글', expectStatus: [400, 404] },
    // 아주 긴 경로
    { name: 'Long path', url: '/api/services/news/' + 'a'.repeat(1000), expectStatus: [400, 404] },
  ];

  console.log('=== 1. ROUTE EDGE CASES ===');
  for (const t of routeTests) {
    try {
      const res = await fetch('http://localhost:3000' + t.url);
      const expected = Array.isArray(t.expectStatus) ? t.expectStatus : [t.expectStatus];
      if (!expected.includes(res.status)) {
        report('route', { name: t.name, url: t.url, status: res.status, expected: t.expectStatus });
        console.log(`  ⚠ ${t.name}: got ${res.status}, expected ${JSON.stringify(t.expectStatus)}`);
      } else {
        // 500 에러는 항상 보고
        if (res.status >= 500) {
          report('server-error', { name: t.name, url: t.url, status: res.status });
          console.log(`  🔴 ${t.name}: SERVER ERROR ${res.status}`);
        }
      }
    } catch (e) {
      report('route-crash', { name: t.name, url: t.url, error: e.message });
      console.log(`  💥 ${t.name}: CRASH - ${e.message}`);
    }
  }

  // ========== 2. 뉴스 페이지네이션 일관성 ==========
  console.log('\n=== 2. PAGINATION CONSISTENCY ===');
  try {
    const p1 = await fetch('http://localhost:3000/api/services/news/1?page=1');
    const d1 = await p1.json();
    const total = d1.data?.items?.length || 0;
    console.log(`  Topic 1 total items: ${total}`);
    
    // 페이지 2 가져와서 중복 확인
    const p2 = await fetch('http://localhost:3000/api/services/news/1?page=2');
    const d2 = await p2.json();
    const page1Titles = new Set((d1.data?.items || []).slice(0, 15).map(i => i.title));
    const page2Items = (d2.data?.items || []).slice(15, 30);
    let duplicates = 0;
    for (const item of page2Items) {
      if (page1Titles.has(item.title)) duplicates++;
    }
    if (duplicates > 0) {
      report('pagination', { type: 'page-duplicate', count: duplicates });
      console.log(`  ⚠ ${duplicates} duplicate titles between page 1 and 2`);
    } else {
      console.log('  ✓ No duplicates between page 1 and 2');
    }
  } catch (e) {
    console.log(`  ERR: ${e.message}`);
  }

  // ========== 3. 응답 헤더 보안 검사 ==========
  console.log('\n=== 3. SECURITY HEADERS ===');
  try {
    const res = await fetch('http://localhost:3000/');
    const headers = Object.fromEntries(res.headers.entries());
    
    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
    };
    
    for (const [header, expected] of Object.entries(securityHeaders)) {
      const value = headers[header];
      if (!value) {
        report('security', { type: 'missing-header', header });
        console.log(`  ⚠ Missing: ${header}`);
      }
    }
    
    // 서버 정보 노출 확인
    if (headers['x-powered-by']) {
      report('security', { type: 'server-info-leak', header: 'x-powered-by', value: headers['x-powered-by'] });
      console.log(`  ⚠ Server info leak: x-powered-by: ${headers['x-powered-by']}`);
    }
    
    // CORS 헤더 확인
    if (headers['access-control-allow-origin'] === '*') {
      console.log(`  ℹ CORS: open (access-control-allow-origin: *)`);
    }
  } catch (e) {
    console.log(`  ERR: ${e.message}`);
  }

  // ========== 4. 게시판 글 내용 검사 ==========
  console.log('\n=== 4. BOARD POST CONTENT ===');
  try {
    const bRes = await fetch('http://localhost:3000/api/boards');
    const boards = (await bRes.json()).data || [];
    
    for (const board of boards.slice(0, 5)) {
      const bid = board.id || board.board_id || board.door;
      if (!bid) continue;
      const pRes = await fetch(`http://localhost:3000/api/boards/${bid}?page=1`);
      const pData = await pRes.json();
      const posts = pData.data?.posts || pData.data?.items || pData.data || [];
      
      if (Array.isArray(posts)) {
        for (const post of posts.slice(0, 3)) {
          const title = post.title || post.subject || '';
          // 게시글 제목에 깨진 인코딩
          if (/[\ufffd]/.test(title)) {
            report('board', { type: 'broken-encoding', board: bid, title: title.slice(0, 40) });
            console.log(`  ⚠ Board ${bid}: broken encoding in "${title.slice(0,40)}"`);
          }
        }
      }
    }
    console.log('  ✓ Board content checks passed');
  } catch (e) {
    console.log(`  ERR: ${e.message}`);
  }

  // ========== 5. 동시 요청 안정성 ==========
  console.log('\n=== 5. CONCURRENT REQUESTS ===');
  try {
    const concurrent = Array.from({ length: 20 }, (_, i) => 
      fetch(`http://localhost:3000/api/services/news/1?page=${(i % 5) + 1}`)
        .then(r => ({ ok: r.ok, status: r.status }))
        .catch(e => ({ ok: false, error: e.message }))
    );
    const results = await Promise.all(concurrent);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      report('stability', { type: 'concurrent-fail', count: failed.length, total: 20, errors: failed.slice(0, 3) });
      console.log(`  ⚠ ${failed.length}/20 concurrent requests failed`);
    } else {
      console.log('  ✓ All 20 concurrent requests succeeded');
    }
  } catch (e) {
    console.log(`  ERR: ${e.message}`);
  }

  // ========== 6. API 응답 구조 일관성 ==========
  console.log('\n=== 6. API RESPONSE STRUCTURE ===');
  const apiEndpoints = [
    '/api/services/news',
    '/api/services/news/1?page=1',
    '/api/services/weather',
    '/api/services/weather/1',
    '/api/boards',
  ];
  for (const ep of apiEndpoints) {
    try {
      const res = await fetch('http://localhost:3000' + ep);
      const body = await res.json();
      if (!body.data && !body.error) {
        report('api-structure', { endpoint: ep, keys: Object.keys(body) });
        console.log(`  ⚠ ${ep}: response has no 'data' or 'error' key. Keys: ${Object.keys(body).join(',')}`);
      }
    } catch (e) {
      report('api-parse', { endpoint: ep, error: e.message });
      console.log(`  ⚠ ${ep}: ${e.message}`);
    }
  }
  console.log('  ✓ API structure checks done');

  // ========== SUMMARY ==========
  console.log(`\n=============================`);
  console.log(`TOTAL ISSUES FOUND: ${issues.length}`);
  console.log(`=============================`);
  issues.forEach(i => console.log(JSON.stringify(i)));
})();
