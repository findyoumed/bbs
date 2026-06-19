// Scratch: Inspect article 17 on topic 1
(async () => {
  const res = await fetch('http://localhost:3000/api/services/news/1?page=1');
  const d = await res.json();
  const items = d.data?.items || [];
  
  // 17번 기사 찾기
  const item17 = items.find(i => Number(i.no) === 17);
  if (!item17) {
    console.log('Article 17 not found in page 1. Printing all items:');
    items.forEach(i => console.log(`#${i.no}: ${i.title}`));
    return;
  }
  
  console.log('=== Item 17 details ===');
  console.log(JSON.stringify(item17, null, 2));
  
  if (item17.articleKey) {
    const artRes = await fetch(`http://localhost:3000/api/services/news/1/17?key=${item17.articleKey}&link=${encodeURIComponent(item17.link)}`);
    const artData = await artRes.json();
    console.log('\n=== Item 17 detailed data ===');
    console.log(JSON.stringify(artData, null, 2));
  }
})();
