'use strict';

function createRateLimiter({ windowMs = 60000, maxRequests = 60, trustProxy = false, maxBuckets = 10000 } = {}) {
  const buckets = new Map();

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of buckets) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        buckets.delete(ip);
      } else {
        buckets.set(ip, filtered);
      }
    }
  }, windowMs);

  if (cleanup.unref) cleanup.unref();

  return function checkRateLimit(req) {
    let ip;
    if (trustProxy) {
      const forwarded = req.headers?.['x-forwarded-for'];
      ip = (forwarded ? forwarded.split(',')[0].trim() : null)
        || req.socket?.remoteAddress
        || 'unknown';
    } else {
      ip = req.socket?.remoteAddress || 'unknown';
    }

    // [LOG: 20260803_1700] buckets.clear() → 최고령 항목 단건 제거.
    // clear()는 10,000개 고유 IP로 버킷을 채우면 모든 rate limit 상태를 한 번에 날려
    // 어떤 IP도 즉시 우회할 수 있는 DoS 벡터가 된다. Map은 삽입 순서를 보존하므로
    // .keys().next().value가 가장 먼저 들어온(= 가장 오래된) IP다.
    if (buckets.size >= maxBuckets) {
      const oldestIp = buckets.keys().next().value;
      if (oldestIp !== undefined) buckets.delete(oldestIp);
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (buckets.get(ip) || []).filter((t) => t > cutoff);
    if (timestamps.length >= maxRequests) {
      return false;
    }
    timestamps.push(now);
    buckets.set(ip, timestamps);
    return true;
  };
}

module.exports = { createRateLimiter };
