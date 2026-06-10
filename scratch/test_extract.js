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
  console.log('Fetching', url);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OldDOS-BBS Web RSS Fetcher' }
  });
  const html = await response.text();

  const source = String(html || '');
  const candidates = [
    ...extractJsonLdBodies(source).map((text) => ({ text, source: 'jsonld' })),
    ...extractScriptDataBodies(source).map((text) => ({ text, source: 'script' })),
    ...extractStructuredContentElementBodies(source).map((text) => ({ text, source: 'structured' })),
    ...extractArticleContainerBodies(source).map((text) => ({ text, source: 'container' })),
    { text: normalizeHtmlBlock(extractTagHtml(source, 'article')), source: 'article' },
    { text: normalizeHtmlBlock(extractBodyHtml(source)), source: 'body' }
  ].filter((entry) => entry.text);

  console.log(`Found ${candidates.length} candidates.`);

  candidates.forEach((c, idx) => {
    const refined = require('../src/server/RssNewsArticleParserScoring').refineArticleText(c.text);
    console.log(`\n========================================`);
    console.log(`Candidate #${idx + 1} [Source: ${c.source}] Raw Len: ${c.text.length}, Refined Len: ${refined.length}`);
    console.log(`--- RAW TEXT ---`);
    console.log(c.text);
    console.log(`--- REFINED TEXT ---`);
    console.log(refined);
  });
}

run().catch(console.error);
