/**
 * performanceService.js
 * [LOG: 20260430_1000] Evolution Mode 30: System performance monitoring and resource management.
 */

export function createPerformanceService(deps) {
  const { state, logger } = deps;
  
  const metrics = {
    renders: [],
    apiLatency: [],
    cacheHits: 0,
    cacheMisses: 0
  };

  const MAX_HISTORY = 50;

  function createCircularSafeJsonReplacer() {
    const seen = new WeakSet();

    return (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (typeof value === 'function') {
        return `[Function ${value.name || 'anonymous'}]`;
      }

      if (typeof value === 'symbol') {
        return value.toString();
      }

      if (!value || typeof value !== 'object') {
        return value;
      }

      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message
        };
      }

      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
      return value;
    };
  }

  // [LOG: 20260429_0506] PERF state reports must stay readable even when app
  // state contains circular SDK/client references.
  function estimateStateSizeKb(target) {
    try {
      const serialized = JSON.stringify(target, createCircularSafeJsonReplacer()) || '';
      return Math.round(serialized.length / 1024);
    } catch (error) {
      logger?.warn?.(`Failed to estimate state size: ${error.message}`, {
        screen: state.screen
      });
      return 0;
    }
  }

  function recordRender(duration, lineCount, isSkipped) {
    const entry = {
      timestamp: Date.now(),
      duration,
      lineCount,
      isSkipped,
      screen: state.screen
    };
    
    metrics.renders.push(entry);
    if (metrics.renders.length > MAX_HISTORY) {
      metrics.renders.shift();
    }

    if (duration > 1000 && !isSkipped) {
      logger?.warn(`Slow render detected: ${duration}ms for ${lineCount} lines on ${state.screen}`, entry);
    }
  }

  function recordApiLatency(duration, path) {
    const entry = {
      timestamp: Date.now(),
      duration,
      path
    };
    
    metrics.apiLatency.push(entry);
    if (metrics.apiLatency.length > MAX_HISTORY) {
      metrics.apiLatency.shift();
    }
  }

  function recordCache(hit) {
    if (hit) metrics.cacheHits++;
    else metrics.cacheMisses++;
  }

  function getStats() {
    const avgRender = metrics.renders.length 
      ? metrics.renders.reduce((a, b) => a + b.duration, 0) / metrics.renders.length 
      : 0;
    
    const avgApi = metrics.apiLatency.length 
      ? metrics.apiLatency.reduce((a, b) => a + b.duration, 0) / metrics.apiLatency.length 
      : 0;

    return {
      avgRenderTime: Math.round(avgRender),
      lastRenderTime: metrics.renders[metrics.renders.length - 1]?.duration || 0,
      avgApiLatency: Math.round(avgApi),
      cacheHitRate: metrics.cacheHits + metrics.cacheMisses > 0 
        ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100) 
        : 0,
      assetCacheSize: state.assetCache ? Object.keys(state.assetCache).length : 0,
      stateSizeKb: estimateStateSizeKb(state)
    };
  }

  return {
    recordRender,
    recordApiLatency,
    recordCache,
    getStats,
    clearMetrics: () => {
      metrics.renders = [];
      metrics.apiLatency = [];
      metrics.cacheHits = 0;
      metrics.cacheMisses = 0;
    }
  };
}
