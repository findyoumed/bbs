'use strict';

function normalizeHtmlBlock(value) {
  const withoutNoise = String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  return normalizePlainText(withoutNoise
    .replace(/<\/(p|div|section|article|main|li|ul|ol|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n'));
}

// [LOG: 20260610_0341] Strip HTML tags safely, preserving book bracket notations.
function normalizePlainText(value) {
  return decodeJavaScriptEscapes(decodeHtmlEntities(String(value || '')))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[a-zA-Z/!][^>]*>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function decodeJavaScriptEscapes(value) {
  return String(value || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, code) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function countMatches(source, pattern) {
  return (String(source || '').match(pattern) || []).length;
}

function looksLikeWidgetNoise(rawSource, normalizedSource) {
  const rawText = String(rawSource || '');
  const normalizedText = String(normalizedSource || '');
  const rawEscapeCount = countMatches(rawText, /\\u[0-9a-fA-F]{4}/g);
  const rawScriptCount = countMatches(rawText, /\$\(document\)\.ready|_spinTop|spinTopParams|draw_contents[A-Za-z0-9_]*|contbox[A-Za-z0-9_]*_html|clickStatistics_[A-Za-z0-9_]*|Object\.keys\(data\)|\$\.each\(/g);
  const rawWidgetCount = countMatches(rawText, /\uC624\uB298\uC758 \uCD94\uCC9C\uC601\uC0C1|\uC9C0\uAE08 \uB728\uB294 \uB274\uC2A4|\uC88B\uC544\uC694|\uCF54\uBA58\uD2B8|\uB313\uAE00/g);
  const normalizedScriptCount = countMatches(normalizedText, /\$\(document\)\.ready|_spinTop|spinTopParams|draw_contents[A-Za-z0-9_]*|contbox[A-Za-z0-9_]*_html|clickStatistics_[A-Za-z0-9_]*|Object\.keys\(data\)|\$\.each\(/g);
  const normalizedWidgetCount = countMatches(normalizedText, /\uC624\uB298\uC758 \uCD94\uCC9C\uC601\uC0C1|\uC9C0\uAE08 \uB728\uB294 \uB274\uC2A4|\uC88B\uC544\uC694|\uCF54\uBA58\uD2B8|\uB313\uAE00/g);

  if (rawEscapeCount >= 6 && (rawScriptCount >= 1 || rawWidgetCount >= 2)) {
    return true;
  }

  return normalizedScriptCount >= 1 && normalizedWidgetCount >= 1;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;|&apos;/gi, "'")
    .replace(/&middot;/gi, '\u00b7')
    .replace(/&hellip;/gi, '...')
    .replace(/&mdash;|&ndash;/gi, '-')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    });
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  decodeHtmlEntities,
  escapeRegExp,
  looksLikeWidgetNoise,
  normalizeHtmlBlock,
  normalizePlainText
};
