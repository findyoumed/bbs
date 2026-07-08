'use strict';

const BaseRepository = require('./BaseRepository');
const { normalizeText } = require('./httpUtils');
const { describeAction } = require('./activityActionLabels');

/**
 * [LOG: 20260426_2350] ActivityRepository Evolution
 * - Inherit from BaseRepository
 * - Added getMeta() for repository standardization
 * - Optimized _cleanup() with time-based throttling
 * - Enhanced touch() with action/description support
 * - Added getStats() for high-level activity overview
 * [LOG: 20260427_0010] Further Evolution
 * - Integrated _track() for performance monitoring
 * - Added getRecentSummary() for human-readable activity reports
 */
class ActivityRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'memory' });
    this.ttlMs = Number(options.ttlMs || 1000 * 60 * 30); // Default 30 minutes
    this.entries = new Map();
    this._lastCleanupAt = 0;
  }

  /**
   * Repository metadata for diagnostics
   */
  getMeta() {
    return {
      ...super.getMeta(),
      entryCount: this.entries.size,
      ttlMs: this.ttlMs,
      lastCleanupAt: this._lastCleanupAt ? new Date(this._lastCleanupAt).toISOString() : null
    };
  }

  /**
   * Updates or creates an activity entry for a user
   */
  touch(context = {}, meta = {}) {
    return this._trackSync('touch', () => {
      const userId = normalizeText(context.userId, 'guest');
      const nickName = normalizeText(context.nickName, userId === 'guest' ? '손님' : userId);
      const remoteAddr = normalizeText(
        meta.remoteAddress ||
        meta.ip ||
        meta.forwardedFor ||
        '',
        'local'
      );
      
      const key = `${userId}::${remoteAddr}`;
      const now = new Date();
      const nowIso = now.toISOString();
      
      const current = this.entries.get(key) || {
        userId,
        nickName,
        remoteAddr,
        firstSeenAt: nowIso
      };

      current.userId = userId;
      current.nickName = nickName;
      current.level = Number(context.level || 1) || 1;
      current.isAdmin = Boolean(context.isAdmin);
      current.isGuest = Boolean(context.isGuest);
      current.path = normalizeText(meta.path, current.path || '/');
      current.action = normalizeText(meta.action || '', current.action || '');
      current.description = normalizeText(meta.description || '', current.description || '');
      current.lastSeenAt = nowIso;

      this.entries.set(key, current);
      
      // Optimized cleanup: Only run if it's been more than 1 minute since last run
      if (Date.now() - this._lastCleanupAt > 60000) {
        this._cleanup();
      }
      
      return { ...current };
    });
  }

  /**
   * Returns a sorted list of all active entries
   */
  list() {
    return this._trackSync('list', () => {
      this._cleanup();
      return Array.from(this.entries.values())
        .sort((left, right) => Date.parse(right.lastSeenAt || 0) - Date.parse(left.lastSeenAt || 0))
        .map((entry) => ({ ...entry }));
    });
  }

  /**
   * Returns summary statistics of current activity
   */
  getStats() {
    return this._trackSync('getStats', () => {
      const entries = Array.from(this.entries.values());
      const memberIds = new Set();
      let guestCount = 0;

      for (const entry of entries) {
        if (entry.isGuest || entry.userId === 'guest') {
          guestCount++;
        } else {
          memberIds.add(entry.userId);
        }
      }

      return {
        totalConnections: entries.length,
        activeMembers: memberIds.size,
        activeGuests: guestCount,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Generates a human-readable summary of recent activities
   */
  getRecentSummary(limit = 5) {
    return this._trackSync('getRecentSummary', () => {
      const all = this.list();
      const stats = this.getStats();
      
      const recentActions = all
        .filter(e => e.action || e.description)
        .slice(0, limit)
        .map(e => `${e.nickName}님이 ${e.description || describeAction(e.action)}입니다.`);

      return {
        summary: `${stats.activeMembers}명의 회원과 ${stats.activeGuests}명의 손님이 접속 중입니다.`,
        recentActions,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Synchronous version of _track for memory-based operations
   * @private
   */
  _trackSync(methodName, fn) {
    const start = Date.now();
    this.metrics.calls++;
    try {
      return fn();
    } catch (error) {
      this._throwError(methodName, error);
    } finally {
      const duration = Date.now() - start;
      this.metrics.totalDurationMs += duration;
    }
  }

  /**
   * Removes stale entries based on TTL
   * @private
   */
  _cleanup() {
    const now = Date.now();
    this._lastCleanupAt = now;
    const cutoff = now - this.ttlMs;
    
    for (const [key, entry] of this.entries.entries()) {
      const lastSeen = Date.parse(entry.lastSeenAt || entry.firstSeenAt || '');
      if (Number.isNaN(lastSeen) || lastSeen < cutoff) {
        this.entries.delete(key);
      }
    }
  }
}

function createActivityRepository(options = {}) {
  return new ActivityRepository(options);
}

module.exports = {
  ActivityRepository,
  createActivityRepository
};
