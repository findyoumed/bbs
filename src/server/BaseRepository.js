'use strict';

const { createHttpError, isMissingTableError } = require('./httpUtils');

/**
 * [LOG: 20260426_1445] Evolution: Enhanced BaseRepository with performance tracking and health checks.
 * BaseRepository provides a standardized interface and common utilities 
 * for all data access repositories (Member, Board, Chat, etc.)
 */
class BaseRepository {
  constructor(options = {}) {
    this.driverName = options.driverName || 'base';
    this.isReady = true;
    this.logger = options.logger || console;
    
    // Performance metrics
    this.metrics = {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      lastError: null,
      lastErrorClass: null,
      lastErrorTimestamp: null
    };
  }

  /**
   * Returns metadata about the repository state and configuration.
   */
  getMeta() {
    return {
      driver: this.driverName,
      ready: this.isReady,
      timestamp: new Date().toISOString(),
      metrics: {
        ...this.metrics,
        avgDurationMs: this.metrics.calls > 0 
          ? (this.metrics.totalDurationMs / this.metrics.calls).toFixed(2) 
          : 0
      }
    };
  }

  /**
   * Performs a health check on the repository.
   * Can be overridden by subclasses to perform actual DB pings.
   */
  async checkHealth() {
    try {
      this._ensureReady();
      return { status: 'ok', driver: this.driverName };
    } catch (error) {
      return { status: 'error', driver: this.driverName, message: error.message };
    }
  }

  /**
   * Standardized error handler to translate technical errors into 
   * domain-specific HTTP errors.
   */
  _throwError(action, error, context = {}) {
    this.metrics.errors++;
    this.metrics.lastError = error?.message || 'Unknown error';
    const classification = classifyRepositoryError(error);
    this.metrics.lastErrorClass = classification.type;
    this.metrics.lastErrorTimestamp = new Date().toISOString();

    const message = error?.message || 'Unknown error';
    const code = error?.code;
    const status = classification.status;
    
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`[RepositoryError] ${action} failed: ${message}`, { 
        driver: this.driverName, 
        code, 
        ...context,
        error
      });
    }

    // If it's already an HTTP error with a status, just rethrow it
    if (error?._isHttpError && error?.status && error?.message) {
      throw error;
    }

    if (context.table && isMissingTableError(error, context.table)) {
      throw createHttpError(502, `데이터 테이블(${context.table})을 찾을 수 없습니다. 시스템 설정을 확인해주세요.`);
    }

    if (code === '23505' || message.toLowerCase().includes('duplicate key')) {
      throw createHttpError(409, `${action} 중 중복된 데이터가 발견되었습니다.`);
    }

    throw createHttpError(status, classification.clientMessage(action));
  }

  /**
   * High-level wrapper for repository operations.
   * Handles readiness checks, performance tracking, and standardized error handling.
   */
  async _wrap(action, context, fn) {
    this._ensureReady();
    const start = Date.now();
    this.metrics.calls++;
    try {
      const result = await fn();
      return result;
    } catch (error) {
      this._throwError(action, error, context);
    } finally {
      const duration = Date.now() - start;
      this.metrics.totalDurationMs += duration;
    }
  }

  /**
   * Helper to ensure the repository is ready before performing operations.
   */
  _ensureReady() {
    if (!this.isReady) {
      throw createHttpError(503, `저장소(${this.driverName})가 아직 준비되지 않았습니다.`);
    }
  }

  /**
   * Wrapper for repository methods to track performance.
   * 
   * @param {string} methodName - Name of the method for logging
   * @param {Function} fn - The async function to execute
   */
  async _track(methodName, fn) {
    const start = Date.now();
    this.metrics.calls++;
    try {
      return await fn();
    } finally {
      const duration = Date.now() - start;
      this.metrics.totalDurationMs += duration;
    }
  }
}

function classifyRepositoryError(error = {}) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === 'SUPABASE_TIMEOUT' || error?.name === 'SupabaseTimeoutError') {
    return {
      type: 'timeout',
      status: 504,
      clientMessage: (action) => `${action} 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.`
    };
  }
  if (status === 401) {
    return { type: 'unauthorized', status: 401, clientMessage: (action) => `${action} 권한이 없습니다. 다시 로그인해 주세요.` };
  }
  if (status === 403) {
    return { type: 'forbidden', status: 403, clientMessage: (action) => `${action} 권한이 없습니다.` };
  }
  if (status === 409 || code === '23505' || message.includes('duplicate key')) {
    return { type: 'conflict', status: 409, clientMessage: (action) => `${action} 중복 요청이 감지되었습니다.` };
  }
  if (status === 429) {
    return { type: 'rate-limit', status: 429, clientMessage: (action) => `${action} 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.` };
  }
  if (status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504) {
    return { type: 'upstream', status, clientMessage: (action) => `${action} 중 저장소 응답이 불안정합니다. 잠시 후 다시 시도해 주세요.` };
  }
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT'
    || message.includes('fetch failed') || message.includes('network') || message.includes('socket')) {
    return { type: 'network', status: 503, clientMessage: (action) => `${action} 중 데이터 통신망 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.` };
  }
  return { type: 'repository', status: status >= 400 ? status : 502, clientMessage: (action) => `${action} 중 오류가 발생했습니다.` };
}

module.exports = BaseRepository;
module.exports.classifyRepositoryError = classifyRepositoryError;
