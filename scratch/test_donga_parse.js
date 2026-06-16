'use strict';
const fs = require('fs');
const path = require('path');
const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { chooseBestArticleBody, scoreArticleText, refineArticleText } = require('../src/server/RssNewsArticleParserScoring');
const {
  extractArticleContainerBodies,
  extractJsonLdBodies,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractBodyHtml,
  extractTagHtml
} = require('../src/server/RssNewsArticleParserExtractors');

const htmlPath = path.join(__dirname, 'donga_raw.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- HTML Loaded ---');
const parsed = parseNewsArticleHtml(html);
console.log('Final parsed title:', parsed.title);
console.log('Final parsed body:', JSON.stringify(parsed.body));

console.log('\n--- Extraction Details ---');
const jsonLdBodies = extractJsonLdBodies(html);
console.log('JSON-LD bodies count:', jsonLdBodies.length);
jsonLdBodies.forEach((b, i) => console.log(`  [jsonld-${i}]:`, JSON.stringify(b.slice(0, 100))));

const scriptBodies = extractScriptDataBodies(html);
console.log('Script bodies count:', scriptBodies.length);
scriptBodies.forEach((b, i) => console.log(`  [script-${i}]:`, JSON.stringify(b.slice(0, 100))));

const containerBodies = extractArticleContainerBodies(html);
console.log('Container bodies count:', containerBodies.length);
containerBodies.forEach((b, i) => {
  const refined = refineArticleText(b);
  const score = scoreArticleText(refined, 'container');
  console.log(`  [container-${i}] Raw length:`, b.length, 'Refined length:', refined.length, 'Score:', score);
  console.log(`  Refined preview:`, JSON.stringify(refined.slice(0, 200)));
});
