const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { scoreArticleText, refineArticleText } = require('../src/server/RssNewsArticleParserScoring');
const {
  extractArticleContainerBodies,
  extractJsonLdBodies,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractTagHtml
} = require('../src/server/RssNewsArticleParserExtractors');
const { normalizeHtmlBlock } = require('../src/server/RssNewsArticleParserText');

const url = 'https://www.yna.co.kr/view/AKR20260617151000053';

const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function run() {
  try {
    console.log('Fetching', url);
    const response = await fetch(url, { headers: CHROME_HEADERS });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    console.log('HTML length:', html.length);

    console.log('\n--- Analyzing Candidates ---');
    const candidates = [
      ...extractJsonLdBodies(html).map((text) => ({ text: refineArticleText(text), source: 'jsonld' })),
      ...extractScriptDataBodies(html).map((text) => ({ text: refineArticleText(text), source: 'script' })),
      ...extractStructuredContentElementBodies(html).map((text) => ({ text: refineArticleText(text), source: 'structured' })),
      ...extractArticleContainerBodies(html).map((text) => ({ text: refineArticleText(text), source: 'container' })),
      { text: refineArticleText(normalizeHtmlBlock(extractTagHtml(html, 'article'))), source: 'article' }
    ].filter((entry) => entry.text);

    candidates.forEach((c, idx) => {
      const rawScore = scoreArticleText(c.text, c.source);
      console.log(`Candidate ${idx}: source=${c.source}, length=${c.text.length}, score=${rawScore}`);
      console.log(`Text Preview: "${c.text.substring(0, 150)}..."`);
      console.log(`Text Tail: "...${c.text.substring(c.text.length - 150)}"`);
      console.log('--------------------------------------------');
    });

    const parsed = parseNewsArticleHtml(html);
    console.log('\n=== PARSED BODY ===');
    console.log('Length:', parsed.body.length);
    console.log(parsed.body);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
