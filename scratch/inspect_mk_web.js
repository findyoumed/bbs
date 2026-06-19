const fs = require('fs');

(async () => {
  try {
    const url = 'https://www.mk.co.kr/news/society/12078506';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const buffer = await res.arrayBuffer();
    // MK uses EUC-KR or UTF-8. Let's try to decode using UTF-8 and EUC-KR.
    const decoder = new TextDecoder('utf-8');
    const html = decoder.decode(buffer);
    
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i);
    
    console.log('--- Web Page Title Tags ---');
    console.log('HTML Title:', titleMatch ? titleMatch[1].trim() : 'Not Found');
    console.log('og:title:', ogTitleMatch ? ogTitleMatch[1].trim() : 'Not Found');
  } catch (err) {
    console.error('Error fetching MK web page:', err);
  }
})();
