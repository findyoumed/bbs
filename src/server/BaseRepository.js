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
    this.metrics.lastErrorTimestamp = new Date().toISOString();

    const message = error?.message || 'Unknown error';
    const code = error?.code;
    const status = error?.status || 502;
    
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`[RepositoryError] ${action} failed: ${message}`, { 
        driver: this.driverName, 
        code, 
        ...context,
        error
      });
    }

    // If it's already an HTTP error with a status, just rethrow it
    if (error?.status && error?.message) {
      throw error;
    }

    if (context.table && isMissingTableError(error, context.table)) {
      throw createHttpError(502, `데이터 테이블(${context.table})을 찾을 수 없습니다. 시스템 설정을 확인해주세요.`);
    }

    if (code === '23505' || message.toLowerCase().includes('duplicate key')) {
      throw createHttpError(409, `${action} 중 중복된 데이터가 발견되었습니다.`);
    }

    throw createHttpError(status, `${action} 중 오류가 발생했습니다: ${message}`);
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

module.exports = BaseRepository;
