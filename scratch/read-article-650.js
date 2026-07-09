async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/services/news/1/650');
    console.log('Response status:', res.status);
    const result = await res.json();
    console.log('=== REAL RESPONSE ===');
    if (result.success && result.data?.article) {
      console.log('Title:', result.data.article.title);
      console.log('=== BODY ===');
      console.log(result.data.article.body);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error fetching real article 650:', error.message);
  }
}

run();
