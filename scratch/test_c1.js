'use strict';

const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { normalizeHtmlBlock, normalizePlainText } = require('../src/server/RssNewsArticleParserText');
const {
  extractJsonLdBodies,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractArticleContainerBodies,
  extractTagHtml,
  extractBodyHtml
} = require('../src/server/RssNewsArticleParserExtractors');

async function run() {
  const url = 'https://www.pressian.com/pages/articles/2026061010173839184&ref=rss';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OldDOS-BBS Web RSS Fetcher' }
  });
  const html = await response.text();

  const source = String(html || '');
  const containers = extractArticleContainerBodies(source);
  console.log('Total containers found:', containers.length);
  containers.forEach((text, idx) => {
    const refined = require('../src/server/RssNewsArticleParserScoring').refineArticleText(text);
    console.log(`\nContainer #${idx + 1}`);
    console.log('Raw length:', text.length, 'Refined length:', refined.length);
    console.log('Refined text:');
    console.log(refined);
  });
}

run().catch(console.error);
