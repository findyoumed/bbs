'use strict';

const BaseRepository = require('./BaseRepository');
const { createSupabaseClient } = require('./createSupabaseClient');

const {
  canAccessMemo,
  createHttpError,
  isMissingMemosTableError,
  isMemoVisibleToRecipient,
  normalizeMemo,
  normalizeText,
  validateMemoInput
} = require('./MemoRepositoryShared');

class SupabaseMemoRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createSupabaseClient(options);
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
      return (data || []).map(normalizeMemo)
        .filter((memo) => isMemoVisibleToRecipient(memo, userId));
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
    return (data || []).map(normalizeMemo)
      .filter((memo) => isSentBox || isMemoVisibleToRecipient(memo, userId));
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
      // [LOG: 20260803_1430] PGRST116(0 rows matched): getMemo()와 update() 사이에 쪽지가
      // 삭제된 경쟁 조건 — 502 오매핑을 404로 수정.
      if (error.code === 'PGRST116') {
        throw createHttpError(404, '쪽지를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
      }
      this._throwError('쪽지 보관 처리', error, { table: this.table });
    }
    return normalizeMemo(data);
  }

  async countUnread(context = {}) {
    // [LOG: 20260731_1750] normalizeText는 trim만 하므로 toLowerCase() 추가 정형화
    const userId = normalizeText(context.userId, 'guest').toLowerCase();
    const columns = await this._getColumnMap();
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq(columns.recipient, userId)
      .eq('is_read', false)
      // [LOG_ID: 20260716_1800] 보관한 쪽지는 받은쪽지함에서 빠지므로 안 읽은 수에서도 뺀다 —
      // 안 그러면 목록엔 없는 쪽지 때문에 미확인 배지가 안 사라진다.
      .not('receiver_archived', 'is', true);
    if (error) {
      this._throwError('미수신 메모 수 조회', error, { table: this.table });
    }
    const visible = (data || []).map(normalizeMemo)
      .filter((memo) => isMemoVisibleToRecipient(memo, userId));
    return { count: visible.length };
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
    if (memo.recipientUserId === normalizeText(context.userId, 'guest').toLowerCase()
      && !isMemoVisibleToRecipient(memo, context.userId)) {
      throw createHttpError(404, '아직 배달되지 않은 쪽지입니다.');
    }
    return memo;
  }

  async createMemo(input = {}, context = {}) {
    const payload = validateMemoInput(input);
    const saveToSent = input.saveToSent !== false;
    const columns = await this._getColumnMap();
    // [LOG_ID: 20260801_1106] saveToSent가 false(보낸편지함에 비저장)인 경우에도 sender_user_id는
    // not-null 컬럼 제약조건 및 수신자의 보낸이 조회를 위해 작성자 ID로 채워져야 한다.
    // 대신 sender_archived 플래그를 true로 주어 보낸편지함 목록에서만 노출을 제외시킨다.
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        [columns.sender]: normalizeText(context.userId, 'guest').toLowerCase(),
        [columns.recipient]: payload.recipientUserId,
        title: payload.title,
        content: payload.content,
        is_read: false,
        sender_archived: !saveToSent
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
      // [LOG: 20260803_1430] PGRST116(0 rows matched): getMemo()와 update() 사이에 쪽지가
      // 삭제된 경쟁 조건. 사용자는 getMemo()에서 이미 쪽지를 읽었으므로 graceful degrade —
      // 갱신 실패를 조용히 흡수하고 이미 읽어 둔 memo를 그대로 반환한다.
      if (error.code === 'PGRST116') {
        return memo;
      }
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

  // [LOG: 20260802_0130] _resolveColumnMap()이 일시적 Supabase 오류로 reject되면
  // rejected Promise(truthy)가 this.columnMapPromise에 영구 저장되어 서버 재시작 전까지
  // 모든 메모 작업이 영구적으로 실패하는 버그 수정 — .catch()에서 null로 초기화해 재시도 허용.
  async _getColumnMap() {
    if (!this.columnMapPromise) {
      this.columnMapPromise = this._resolveColumnMap().catch((err) => {
        this.columnMapPromise = null; // 일시적 오류 시 재시도 허용
        throw err;
      });
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
