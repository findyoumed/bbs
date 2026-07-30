'use strict';
const fs = require('fs');
const { decodeBufferWithCharset } = require('./RssBufferDecoding');

// [LOG: 20260616_1110] Decode XML buffer dynamically using HTTP header charset or XML declaration encoding
function decodeXmlBuffer(buffer, contentTypeHeader) {
  let charset = '';

  if (contentTypeHeader) {
    const headerMatch = contentTypeHeader.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
    if (headerMatch) {
      charset = headerMatch[1].trim().toLowerCase();
    }
  }

  if (!charset) {
    const previewLen = Math.min(buffer.byteLength, 256);
    const head = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, previewLen)));
    const enc = (head.match(/encoding=["']([^"']+)["']/i)?.[1] || '').trim().toLowerCase();
    if (enc) {
      charset = enc;
    }
  }

  return decodeBufferWithCharset(buffer, charset);
}

// [LOG: 20260723_2010] Never leak raw fetch/Node error internals (e.g. "The operation was
// aborted due to timeout") onto the BBS screen — translate to a friendly Korean message.
function sanitizeFeedError(error) {
  const rawMessage = String(error?.message || '').trim();
  const rawName = String(error?.name || '').trim();
  const rawCode = String(error?.cause?.code || error?.code || '').trim();
  const technicalText = `${rawName} ${rawCode} ${rawMessage}`;

  if (/fetch failed|aborted|timeout|terminated|network|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(technicalText)) {
    return '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (/^upstream failed/i.test(rawMessage)) {
    return '원본 서버 응답 오류가 발생했습니다.';
  }
  return '처리 중 오류가 발생했습니다.';
}

class RssServiceBase {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || global.fetch;
    // [LOG: 20260610_1505] Extend news/weather cache TTL to 15 minutes to reduce server load
    this.cacheTtlMs = Number(options.cacheTtlMs || 15 * 60 * 1000);
    this.menuCacheTtlMs = Number(options.menuCacheTtlMs || 60 * 60 * 1000);
    this.cacheStore = options.cacheStore || null;
    // [LOG_ID: 20260723_2130] 실패(unavailable) 결과를 성공 결과와 같은 15분 TTL로 캐시하면,
    // 기상청 RSS가 몇 초 뒤 다시 정상 응답해도 사용자는 최대 15분 동안 계속 에러 화면만 보게 된다
    // (사용자 보고: "에러가 오히려 생겼어" — 직접 확인해보니 weather.go.kr 자체는 몇 초 만에
    // 정상 응답했는데도 화면엔 에러가 떠 있었다). 실패는 훨씬 짧게만 캐시해 빠르게 재시도되게 한다.
    this.failureCacheTtlMs = Number(options.failureCacheTtlMs || 60 * 1000);
    this.menuCache = new Map();
    this.feedCache = new Map();
  }

  async _fetchCached(cacheKey, url, parser) {
    const memory = this._getMemoryCacheEntry(this.feedCache, cacheKey);
    if (memory) return memory;
    const storeKey = `rss:feed:${cacheKey}`;
    const persistent = await this._getPersistentCacheEntry(storeKey);
    if (persistent) { this._setMemoryCacheEntry(this.feedCache, cacheKey, persistent, this.cacheTtlMs); return persistent; }
    let val;
    try {
      // [LOG: 20260723_2010] Bumped from 2s to 5s — 2s was tripping spurious timeouts on
      // slower upstream RSS servers / serverless cold starts, not just genuinely hung ones.
      const res = await this.fetchImpl(url, {
        headers: { 'User-Agent': 'OldDOS-BBS Web RSS Fetcher' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res?.ok) throw new Error(`upstream failed${res?.status ? ` (${res.status})` : ''}`);
      // [LOG: 20260616_1110] Dynamic charset detection and decoding for RSS feeds
      const buf = await res.arrayBuffer();
      val = parser(decodeXmlBuffer(buf, res.headers.get('content-type')));
    } catch (e) { val = { unavailable: true, message: `피드 오류: ${sanitizeFeedError(e)}`, items: [] }; }
    const ttl = val.unavailable ? this.failureCacheTtlMs : this.cacheTtlMs;
    this._setMemoryCacheEntry(this.feedCache, cacheKey, val, ttl);
    await this._setPersistentCacheEntry(storeKey, val, ttl);
    return val;
  }

  async _loadMenu(cacheKey, filePath, parser) {
    if (!filePath) throw new Error(`${cacheKey} path missing`);
    const stat = fs.statSync(filePath);
    const memory = this.menuCache.get(cacheKey);
    if (memory && Number(memory.fileMtimeMs) === Number(stat.mtimeMs)) return memory.value;
    const xml = this._readXmlFile(filePath);
    const parsed = parser(xml);
    const entry = { fileMtimeMs: Number(stat.mtimeMs), value: parsed };
    this.menuCache.set(cacheKey, entry);
    return parsed;
  }

  _getMemoryCacheEntry(cache, key) {
    const entry = cache.get(key);
    if (!entry || Number(entry.expiresAt) <= Date.now()) { cache.delete(key); return null; }
    return entry.value;
  }

  _setMemoryCacheEntry(cache, key, value, ttl) { cache.set(key, { expiresAt: Date.now() + Number(ttl), value }); }
  async _getPersistentCacheEntry(key) { return (this.cacheStore?.get) ? this.cacheStore.get(key) : null; }
  async _setPersistentCacheEntry(key, val, ttl) { return (this.cacheStore?.set) ? this.cacheStore.set(key, val, ttl) : false; }

  _readXmlFile(path) {
    const buf = fs.readFileSync(path);
    const head = buf.subarray(0, 256).toString('ascii');
    const enc = (head.match(/encoding=["']([^"']+)["']/i)?.[1] || '').trim().toLowerCase();
    const decoder = /^(euc-kr|cp949|windows-949|ks_c_5601-1987)$/.test(enc) ? 'windows-949' : 'utf-8';
    return new TextDecoder(decoder).decode(buf);
  }

  _notFoundError(msg) { const e = new Error(msg); e.status = 404; return e; }
}

RssServiceBase.sanitizeFeedError = sanitizeFeedError;
module.exports = RssServiceBase;
