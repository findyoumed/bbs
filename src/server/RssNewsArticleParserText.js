'use strict';

// [LOG: 20260616_1205] GNB, 푸터, 사이드바 등 레이아웃성 노이즈 태그(aside, header, footer, nav)와 그 콘텐츠를 일괄적으로 제거하여 텍스트 정제
function normalizeHtmlBlock(value) {
  const withoutNoise = String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  return normalizePlainText(withoutNoise
    .replace(/<\/(p|div|section|article|main|li|ul|ol|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n'));
}

// [LOG: 20260610_0341] Strip HTML tags safely, preserving book bracket notations.
function normalizePlainText(value) {
  return decodeJavaScriptEscapes(decodeHtmlEntities(String(value || '')))
    .normalize('NFC') // [LOG_ID: 20260709_1020] 유니코드 NFD 한글 자소 분리 현상을 NFC 결합 형태로 자동 교정
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // [LOG: 20260616_1110] Robust tag stripping regex that safely skips '>' inside quotes
    .replace(/<[a-zA-Z/!](?:[^>'"]|"[^"]*"|'[^']*')*>/g, ' ')
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

  // [LOG: 20260615_1754] Long content with sentences is likely valid article text, bypass widget noise checks
  const sentenceCount = (normalizedText.match(/[.!?]/g) || []).length;
  if (sentenceCount >= 3 && normalizedText.length >= 200) {
    return false;
  }

  if (rawEscapeCount >= 6 && (rawScriptCount >= 1 || rawWidgetCount >= 2)) {
    if (normalizedText.length < 150) {
      return true;
    }
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

// [LOG_ID: 20260731_2000] 아래 세 함수(기사 리드부의 메타/스킵/기자명 단독 줄 판정)는
// RssNewsArticleParserScoring.js와 RssNewsArticleSanitizer.js가 각자 모듈 프라이빗으로
// 복제해 갖고 있었고, 실제로 이미 어긋나 있었다 — Scoring 쪽 메타라인 정규식만
// '최종수정'이 '추최종수정'(비단어, 오타)으로 틀려 "최종수정: 2026.07.31 ..." 형태의
// 날짜 메타라인을 Scoring 경로에서만 놓치고 있었다. 두 파일 모두 이미 이 모듈을
// require하므로 여기(둘의 공통 하위 leaf 모듈)로 모으고, 정규식은 올바른 '최종수정'
// (Sanitizer 쪽)으로 통일한다.
function isArticleLeadMetadataLine(line) {
  const text = String(line || '').trim();
  return /^(?:기사\s*)?(?:입력|수정|최종수정|등록|송고|승인)\s*[:：]?\s*\d{4}[.-]\d{1,2}[.-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/i.test(text)
    || /^\d{4}[.-]\d{1,2}[.-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?$/.test(text);
}

function isArticleLeadSkippableLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return true;
  }

  const patterns = [
    /^지면\s+[A-Z]?\d+$/i,
    /^기사\s*스크랩$/i,
    /^댓글(?:\s*\d+)?$/i,
    /^기사\s*공유$/i,
    /^글자크기(?:\s*조절)?$/i,
    /^기자\s*구독하기$/i,
    /^구독하기$/i,
    /^한경\s*PREMIUM\s*9?$/i,
    /^AI를\s*넘어서는\s*성공투자,?$/i,
    /^한경\s*프리미엄\s*9?$/i,
    /^(?:정치|사회|경제|국제|지역|스포츠|연예|오피니언|테크|BIO\s*Insight)$/i
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function isShortStandaloneAuthorLine(line, nextLine) {
  const text = String(line || '').trim();
  const next = String(nextLine || '').trim();
  if (!text || text.length > 12 || /\s/.test(text)) {
    return false;
  }
  return /^[가-힣]{2,6}$/.test(text) && /^기자\s*구독하기$/i.test(next);
}

module.exports = {
  decodeHtmlEntities,
  escapeRegExp,
  isArticleLeadMetadataLine,
  isArticleLeadSkippableLine,
  isShortStandaloneAuthorLine,
  looksLikeWidgetNoise,
  normalizeHtmlBlock,
  normalizePlainText
};
