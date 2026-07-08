'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const { normalizeText } = require('./httpUtils');
const { describeAction } = require('./activityActionLabels');

/**
 * [LOG: 20260427_0020] ActivityRepositorySupabase Evolution
 * - Persistent activity tracking using Supabase
 * - Auto-cleanup of stale entries via database-side logic or manual calls
 */
class ActivityRepositorySupabase extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.table = options.table || 'user_activities';
    this.ttlMs = Number(options.ttlMs || 1000 * 60 * 30); // Default 30 minutes
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table,
      ttlMs: this.ttlMs
    };
  }

  /**
   * Updates or creates an activity entry for a user
   */
  async touch(context = {}, meta = {}) {
    return this._track('touch', async () => {
      const userId = normalizeText(context.userId, 'guest');
      const nickName = normalizeText(context.nickName, userId === 'guest' ? '손님' : userId);
      const remoteAddr = normalizeText(
        meta.remoteAddress ||
        meta.ip ||
        meta.forwardedFor ||
        '',
        'local'
      );
      
      const now = new Date().toISOString();
      const entry = {
        user_id: userId,
        nickname: nickName,
        remote_addr: remoteAddr,
        level: Number(context.level || 1) || 1,
        is_admin: Boolean(context.isAdmin),
        is_guest: Boolean(context.isGuest),
        path: normalizeText(meta.path, '/'),
        action: normalizeText(meta.action || '', ''),
        description: normalizeText(meta.description || '', ''),
        last_seen_at: now
      };

      // Use upsert based on user_id and remote_addr
      const { data, error } = await this.client
        .from(this.table)
        .upsert(
          { ...entry, first_seen_at: now }, 
          { onConflict: 'user_id, remote_addr', ignoreDuplicates: false }
        )
        .select()
        .single();

      if (error) {
        // If upsert fails (maybe table missing), fallback to base error handler
        this._throwError('touch', error, { table: this.table });
      }

      return this._mapEntry(data);
    });
  }

  /**
   * Returns a sorted list of all active entries
   */
  async list() {
    return this._track('list', async () => {
      const cutoff = new Date(Date.now() - this.ttlMs).toISOString();
      
      const { data, error } = await this.client
        .from(this.table)
        .select('*')
        .gt('last_seen_at', cutoff)
        .order('last_seen_at', { ascending: false });

      if (error) {
        this._throwError('list', error, { table: this.table });
      }

      return (data || []).map(e => this._mapEntry(e));
    });
  }

  /**
   * Returns summary statistics of current activity
   */
  async getStats() {
    return this._track('getStats', async () => {
      const cutoff = new Date(Date.now() - this.ttlMs).toISOString();
      
      const { data, error } = await this.client
        .from(this.table)
        .select('user_id, is_guest')
        .gt('last_seen_at', cutoff);

      if (error) {
        this._throwError('getStats', error, { table: this.table });
      }

      const entries = data || [];
      const memberIds = new Set();
      let guestCount = 0;

      for (const entry of entries) {
        if (entry.is_guest || entry.user_id === 'guest') {
          guestCount++;
        } else {
          memberIds.add(entry.user_id);
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
  async getRecentSummary(limit = 5) {
    return this._track('getRecentSummary', async () => {
      const all = await this.list();
      const stats = await this.getStats();
      
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
   * Helper to map DB columns to JS camelCase
   * @private
   */
  _mapEntry(row) {
    if (!row) return null;
    return {
      userId: row.user_id,
      nickName: row.nickname,
      remoteAddr: row.remote_addr,
      level: row.level,
      isAdmin: row.is_admin,
      isGuest: row.is_guest,
      path: row.path,
      action: row.action,
      description: row.description,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at
    };
  }

  /**
   * Health check for Supabase connection
   */
  async checkHealth() {
    try {
      const { error } = await this.client.from(this.table).select('count', { count: 'exact', head: true }).limit(1);
      if (error) throw error;
      return { status: 'ok', driver: this.driverName };
    } catch (error) {
      return { status: 'error', driver: this.driverName, message: error.message };
    }
  }
}

module.exports = ActivityRepositorySupabase;
