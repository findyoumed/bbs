const {
  extractArticleContainerBodies,
  extractBodyHtml,
  extractJsonLdBodies,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractTagHtml
} = require('../src/server/RssNewsArticleParserExtractors');
const {
  chooseBestArticleBody,
  refineArticleText,
  scoreArticleText
} = require('../src/server/RssNewsArticleParserScoring');
const {
  normalizeHtmlBlock
} = require('../src/server/RssNewsArticleParserText');

const url = 'https://news.kbs.co.kr/news/pc/view/view.do?ncd=8585988';
const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function run() {
  const res = await fetch(url, { headers: CHROME_HEADERS });
  const html = await res.text();
  const source = String(html || '');

  const candidates = [
    ...extractJsonLdBodies(source).map((text) => ({ text: refineArticleText(text), source: 'jsonld', raw: text })),
    ...extractScriptDataBodies(source).map((text) => ({ text: refineArticleText(text), source: 'script', raw: text })),
    ...extractStructuredContentElementBodies(source).map((text) => ({ text: refineArticleText(text), source: 'structured', raw: text })),
    ...extractArticleContainerBodies(source).map((text) => ({ text: refineArticleText(text), source: 'container', raw: text })),
    { text: refineArticleText(normalizeHtmlBlock(extractTagHtml(source, 'article'))), source: 'article', raw: extractTagHtml(source, 'article') },
    { text: refineArticleText(normalizeHtmlBlock(extractBodyHtml(source))), source: 'body', raw: extractBodyHtml(source) }
  ];

  console.log('--- ALL CANDIDATES DUMP ---');
  candidates.forEach((cand, i) => {
    const refinedLen = cand.text ? cand.text.length : 0;
    const rawLen = cand.raw ? cand.raw.length : 0;
    const score = scoreArticleText(cand.text, cand.source);
    console.log(`\nCANDIDATE ${i} [Source: ${cand.source}]`);
    console.log(`Raw Length: ${rawLen}, Refined Length: ${refinedLen}, Score: ${score}`);
    console.log(`Snippet: ${cand.text ? cand.text.substring(0, 300) : 'EMPTY / WEED OUT'}`);
  });
}

run().catch(console.error);
