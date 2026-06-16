const fs = require('fs');

try {
  const raw = fs.readFileSync('scratch/api_res.json');
  const text = new TextDecoder('utf-8').decode(raw);
  const data = JSON.parse(text);
  console.log('JSON Parse Success!');
  console.log('Title:', data.data?.title);
  console.log('Article Title:', data.data?.article?.title);
  console.log('Article Author:', data.data?.article?.author);
  console.log('Article Body Length:', data.data?.article?.body?.length);
  console.log('Article Body Sample:', data.data?.article?.body?.substring(0, 300));
} catch (err) {
  console.error('Error:', err.message);
}
