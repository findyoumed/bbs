const fs = require('fs');
const { parseNewsArticleHtml } = require('../src/server/RssNewsArticleParser');
const { scoreArticleText, refineArticleText } = require('../src/server/RssNewsArticleParserScoring');
const {
  extractArticleContainerBodies,
  extractBodyHtml,
  extractJsonLdBodies,
  extractJsonLdDates,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractMetaContent,
  extractTagHtml,
  extractTagText,
  extractTimeDateTime
} = require('../src/server/RssNewsArticleParserExtractors');
const { normalizeHtmlBlock } = require('../src/server/RssNewsArticleParserText');

try {
  const html = fs.readFileSync('scratch/donga_raw.html', 'utf-8');
  console.log('--- Analyzing Candidates ---');
  
  // Custom container match checker to print exactly which html tags got matched
  const preferredMatchers = [
    /(?:id|class)=["'][^"']*(article[-_]body|article[-_]word|article[-_]txt|articleText|article[-_]view[-_]content|article[-_]view[-_]content[-_]div|story[-_]news|storynews|news[-_]view|news[-_]body|news[-_]body[-_]area|newsct[-_]article|news[-_]end|news[-_]article|content[-_]body|view[-_]content|articleWrap|article[-_]wrap|news[-_]cnt[-_]detail[-_]wrap|news[-_]cnt[-_]detail|art[-_]txt|article[-_]txt|art[-_]body|article[-_]body[-_]wrap|news[-_]detail[-_]wrap|news[-_]detail[-_]area|news[-_]text|detail[-_]body|view[-_]txt|cont[-_]newstext|cont[-_]news[-_]text)[^"']*["']/i
  ];
  
  const openTagPattern = /<(article|section|div|main)\b[^>]*>/gi;
  let match;
  console.log('--- Container Open Tags Matched ---');
  while ((match = openTagPattern.exec(html))) {
    const openTag = match[0];
    if (preferredMatchers.some(matcher => matcher.test(openTag))) {
      console.log(`Matched tag: ${openTag.substring(0, 120)} at index ${match.index}`);
    }
  }
  console.log('------------------------------------');

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
    console.log(`Text: "${c.text.substring(0, 200)}"`);
    console.log('--------------------------------------------');
  });

  const body = parseNewsArticleHtml(html);
  console.log('Final Body:', body.body);
} catch (err) {
  console.error(err);
}

