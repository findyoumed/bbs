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

    if (buckets.size >= maxBuckets) {
      buckets.clear();
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
