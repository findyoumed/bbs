'use strict';

const { normalizeNewsDate } = require('./RssServiceXmlParsers');
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
} = require('./RssNewsArticleParserExtractors');
const {
  chooseBestArticleBody,
  refineArticleText
} = require('./RssNewsArticleParserScoring');
const {
  normalizeHtmlBlock,
  normalizePlainText
} = require('./RssNewsArticleParserText');

function parseNewsArticleHtml(html) {
  const source = String(html || '');
  const rawDate = normalizePlainText(
    extractMetaContent(source, 'property', 'article:published_time')
    || extractMetaContent(source, 'property', 'article:modified_time')
    || extractMetaContent(source, 'property', 'og:updated_time')
    || extractMetaContent(source, 'name', 'pubdate')
    || extractMetaContent(source, 'name', 'publishdate')
    || extractMetaContent(source, 'name', 'date')
    || extractMetaContent(source, 'name', 'DC.date.issued')
    || extractJsonLdDates(source)[0]
    || extractTimeDateTime(source)
  );
  const date = normalizeNewsDate(rawDate);
  const title = normalizePlainText(
    extractMetaContent(source, 'property', 'og:title')
    || extractMetaContent(source, 'name', 'twitter:title')
    || extractTagText(source, 'title')
  );
  const description = normalizePlainText(
    extractMetaContent(source, 'property', 'og:description')
    || extractMetaContent(source, 'name', 'description')
    || extractMetaContent(source, 'name', 'twitter:description')
  );
  const primaryCandidates = [
    ...extractJsonLdBodies(source).map((text) => ({ text: refineArticleText(text, title), source: 'jsonld' })),
    // [LOG: 20260505_2212] Parse preloaded script data so structured bodies beat truncated RSS teasers.
    ...extractScriptDataBodies(source).map((text) => ({ text: refineArticleText(text, title), source: 'script' })),
    ...extractStructuredContentElementBodies(source).map((text) => ({ text: refineArticleText(text, title), source: 'structured' })),
    ...extractArticleContainerBodies(source).map((text) => ({ text: refineArticleText(text, title), source: 'container' })),
    { text: refineArticleText(normalizeHtmlBlock(extractTagHtml(source, 'article')), title), source: 'article' }
  ].filter((entry) => entry.text);
  const fallbackCandidates = [
    { text: refineArticleText(normalizeHtmlBlock(extractBodyHtml(source)), title), source: 'body' }
  ].filter((entry) => entry.text);
  const candidates = primaryCandidates.length > 0 ? primaryCandidates : fallbackCandidates;

  return {
    title,
    description,
    date: date.date,
    dateTime: date.dateTime,
    imageUrl: normalizeArticleImageUrl(
      extractMetaContent(source, 'property', 'og:image')
      || extractMetaContent(source, 'name', 'twitter:image')
      || extractMetaContent(source, 'property', 'twitter:image')
      || extractMetaContent(source, 'name', 'thumbnail')
    ),
    body: chooseBestArticleBody(candidates, title)
  };
}

function normalizeArticleImageUrl(value) {
  let source = String(value || '').trim();
  if (!source) {
    return '';
  }
  if (/^\/\//.test(source)) {
    return `https:${source}`;
  }
  if (/^https?:\/\//i.test(source)) {
    return source;
  }
  // [LOG_ID: 20260709_1648] 프로토콜이 생략된 호스트 도메인 주소 보정
  if (/^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\//.test(source)) {
    return `https://${source}`;
  }
  return '';
}

module.exports = {
  parseNewsArticleHtml
};
