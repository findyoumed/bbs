'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');

const {
  canAccessMemo,
  createHttpError,
  isMissingMemosTableError,
  normalizeMemo,
  normalizeText,
  validateMemoInput
} = require('./MemoRepositoryShared');

class SupabaseMemoRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
    this.table = options.table || 'memos';
    this.columnMapPromise = null;
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table
    };
  }

  async listForUser(context = {}) {
    const userId = normalizeText(context.userId, 'guest');
    const columns = await this._getColumnMap();
    const isSentBox = context.box === 'sent';
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq(isSentBox ? columns.sender : columns.recipient, userId)
      .order('created_at', { ascending: false });
    if (error) {
      this._throwError('메모 목록 조회', error, { table: this.table });
    }
    return (data || []).map(normalizeMemo);
  }

  async countUnread(context = {}) {
    const userId = normalizeText(context.userId, 'guest');
    const columns = await this._getColumnMap();
    const { count, error } = await this.client
      .from(this.table)
      .select('*', { count: 'exact', head: true })
      .eq(columns.recipient, userId)
      .eq('is_read', false);
    if (error) {
      this._throwError('미수신 메모 수 조회', error, { table: this.table });
    }
    return { count: count || 0 };
  }

  async getMemo(id, context = {}) {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) {
      this._throwError('메모 조회', error, { table: this.table });
    }
    const memo = normalizeMemo(data);
    if (!memo) {
      throw createHttpError(404, '메모를 찾을 수 없습니다.');
    }
    if (!canAccessMemo(memo, context)) {
      throw createHttpError(403, '메모를 볼 권한이 없습니다.');
    }
    return memo;
  }

  async createMemo(input = {}, context = {}) {
    const payload = validateMemoInput(input);
    const columns = await this._getColumnMap();
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        [columns.sender]: normalizeText(context.userId, 'guest'),
        [columns.recipient]: payload.recipientUserId,
        title: payload.title,
        content: payload.content,
        is_read: false
      })
      .select('*')
      .single();
    if (error) {
      this._throwError('메모 저장', error, { table: this.table });
    }
    return normalizeMemo(data);
  }

  async markRead(id, context = {}) {
    const memo = await this.getMemo(id, context);
    if (memo.recipientUserId !== context.userId || memo.isRead) {
      return memo;
    }
    const { data, error } = await this.client
      .from(this.table)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', memo.id)
      .select('*')
      .single();
    if (error) {
      this._throwError('메모 읽음 처리', error, { table: this.table });
    }
    return normalizeMemo(data);
  }

  async deleteMemo(id, context = {}) {
    const memo = await this.getMemo(id, context);
    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq('id', memo.id);
    if (error) {
      this._throwError('메모 삭제', error, { table: this.table });
    }
    return memo;
  }

  async _getColumnMap() {
    if (!this.columnMapPromise) {
      this.columnMapPromise = this._resolveColumnMap();
    }
    return this.columnMapPromise;
  }

  async _resolveColumnMap() {
    return {
      sender: await this._pickColumn(['sender_user_id', 'sender_id'], '보내는 사람'),
      recipient: await this._pickColumn(['recipient_user_id', 'receiver_id'], '받는 사람')
    };
  }

  async _pickColumn(candidates, label) {
    let lastError = null;
    for (const column of candidates) {
      const { error } = await this.client
        .from(this.table)
        .select(column)
        .limit(1);
      if (!error) {
        return column;
      }
      if (isMissingMemosTableError(error, this.table)) {
        this._throwError('메모 스키마 조회', error, { table: this.table });
      }
      lastError = error;
    }
    throw createHttpError(502, `메모 스키마(${this.table})에서 ${label} 컬럼을 찾을 수 없습니다. Supabase 마이그레이션을 진행해주세요: ${lastError?.message || 'unknown error'}`);
  }
}

module.exports = {
  SupabaseMemoRepository
};
