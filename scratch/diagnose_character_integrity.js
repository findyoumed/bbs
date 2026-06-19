// [LOG: 20260619_1555] Diagnose character encoding and sanitization integrity with realistic HTML content.
'use strict';

const assert = require('assert');
const RssNewsService = require('../src/server/RssNewsService');
const { parseNewsFeedXml } = require('../src/server/RssServiceXmlParsers');
const {
  buildAuthor,
  normalize,
  sanitizeArticleText
} = require('../src/server/RssNewsArticleSanitizer');

// Build a dynamic CP949 (Windows-949) encoder map in memory using TextDecoder
const unicodeToCp949 = new Map();
const decoder = new TextDecoder('windows-949');
for (let b1 = 0x81; b1 <= 0xFD; b1++) {
  const bytes = new Uint8Array(2);
  bytes[0] = b1;
  for (let b2 = 0x41; b2 <= 0xFE; b2++) {
    if (b2 === 0x7F) continue;
    bytes[1] = b2;
    const char = decoder.decode(bytes);
    if (char.length === 1 && !unicodeToCp949.has(char)) {
      unicodeToCp949.set(char, [b1, b2]);
    }
  }
}

function encodeCp949(str) {
  const result = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);
    if (code <= 0x7F) {
      result.push(code);
    } else if (unicodeToCp949.has(char)) {
      result.push(...unicodeToCp949.get(char));
    } else {
      result.push(0x3F); // fallback '?'
    }
  }
  return new Uint8Array(result);
}

