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
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    const columns = await this._getColumnMap();

    // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — 상자를 inbox/sent/archive 셋으로
    // 넓혔다. 보관함은 "내가 보관한 것"이므로 받은 쪽지(receiver_archived)와 보낸 쪽지
    // (sender_archived)를 함께 담고, 받은/보낸 상자에서는 보관된 것을 빼서 보여준다.
    if (context.box === 'archive') {
      const { data, error } = await this.client
        .from(this.table)
        .select('*')
        .or(`and(${columns.recipient}.eq.${userId},receiver_archived.is.true),and(${columns.sender}.eq.${userId},sender_archived.is.true)`)
        .order('created_at', { ascending: false });
      if (error) {
        this._throwError('보관함 목록 조회', error, { table: this.table });
      }
      return (data || []).map(normalizeMemo);
    }

    const isSentBox = context.box === 'sent';
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq(isSentBox ? columns.sender : columns.recipient, userId)
      .not(isSentBox ? 'sender_archived' : 'receiver_archived', 'is', true)
      .order('created_at', { ascending: false });
    if (error) {
      this._throwError('메모 목록 조회', error, { table: this.table });
    }
    return (data || []).map(normalizeMemo);
  }

  // [LOG_ID: 20260716_1800] 보관/보관해제. 받은 쪽지면 receiver_archived, 보낸 쪽지면
  // sender_archived를 바꾼다 — 같은 쪽지를 보낸이와 받은이가 서로 간섭 없이 보관한다.
  async setArchived(id, archived, context = {}) {
    const memo = await this.getMemo(id, context);
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    const column = memo.recipientUserId === userId ? 'receiver_archived' : 'sender_archived';

    if (memo.recipientUserId !== userId && memo.senderUserId !== userId) {
      throw createHttpError(403, '쪽지를 보관할 권한이 없습니다.');
    }

    const { data, error } = await this.client
      .from(this.table)
      .update({ [column]: Boolean(archived) })
      .eq('id', memo.id)
      .select('*')
      .single();
    if (error) {
      this._throwError('쪽지 보관 처리', error, { table: this.table });
    }
    return normalizeMemo(data);
  }

  async countUnread(context = {}) {
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    const columns = await this._getColumnMap();
    const { count, error } = await this.client
      .from(this.table)
      .select('*', { count: 'exact', head: true })
      .eq(columns.recipient, userId)
      .eq('is_read', false)
      // [LOG_ID: 20260716_1800] 보관한 쪽지는 받은쪽지함에서 빠지므로 안 읽은 수에서도 뺀다 —
      // 안 그러면 목록엔 없는 쪽지 때문에 미확인 배지가 안 사라진다.
      .not('receiver_archived', 'is', true);
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
    const saveToSent = input.saveToSent !== false;
    const columns = await this._getColumnMap();
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        [columns.sender]: saveToSent ? normalizeText(context.userId, 'guest').toLowerCase() : null,
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
    // [LOG: 20260731_1705] 대소문자 매칭 일치를 위해 소문자 정규화 처리
    const userId = String(context.userId || '').trim().toLowerCase();
    if (memo.recipientUserId !== userId || memo.isRead) {
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
