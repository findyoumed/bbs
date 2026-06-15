'use strict';

const GOOGLE_NEWS_ORIGIN = 'https://news.google.com';
const GOOGLE_NEWS_BATCH_EXECUTE_URL = `${GOOGLE_NEWS_ORIGIN}/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je`;
// [LOG: 20260615_1754] Use modern Chrome headers to bypass Google News bot detection and prevent 429 rate limit errors
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

function normalizeValue(value) {
  return String(value || '').trim();
}

function isGoogleNewsArticleUrl(value) {
  const source = normalizeValue(value);
  return /^https?:\/\/news\.google\.com\/(?:rss\/)?articles\//i.test(source)
    || /^https?:\/\/news\.google\.com\/read\//i.test(source);
}

function extractGoogleNewsArticleId(value) {
  const source = normalizeValue(value);
  if (!source) {
    return '';
  }

  try {
    const parsed = new URL(source);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const articleIndex = segments.findIndex((segment) => /^(?:articles|read)$/i.test(segment));
    return articleIndex >= 0 ? normalizeValue(segments[articleIndex + 1]) : '';
  } catch (error) {
    void error;
    return '';
  }
}

function buildGoogleNewsArticlePageUrl(value) {
  const source = normalizeValue(value);
  if (!source) {
    return '';
  }

  try {
    const parsed = new URL(source);
    parsed.protocol = 'https:';
    parsed.host = 'news.google.com';
    // [LOG: 20260615_1754] Do NOT strip /rss prefix since rss endpoint is less prone to bot/CAPTCHA blocks
    return parsed.toString();
  } catch (error) {
    void error;
    return source;
  }
}

function cleanResolvedUrl(value) {
  return normalizeValue(value)
    .replace(/[\u0000-\u001f\s]+$/g, '')
    .replace(/[)"'>\]]+$/g, '');
}

function decodeEscapedUnicodeSequences(value) {
  return String(value || '').replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    if (!Number.isFinite(codePoint)) {
      return match;
    }
    return String.fromCharCode(codePoint);
  });
}

function normalizePublisherArticleUrl(value) {
  const source = cleanResolvedUrl(decodeEscapedUnicodeSequences(value));
  if (!source) {
    return '';
  }

  try {
    const parsed = new URL(source);
    const host = String(parsed.hostname || '').trim().toLowerCase();

    if (host === 'm.health.chosun.com' && /^\/svc\/news_view\.html$/i.test(parsed.pathname)) {
      const contid = normalizeValue(parsed.searchParams.get('contid'));
      const dateMatch = contid.match(/^(\d{4})(\d{2})(\d{2})\d+$/);
      if (dateMatch) {
        return `https://health.chosun.com/site/data/html_dir/${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}/${contid}.html`;
      }
    }

    return parsed.toString();
  } catch (error) {
    void error;
    return source;
  }
}

