'use strict';

const {
  decodeHtmlEntities,
  escapeRegExp,
  normalizeHtmlBlock,
  normalizePlainText
} = require('./RssNewsArticleParserText');

function extractJsonLdBodies(source) {
  const bodies = [];
  const matches = source.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  matches.forEach((block) => {
    const jsonText = String(block)
      .replace(/^<script\b[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .trim();

    if (!jsonText) {
      return;
    }

    try {
      collectJsonLdText(JSON.parse(jsonText), bodies);
    } catch (error) {
      void error;
    }
  });

  return bodies.map(normalizePlainText).filter(Boolean);
}

function extractStructuredContentElementBodies(source) {
  const bodies = [];
  const text = String(source || '');
  const keyPattern = /"content_elements"\s*:\s*\[/g;
  let match;

  while ((match = keyPattern.exec(text))) {
    const bracketIndex = text.indexOf('[', match.index);
    if (bracketIndex < 0) {
      continue;
    }

    const arrayText = extractBalancedJsonArray(text, bracketIndex);
    if (!arrayText) {
      continue;
    }

    try {
      const elements = JSON.parse(arrayText);
      const lines = [];
      collectStructuredContentText(elements, lines);
      const body = lines
        .map((line) => normalizeHtmlBlock(line))
        .filter(Boolean)
        .join('\n\n');
      if (body) {
        bodies.push(body);
      }
    } catch (error) {
      void error;
    }
  }

  return Array.from(new Set(bodies.map(normalizePlainText).filter(Boolean)));
}

function extractScriptDataBodies(source) {
  const bodies = [];
  const matches = String(source || '').match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];

  matches.forEach((block) => {
    const openTag = String(block || '').match(/^<script\b[^>]*>/i)?.[0] || '';
    const scriptType = String(openTag.match(/\btype=["']([^"']+)["']/i)?.[1] || '').trim().toLowerCase();
    if (scriptType === 'application/ld+json') {
      return;
    }

    const scriptText = String(block)
      .replace(/^<script\b[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .trim();

    if (!scriptText) {
      return;
    }

    if (scriptType === 'application/json' || looksLikeStructuredJsonScript(scriptText)) {
      extractBodiesFromJsonText(scriptText, bodies);
    }

    extractBodiesFromScriptAssignments(scriptText, bodies);
  });

  return Array.from(new Set(bodies.map(normalizePlainText).filter(Boolean)));
}

function extractBalancedJsonArray(source, startIndex) {
  const text = String(source || '');
  const start = Math.max(0, Number(startIndex) || 0);
  return text[start] === '[' ? extractBalancedJsonValue(text, start) : '';
}

function extractBalancedJsonObject(source, startIndex) {
  const text = String(source || '');
  const start = Math.max(0, Number(startIndex) || 0);
  return text[start] === '{' ? extractBalancedJsonValue(text, start) : '';
}

function extractBalancedJsonValue(source, startIndex) {
  const text = String(source || '');
  const start = Math.max(0, Number(startIndex) || 0);
  if (!/[\[{]/.test(text[start] || '')) {
    return '';
  }

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      stack.push('}');
      continue;
    }

    if (ch === '[') {
      stack.push(']');
      continue;
    }

    if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) {
      stack.pop();
      if (stack.length === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return '';
}

// [LOG: 20260616_1220] looksLikeStructuredTextNoise check embedded in collectStructuredContentText
function collectStructuredContentText(node, out) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((entry) => collectStructuredContentText(entry, out));
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  Object.entries(node).forEach(([key, value]) => {
    if (typeof value === 'string' && shouldCollectStructuredFieldValue(key, value, node)) {
      out.push(value);
      return;
    }

    if (value && typeof value === 'object') {
      collectStructuredContentText(value, out);
    }
  });
}

function extractJsonLdDates(source) {
  const dates = [];
  const matches = source.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  matches.forEach((block) => {
    const jsonText = String(block)
      .replace(/^<script\b[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .trim();

    if (!jsonText) {
      return;
    }

    try {
      collectJsonLdDate(JSON.parse(jsonText), dates);
    } catch (error) {
      void error;
    }
  });

  return dates.map(normalizePlainText).filter(Boolean);
}

function collectJsonLdText(node, out) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((entry) => collectJsonLdText(entry, out));
    return;
  }

  if (typeof node === 'object') {
    const nodeType = String(node.type || node['@type'] || '').toLowerCase();
    Object.entries(node).forEach(([key, value]) => {
      if (typeof value === 'string' && (/^(articleBody|text)$/i.test(key) || shouldCollectStructuredFieldValue(key, value, { type: nodeType }))) {
        out.push(value);
        return;
      }
      if (value && typeof value === 'object') {
        collectJsonLdText(value, out);
      }
    });
  }
}

function collectJsonLdDate(node, out) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((entry) => collectJsonLdDate(entry, out));
    return;
  }

  if (typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => {
      if (typeof value === 'string' && /^(datePublished|dateModified|uploadDate|published|modified)$/i.test(key)) {
        out.push(value);
        return;
      }
      collectJsonLdDate(value, out);
    });
  }
}

function extractArticleContainerBodies(source) {
  const preferredMatchers = [
    /(?:id|class)=["'][^"']*(article[-_]body|article[-_]word|article[-_]txt|articleText|article[-_]view[-_]content|article[-_]view[-_]content[-_]div|story[-_]news|storynews|news[-_]view|news[-_]body|news[-_]body[-_]area|newsct[-_]article|news[-_]end|news[-_]article|content[-_]body|view[-_]content|articleWrap|article[-_]wrap|news[-_]cnt[-_]detail[-_]wrap|news[-_]cnt[-_]detail|art[-_]txt|article[-_]txt|art[-_]body|article[-_]body[-_]wrap|news[-_]detail[-_]wrap|news[-_]detail[-_]area|news[-_]text|detail[-_]body|view[-_]txt|cont[-_]newstext|cont[-_]news[-_]text)[^"']*["']/i
  ];
  const fallbackMatchers = [
    /itemprop=["']articleBody["']/i,
    /(?:id|class)=["'][^"']*(articleBody|article[-_]content|post[-_]content|entry[-_]content|news[-_]content|story[-_]body|article[-_]body[-_]wrap|article[-_]body|article[-_]view|article[-_]view)[^"']*["']/i
  ];

  const bodies = [
    ...extractBalancedContainerBodies(source, preferredMatchers),
    ...extractBalancedContainerBodies(source, fallbackMatchers)
  ];

  return Array.from(new Set(bodies.filter(Boolean)));
}

function extractBalancedContainerBodies(source, matchers) {
  const bodies = [];
  const openTagPattern = /<(article|section|div|main)\b[^>]*>/gi;
  let match;

  while ((match = openTagPattern.exec(source))) {
    const openTag = String(match[0] || '');
    const tagName = String(match[1] || '').toLowerCase();
    if (isInsideHtmlComment(source, match.index)) {
      continue;
    }
    if (!tagName || !matchers.some((matcher) => matcher.test(openTag))) {
      continue;
    }

    const block = extractBalancedTagInnerHtml(source, match.index, tagName);
    if (!block) {
      continue;
    }

    const normalized = normalizeHtmlBlock(block);
    if (normalized) {
      bodies.push(normalized);
    }
  }

  return bodies;
}

function extractBalancedTagInnerHtml(source, startIndex, tagName) {
  const tag = String(tagName || '').toLowerCase();
  const start = Math.max(0, Number(startIndex) || 0);
  if (!tag) {
    return '';
  }

  const slice = String(source || '').slice(start);
  const openTagMatch = slice.match(new RegExp(`^<${tag}\\b[^>]*>`, 'i'));
  if (!openTagMatch) {
    return '';
  }

  const contentStart = start + openTagMatch[0].length;
  const tokenPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tokenPattern.lastIndex = start;

  let depth = 0;
  let token;
  while ((token = tokenPattern.exec(source))) {
    if (isInsideHtmlComment(source, token.index)) {
      continue;
    }

    const tokenText = String(token[0] || '');
    const isClosing = /^<\//.test(tokenText);
    const isSelfClosing = /\/>$/.test(tokenText);

    if (!isClosing) {
      depth += 1;
      if (isSelfClosing) {
        depth -= 1;
      }
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return String(source || '').slice(contentStart, token.index);
    }
  }

  return '';
}

function isInsideHtmlComment(source, index) {
  const text = String(source || '');
  const cursor = Math.max(0, Number(index) || 0);
  const lastOpen = text.lastIndexOf('<!--', cursor);
  if (lastOpen < 0) {
    return false;
  }

  const lastClose = text.lastIndexOf('-->', cursor);
  return lastClose < lastOpen;
}

function extractTagHtml(source, tagName) {
  const match = String(source || '').match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? String(match[1] || '') : '';
}

function extractBodyHtml(source) {
  return extractTagHtml(source, 'body') || String(source || '');
}

function extractTagText(source, tagName) {
  return normalizeHtmlBlock(extractTagHtml(source, tagName));
}

function extractMetaContent(source, attrName, attrValue) {
  const pattern = new RegExp(
    `<meta\\b[^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const reversePattern = new RegExp(
    `<meta\\b[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*>`,
    'i'
  );
  const match = String(source || '').match(pattern) || String(source || '').match(reversePattern);
  return match ? decodeHtmlEntities(String(match[1] || '')) : '';
}

function extractTimeDateTime(source) {
  const match = String(source || '').match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  return match ? decodeHtmlEntities(String(match[1] || '')) : '';
}

function extractBodiesFromJsonText(source, out) {
  try {
    const lines = [];
    collectStructuredContentText(JSON.parse(source), lines);
    const body = lines
      .map((line) => normalizeHtmlBlock(line))
      .filter(Boolean)
      .join('\n\n');
    if (body) {
      out.push(body);
    }
  } catch (error) {
    void error;
  }
}

function extractBodiesFromScriptAssignments(source, out) {
  const patterns = [
    /(?:window\.)?__NEXT_DATA__\s*=\s*/g,
    /(?:window\.)?__PRELOADED_STATE__\s*=\s*/g,
    /(?:window\.)?__INITIAL_STATE__\s*=\s*/g,
    /(?:window\.)?(?:PRELOADED_STATE|INITIAL_STATE)\s*=\s*/g,
    /(?:window\.)?__APOLLO_STATE__\s*=\s*/g
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(source))) {
      const jsonStart = findJsonValueStart(source, pattern.lastIndex);
      if (jsonStart < 0) {
        continue;
      }

      const payload = source[jsonStart] === '['
        ? extractBalancedJsonArray(source, jsonStart)
        : extractBalancedJsonObject(source, jsonStart);
      if (!payload) {
        continue;
      }

      extractBodiesFromJsonText(payload, out);
    }
  });
}

function findJsonValueStart(source, startIndex) {
  const text = String(source || '');
  for (let index = Math.max(0, Number(startIndex) || 0); index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '{' || ch === '[') {
      return index;
    }
    if (!/\s|=|:|;/.test(ch)) {
      return -1;
    }
  }
  return -1;
}

function looksLikeStructuredJsonScript(source) {
  const text = String(source || '').trim();
  return /^[\[{]/.test(text) && /(articleBody|article_body|articleText|newsText|content_elements|paragraph|contents|body)/i.test(text);
}

function shouldCollectStructuredFieldValue(key, value, node = null) {
  const field = String(key || '').trim();
  const nodeType = String(node?.type || node?.nodeType || node?.kind || node?.['@type'] || '').toLowerCase();
  const text = normalizePlainText(value);
  if (!field || !text) {
    return false;
  }

  if (looksLikeStructuredTextNoise(field, text, nodeType)) {
    return false;
  }

  if (/^(articleBody|article_body|articleText|article_text|bodyText|body_text|newsText|news_text|storyText|story_text|fullText|full_text|text)$/i.test(field)) {
    return text.length >= 20;
  }

  if (/^(content|html|body|contents|paragraph|paragraphs|article|articleBodyHtml)$/i.test(field)) {
    return /^(text|paragraph|body|article|story|content|articlebody)$/.test(nodeType)
      || text.length >= 80
      || /\n/.test(text)
      || /<p\b|<br\b/i.test(String(value || ''));
  }

  if (/^value$/i.test(field)) {
    return /^(text|paragraph|body|article|story)$/.test(nodeType) && text.length >= 8;
  }

  return false;
}

function looksLikeStructuredTextNoise(field, text, nodeType = '') {
  const normalizedField = String(field || '');
  const normalizedNodeType = String(nodeType || '');

  if (/(^|_)(?:title|headline|subheadline|subtitle|caption|credit|copyright|author|reporter|writer|email|date|time|section|category|label|summary|description|excerpt|thumbnail|image|img|photo|source|publisher)(_|$)/i.test(normalizedField)) {
    return true;
  }

  if (/^(?:meta|link|url|href|id|key|slug)$/i.test(normalizedField)) {
    return true;
  }

  if (/^(?:caption|credit|image|photo|thumbnail|summary|description|subtitle)$/i.test(normalizedNodeType)) {
    return true;
  }

  // [LOG: 20260616_1220] 펼치기/접기, 요약, 구글 검색 선호 매체로 추가 등의 레이아웃 단추 텍스트를 구조화 데이터 노이즈 판정식에 추가
  if (text.length < 160 && /(공유하기|구독하기|좋아요|싫어요|댓글|기사 공유|글자크기|사진\s*확대|이미지\s*확대|원문\s*보기|본문\s*바로가기|카카오톡|페이스북(?:\s*메신저)?|URL\s*복사|펼치기\/접기|요약|구글\s*검색\s*선호\s*매체로\s*추가)/.test(text)) {
    return true;
  }

  if (text.length < 200 && /(무단\s*전재|재배포\s*금지|Copyright\b|기사문의\s*및\s*제보)/i.test(text)) {
    return true;
  }

  return false;
}

module.exports = {
  extractArticleContainerBodies,
  extractBodyHtml,
  extractJsonLdDates,
  extractJsonLdBodies,
  extractScriptDataBodies,
  extractStructuredContentElementBodies,
  extractMetaContent,
  extractTagHtml,
  extractTagText,
  extractTimeDateTime
};