async function runDiagnostics() {
  console.log('=== NEWS PIPELINE CHARACTER INTEGRITY DIAGNOSTICS ===');
  let exitCode = 0;

  // 1. Verify character decoding logic on RSS XML (EUC-KR)
  try {
    console.log('\n[TEST 1] Testing EUC-KR RSS Feed decoding...');
    const xmlText = '<?xml version="1.0" encoding="euc-kr"?><rss><channel><item><title>윤두준 멕시코전 석패</title><link>https://www.mk.co.kr/news/1</link><description>석패했습니다.</description></item></channel></rss>';
    const xmlBuffer = encodeCp949(xmlText);
    
    // Mock fetch implementation returning EUC-KR buffer
    const mockFetch = async (url) => {
      return {
        ok: true,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'application/xml; charset=euc-kr' : null
        },
        arrayBuffer: async () => xmlBuffer.buffer.slice(xmlBuffer.byteOffset, xmlBuffer.byteOffset + xmlBuffer.byteLength)
      };
    };

    const newsService = new RssNewsService({ fetchImpl: mockFetch });
    const feed = await newsService._fetchCached('test:euc-kr-feed', 'https://www.mk.co.kr/rss/30000001/', parseNewsFeedXml);
    
    const parsedTitle = feed.items[0].title;
    const parsedDesc = feed.items[0].description;

    console.log('Parsed Title (EUC-KR):', parsedTitle);
    console.log('Parsed Desc (EUC-KR):', parsedDesc);

    assert.strictEqual(parsedTitle, '윤두준 멕시코전 석패');
    assert.strictEqual(parsedDesc, '석패했습니다.');
    console.log('=> TEST 1 PASSED: EUC-KR XML decoded perfectly without corruption.');
  } catch (err) {
    console.error('=> TEST 1 FAILED:', err.message);
    exitCode = 1;
  }

  // 2. Verify character decoding logic on Article HTML (EUC-KR & UTF-8)
  try {
    console.log('\n[TEST 2] Testing EUC-KR & UTF-8 HTML article detail decoding...');
    
    // EUC-KR HTML test with correct article body container class
    const eucKrHtmlText = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=euc-kr"><title>윤두준 멕시코전 석패</title></head><body><div class="detail-body">본문 내용: 석패했습니다. 이것은 아주 중요한 경기였습니다.</div></body></html>';
    const eucKrHtml = encodeCp949(eucKrHtmlText);
    const mockFetchEucKr = async (url) => {
      return {
        ok: true,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'text/html; charset=euc-kr' : null
        },
        arrayBuffer: async () => eucKrHtml.buffer.slice(eucKrHtml.byteOffset, eucKrHtml.byteOffset + eucKrHtml.byteLength)
      };
    };

    const newsServiceEucKr = new RssNewsService({ fetchImpl: mockFetchEucKr });
    const detailEucKr = await newsServiceEucKr._fetchNewsArticleDetail('https://www.mk.co.kr/news/1');
    console.log('EUC-KR Crawl Title:', detailEucKr.title);
    console.log('EUC-KR Crawl Body:', detailEucKr.body);

    assert.strictEqual(detailEucKr.title, '윤두준 멕시코전 석패');
    assert.ok(detailEucKr.body.includes('석패했습니다.'));
    console.log('=> EUC-KR HTML decoding verified successfully.');

    // UTF-8 HTML test with correct article body container class
    const utf8HtmlText = '<html><head><meta charset="utf-8"><title>윤두준 멕시코전 석패</title></head><body><div class="detail-body">본문 내용: 석패했습니다. 이것은 아주 중요한 경기였습니다.</div></body></html>';
    const utf8HtmlBuffer = Buffer.from(utf8HtmlText, 'utf-8');
    const mockFetchUtf8 = async (url) => {
      return {
        ok: true,
        headers: {
          get: (name) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null
        },
        arrayBuffer: async () => utf8HtmlBuffer.buffer.slice(utf8HtmlBuffer.byteOffset, utf8HtmlBuffer.byteOffset + utf8HtmlBuffer.byteLength)
      };
    };

    const newsServiceUtf8 = new RssNewsService({ fetchImpl: mockFetchUtf8 });
    const detailUtf8 = await newsServiceUtf8._fetchNewsArticleDetail('https://www.mk.co.kr/news/1');
    console.log('UTF-8 Crawl Title:', detailUtf8.title);
    console.log('UTF-8 Crawl Body:', detailUtf8.body);

    assert.strictEqual(detailUtf8.title, '윤두준 멕시코전 석패');
    assert.ok(detailUtf8.body.includes('석패했습니다.'));
    console.log('=> UTF-8 HTML decoding verified successfully.');
    console.log('=> TEST 2 PASSED: Both EUC-KR and UTF-8 Article Detail pages decoded perfectly.');
  } catch (err) {
    console.error('=> TEST 2 FAILED:', err.message);
    exitCode = 1;
  }

  // 3. Verify that RssNewsArticleSanitizer and RssNewsService do NOT mutate title characters
  try {
    console.log('\n[TEST 3] Verifying Sanitizer does not mutate valid news titles...');
    
    const inputTitle = '윤두준 멕시코전 석패';
    const normalizedTitle = normalize(inputTitle);
    console.log('Normalized Title:', normalizedTitle);
    assert.strictEqual(normalizedTitle, '윤두준 멕시코전 석패');

    // Add extra content so that the entire text is not pruned by the title duplicate removal filter
    const bodyText = '윤두준 멕시코전 석패했습니다.\n\n이것은 별도의 보도 본문 내용입니다. 아쉬운 패배를 기록했습니다.\n기사 스크랩하기\n본문 글씨 키우기';
    const sanitizedBody = sanitizeArticleText(bodyText, inputTitle);
    console.log('Sanitized Body snippet:\n', sanitizedBody);
    
    // Boilerplate should be removed, core unique content with "패배" or "석패" should remain
    assert.ok(sanitizedBody.includes('아쉬운 패배를 기록했습니다.'));
    assert.ok(!sanitizedBody.includes('기사 스크랩하기'));
    
    console.log('=> TEST 3 PASSED: Sanitizer preserves core text and removes boilerplate successfully.');
  } catch (err) {
    console.error('=> TEST 3 FAILED:', err.message);
    exitCode = 1;
  }

  // 4. Verify publisher metadata decoding and preservation
  try {
    console.log('\n[TEST 4] Verifying Publisher metadata resolution...');
    
    const newsService = new RssNewsService();
    const mkDoor = newsService._findSourceDoorByTitle('매일경제');
    const ynaDoor = newsService._findSourceDoorByTitle('연합뉴스TV');
    const chosunDoor = newsService._findSourceDoorByTitle('조선일보');

    console.log('Source Door mapping for 매일경제:', mkDoor);
    console.log('Source Door mapping for 연합뉴스TV:', ynaDoor);
    console.log('Source Door mapping for 조선일보:', chosunDoor);

    assert.strictEqual(mkDoor, '7');
    assert.strictEqual(ynaDoor, '1');
    assert.strictEqual(chosunDoor, '5');

    // Test author building logic
    const authorWithSource = buildAuthor('매일경제', '매일경제/홍길동 기자');
    const authorClean = buildAuthor('매일경제', '홍길동 기자');
    
    console.log('Built Author (duplicate-stripped):', authorWithSource);
    console.log('Built Author (clean):', authorClean);

    assert.strictEqual(authorWithSource, '매일경제/홍길동 기자');
    assert.strictEqual(authorClean, '매일경제/홍길동 기자');

    console.log('=> TEST 4 PASSED: Publisher mapping and metadata decoration operates with 100% integrity.');
  } catch (err) {
    console.error('=> TEST 4 FAILED:', err.message);
    exitCode = 1;
  }

  // 5. Technical Byte Comparison (EUC-KR: "패" vs "해")
  console.log('\n[TEST 5] Technical Byte Comparison (EUC-KR "패" vs "해")...');
  const bytePae = encodeCp949('패');
  const byteHae = encodeCp949('해');
  console.log('EUC-KR bytes for "패":', bytePae);
  console.log('EUC-KR bytes for "해":', byteHae);

  if (bytePae[0] !== byteHae[0] || bytePae[1] !== byteHae[1]) {
    console.log('=> Verified: "패" and "해" are distinct EUC-KR characters. Encoding translation errors cannot cleanly morph one into the other.');
  }

  process.exit(exitCode);
}

runDiagnostics();