function decodeGoogleNewsArticleId(articleId) {
  const source = normalizeValue(articleId);
  if (!source) {
    return '';
  }

  const attempts = [
    () => Buffer.from(source, 'base64url').toString('utf8'),
    () => Buffer.from(source.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  ];

  for (const attempt of attempts) {
    try {
      const decoded = attempt();
      const match = decoded.match(/https?:\/\/[^\s"'<>\\\u0000-\u001f]+/i);
      if (match) {
        return normalizePublisherArticleUrl(match[0]);
      }
    } catch (error) {
      void error;
    }
  }

  return '';
}

function extractGoogleNewsDecodeParams(html) {
  const source = String(html || '');
  const signature = source.match(/data-n-a-sg=(?:"|')([^"']+)(?:"|')/i)?.[1] || '';
  const timestamp = source.match(/data-n-a-ts=(?:"|')([^"']+)(?:"|')/i)?.[1] || '';

  if (!signature || !/^\d+$/.test(timestamp)) {
    return null;
  }

  return {
    signature: normalizeValue(signature),
    timestamp: normalizeValue(timestamp)
  };
}

function buildSignedBatchRequest(articleId, params) {
  return [
    'garturlreq',
    [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0
    ],
    articleId,
    Number.parseInt(params.timestamp, 10),
    params.signature
  ];
}

function buildSimpleBatchRequest(articleId) {
  return [
    'garturlreq',
    [
      ['en-US', 'US', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'US:en', null, 180, null, null, null, null, null, 0, null, null, [1608992183, 723341000]],
      'en-US',
      'US',
      1,
      [2, 3, 4, 8],
      1,
      0,
      '655000234',
      0,
      0,
      null,
      0
    ],
    articleId
  ];
}

function buildBatchExecuteBody(articleId, params) {
  const requestPayload = params ? buildSignedBatchRequest(articleId, params) : buildSimpleBatchRequest(articleId);
  const formData = new URLSearchParams();
  formData.set('f.req', JSON.stringify([[['Fbv4je', JSON.stringify(requestPayload), null, 'generic']]]));
  return formData.toString();
}

function extractGoogleNewsBatchResolvedUrl(rawText) {
  const source = String(rawText || '')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"');
  const match = source.match(/\["garturlres","((?:\\.|[^"])*)",/) || source.match(/\["garturlres","((?:\\.|[^"])*)"/);
  if (!match) {
    return '';
  }

  try {
    return normalizePublisherArticleUrl(JSON.parse(`"${match[1]}"`));
  } catch (error) {
    void error;
    return normalizePublisherArticleUrl(
      match[1]
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    );
  }
}

async function fetchTextResponse(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {})
    },
    redirect: options.redirect || 'follow',
    signal: AbortSignal.timeout(3000)
  });

  if (!response?.ok) {
    throw new Error(`upstream failed${response?.status ? ` (${response.status})` : ''}`);
  }

  return {
    finalUrl: normalizePublisherArticleUrl(response?.url || ''),
    text: await response.text()
  };
}

async function fetchGoogleNewsBatchResolvedUrl(fetchImpl, articleId, params) {
  const { text } = await fetchTextResponse(fetchImpl, GOOGLE_NEWS_BATCH_EXECUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Referer: `${GOOGLE_NEWS_ORIGIN}/`,
      'X-Same-Domain': '1'
    },
    body: buildBatchExecuteBody(articleId, params)
  });

  return extractGoogleNewsBatchResolvedUrl(text);
}

async function resolveGoogleNewsSourceUrl(url, fetchImpl) {
  const source = normalizeValue(url);
  if (!isGoogleNewsArticleUrl(source) || typeof fetchImpl !== 'function') {
    return '';
  }

  const articleId = extractGoogleNewsArticleId(source);
  if (!articleId) {
    return '';
  }

  const directDecodedUrl = decodeGoogleNewsArticleId(articleId);
  if (directDecodedUrl && !isGoogleNewsArticleUrl(directDecodedUrl)) {
    return directDecodedUrl;
  }

  let pageHtml = '';
  try {
    const articlePage = await fetchTextResponse(fetchImpl, buildGoogleNewsArticlePageUrl(source));
    if (articlePage.finalUrl && !isGoogleNewsArticleUrl(articlePage.finalUrl)) {
      return articlePage.finalUrl;
    }
    pageHtml = articlePage.text;
  } catch (error) {
    void error;
  }

  const decodeParams = extractGoogleNewsDecodeParams(pageHtml);
  if (decodeParams) {
    try {
      const signedResolvedUrl = await fetchGoogleNewsBatchResolvedUrl(fetchImpl, articleId, decodeParams);
      if (signedResolvedUrl && !isGoogleNewsArticleUrl(signedResolvedUrl)) {
        return signedResolvedUrl;
      }
    } catch (error) {
      void error;
    }
  }

  try {
    const simpleResolvedUrl = await fetchGoogleNewsBatchResolvedUrl(fetchImpl, articleId, null);
    if (simpleResolvedUrl && !isGoogleNewsArticleUrl(simpleResolvedUrl)) {
      return simpleResolvedUrl;
    }
  } catch (error) {
    void error;
  }

  return '';
}

module.exports = {
  isGoogleNewsArticleUrl,
  normalizePublisherArticleUrl,
  resolveGoogleNewsSourceUrl
};
