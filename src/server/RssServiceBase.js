'use strict';
const fs = require('fs');

class RssServiceBase {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || global.fetch;
    // [LOG: 20260610_1505] Extend news/weather cache TTL to 15 minutes to reduce server load
    this.cacheTtlMs = Number(options.cacheTtlMs || 15 * 60 * 1000);
    this.menuCacheTtlMs = Number(options.menuCacheTtlMs || 60 * 60 * 1000);
    this.cacheStore = options.cacheStore || null;
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
      // [LOG: 20260610_1500] Add 3 second timeout to avoid hanging on slow RSS servers
      const res = await this.fetchImpl(url, {
        headers: { 'User-Agent': 'OldDOS-BBS Web RSS Fetcher' },
        signal: AbortSignal.timeout(3000)
      });
      if (!res?.ok) throw new Error(`upstream failed${res?.status ? ` (${res.status})` : ''}`);
      val = parser(await res.text());
    } catch (e) { val = { unavailable: true, message: `피드 오류: ${e.message}`, items: [] }; }
    this._setMemoryCacheEntry(this.feedCache, cacheKey, val, this.cacheTtlMs);
    await this._setPersistentCacheEntry(storeKey, val, this.cacheTtlMs);
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

module.exports = RssServiceBase;
