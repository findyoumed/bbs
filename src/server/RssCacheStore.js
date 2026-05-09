'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const logger = require('./logger');

function isMissingCacheTableError(error, table) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  return String(error?.code || '') === '42P01'
    || message.includes(`relation "${table}" does not exist`)
    || details.includes(`relation "${table}" does not exist`);
}

class SupabaseRssCacheStore extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
    this.table = options.table || 'rss_cache';
    this.disabled = false;
  }

  getMeta() {
    return {
      ...super.getMeta(),
      ready: !this.disabled,
      table: this.table,
      disabled: this.disabled
    };
  }

  async get(cacheKey) {
    if (this.disabled) {
      return null;
    }

    const { data, error } = await this.client
      .from(this.table)
      .select('value, expires_at')
      .eq('cache_key', String(cacheKey))
      .maybeSingle();

    if (error) {
      this._handleError('read', error, cacheKey);
      return null;
    }

    if (!data) {
      return null;
    }

    const expiresAt = Date.parse(String(data.expires_at || ''));
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      void this.delete(cacheKey);
      return null;
    }

    return data.value ?? null;
  }

  async set(cacheKey, value, ttlMs) {
    if (this.disabled) {
      return false;
    }

    const expiresAt = new Date(Date.now() + Math.max(0, Number(ttlMs) || 0)).toISOString();
    const { error } = await this.client
      .from(this.table)
      .upsert({
        cache_key: String(cacheKey),
        value,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'cache_key'
      });

    if (error) {
      this._handleError('write', error, cacheKey);
      return false;
    }

    return true;
  }

  async delete(cacheKey) {
    if (this.disabled) {
      return false;
    }

    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq('cache_key', String(cacheKey));

    if (error) {
      this._handleError('delete', error, cacheKey);
      return false;
    }

    return true;
  }

  _handleError(action, error, cacheKey) {
    if (isMissingCacheTableError(error, this.table)) {
      this.disabled = true;
      logger.warn('rss cache store disabled because the table is missing', {
        component: 'SupabaseRssCacheStore',
        table: this.table,
        action,
        cacheKey,
        error: error.message
      });
      return;
    }

    logger.warn('rss cache store request failed', {
      component: 'SupabaseRssCacheStore',
      table: this.table,
      action,
      cacheKey,
      error: error.message
    });
  }
}

function createRssCacheStoreFromEnv(env = process.env) {
  const driver = String(env.RSS_CACHE_DRIVER || 'auto').trim().toLowerCase();
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  if (driver === 'memory' || driver === 'off' || driver === 'disabled') {
    return null;
  }

  if (!hasSupabase) {
    return null;
  }

  if (driver !== 'auto' && driver !== 'supabase') {
    return null;
  }

  return new SupabaseRssCacheStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    table: env.RSS_CACHE_TABLE || 'rss_cache'
  });
}

module.exports = {
  SupabaseRssCacheStore,
  createRssCacheStoreFromEnv
};
