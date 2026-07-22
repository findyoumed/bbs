'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');

const {
  createHttpError,
  mergeMemberRecord,
  normalizeLevel,
  normalizeLookup,
  normalizeMember,
  toPublicMember,
  toSupabaseMemberPayload
} = require('./MemberRepositoryShared');

const { buildPaginationMetadata } = require('./queryUtils');
const { hashPassword, isHashedPassword, verifyPasswordHash } = require('./PasswordHashing');

class SupabaseMemberRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
    this.table = options.table || 'members';
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table
    };
  }

  /**
   * [LOG: 20260426_1510] Evolution: Implemented actual health check for SupabaseMemberRepository.
   */
  async checkHealth() {
    try {
      this._ensureReady();
      // Simple query to verify connectivity and table existence
      const { error } = await this.client
        .from(this.table)
        .select('user_id')
        .limit(1);
      
      if (error) throw error;
      return { status: 'ok', driver: this.driverName, table: this.table };
    } catch (error) {
      return { status: 'error', driver: this.driverName, message: error.message };
    }
  }

  async getMember(userId) {
    return this._track('getMember', async () => {
      const normalizedUserId = normalizeLookup(userId);
      if (!normalizedUserId) {
        return null;
      }
      const { data, error } = await this.client
        .from(this.table)
        .select('*')
        .eq('user_id', normalizedUserId)
        .maybeSingle();

      if (error) {
        this._throwError('회원 조회', error, { table: this.table });
      }
      return normalizeMember(data);
    });
  }

  async findByNickName(nickName) {
    return this._findByField('nick_name', nickName);
  }

  async findByEmail(email) {
    return this._findByField('email', email);
  }

  async verifyPassword(userId, password) {
    return this._track('verifyPassword', async () => {
      const normalizedUserId = normalizeLookup(userId);
      if (!normalizedUserId) {
        return false;
      }

      const { data, error } = await this.client
        .from(this.table)
        .select('password')
        .eq('user_id', normalizedUserId)
        .maybeSingle();

      if (error) {
        this._throwError('회원 비밀번호 확인', error, { table: this.table });
      }

      if (!data) {
        return false;
      }

      const ok = verifyPasswordHash(password, data.password);
      // 레거시 평문 비밀번호로 성공한 로그인은 즉시 해시로 조용히 마이그레이션한다.
      if (ok && !isHashedPassword(data.password)) {
        const { error: migrateError } = await this.client
          .from(this.table)
          .update({ password: hashPassword(password) })
          .eq('user_id', normalizedUserId);
        if (migrateError) {
          this._throwError('회원 비밀번호 마이그레이션', migrateError, { table: this.table });
        }
      }

      return ok;
    });
  }

  async ensureMember(input = {}) {
    return this._track('ensureMember', async () => {
      const normalizedUserId = normalizeLookup(input.userId);
      const { data: currentRow, error: currentError } = await this.client
        .from(this.table)
        .select('*')
        .eq('user_id', normalizedUserId)
        .maybeSingle();

      if (currentError) {
        this._throwError('회원 조회', currentError, { table: this.table });
      }

      const current = normalizeMember(currentRow);
      const hasPasswordInput = Object.prototype.hasOwnProperty.call(input, 'password');
      const merged = mergeMemberRecord(normalizedUserId, current, {
        ...input,
        // [LOG: 20260507_1738] Profile/session upserts must not erase the stored member password.
        password: hasPasswordInput ? input.password : (currentRow?.password || '')
      });
      const payload = toSupabaseMemberPayload(merged);
      if (!hasPasswordInput) {
        // [LOG: 20260507_1742] Omit password on profile upserts so Supabase keeps the existing value.
        delete payload.password;
      }
      const { data, error } = await this.client
        .from(this.table)
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) {
        this._throwError('회원 저장', error, { table: this.table });
      }

      return toPublicMember(normalizeMember(data));
    });
  }

  async setLevel(userId, level, defaults = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const existing = await this.getMember(normalizedUserId);
    return this.ensureMember({
      userId: normalizedUserId,
      nickName: defaults.nickName ?? existing?.nickName ?? normalizedUserId,
      email: defaults.email ?? existing?.email ?? '',
      birthday: existing?.birthday ?? '',
      sex: existing?.sex ?? 'M',
      isOpen: existing?.isOpen ?? true,
      isAdmin: defaults.isAdmin ?? existing?.isAdmin ?? false,
      registrationDateTime: existing?.registrationDateTime ?? '',
      lastLoginDateTime: existing?.lastLoginDateTime ?? '',
      level: normalizeLevel(level, existing?.level || 1)
    });
  }

  async setPassword(userId, password, defaults = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const normalizedPassword = String(password || '').trim();
    if (normalizedPassword.length < 6) {
      throw createHttpError(400, '비밀번호는 6자 이상이어야 합니다.');
    }

    const existing = await this.getMember(normalizedUserId);
    const member = mergeMemberRecord(normalizedUserId, existing, {
      nickName: defaults.nickName ?? existing?.nickName ?? normalizedUserId,
      email: defaults.email ?? existing?.email ?? '',
      birthday: existing?.birthday ?? '',
      sex: existing?.sex ?? 'M',
      isOpen: existing?.isOpen ?? true,
      isAdmin: defaults.isAdmin ?? existing?.isAdmin ?? false,
      registrationDateTime: existing?.registrationDateTime ?? '',
      lastLoginDateTime: existing?.lastLoginDateTime ?? '',
      password: hashPassword(normalizedPassword),
      level: (defaults.isAdmin ?? existing?.isAdmin ?? false) ? 99 : normalizeLevel(existing?.level, 1)
    });

    const { data, error } = await this.client
      .from(this.table)
      .upsert(toSupabaseMemberPayload(member), { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      this._throwError('회원 비밀번호 변경', error, { table: this.table });
    }

    return toPublicMember(normalizeMember(data));
  }

  async setEmail(userId, email) {
    const normalizedUserId = normalizeLookup(userId);
    if (!normalizedUserId) {
      throw createHttpError(400, '회원 ID가 필요합니다.');
    }

    const { data, error } = await this.client
      .from(this.table)
      .update({ email: String(email || '').trim() })
      .eq('user_id', normalizedUserId)
      .select('*')
      .single();

    if (error) {
      this._throwError('회원 이메일 변경', error, { table: this.table });
    }

    return toPublicMember(normalizeMember(data));
  }

  // [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) — global.absentMessages(프로세스 메모리
  // Map, 서버 재시작/서버리스 인스턴스 교체마다 소실)를 대체하는 영속 저장(members 테이블
  // absent_start/absent_end/absent_reason 컬럼, 0020_member_absence.sql).
  async setAbsence(userId, { start = null, end = null, reason = '' } = {}) {
    const normalizedUserId = normalizeLookup(userId);
    if (!normalizedUserId) {
      throw createHttpError(400, '회원 ID가 필요합니다.');
    }

    const { data, error } = await this.client
      .from(this.table)
      .update({
        absent_start: start || null,
        absent_end: end || null,
        absent_reason: String(reason || '').trim()
      })
      .eq('user_id', normalizedUserId)
      .select('*')
      .single();

    if (error) {
      this._throwError('부재통지 설정', error, { table: this.table });
    }

    return toPublicMember(normalizeMember(data));
  }

  async deleteMember(userId) {
    const normalizedUserId = normalizeLookup(userId);
    if (!normalizedUserId) {
      throw createHttpError(400, '회원 ID가 필요합니다.');
    }

    const member = await this.getMember(normalizedUserId);
    if (!member) {
      throw createHttpError(404, '회원 정보를 찾을 수 없습니다.');
    }

    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq('user_id', normalizedUserId);

    if (error) {
      this._throwError('회원 삭제', error, { table: this.table });
    }

    return member;
  }

  async countMembers() {
    const { count, error } = await this.client
      .from(this.table)
      .select('user_id', { count: 'exact', head: true });

    if (error) {
      this._throwError('회원 수 조회', error, { table: this.table });
    }

    return Number(count || 0);
  }

  async listMembers(options = {}) {
    const { page, pageSize, offset, limit, orderBy, ascending } = options;
    const start = offset;
    const end = offset + limit - 1;

    let query = this.client
      .from(this.table)
      .select('*', { count: 'exact' });

    // Evolution: 필터링 지원
    if (options.level !== undefined && options.level !== '') {
      query = query.eq('level', Number(options.level));
    }
    if (options.search) {
      const search = `%${options.search}%`;
      query = query.or(`user_id.ilike.${search},nick_name.ilike.${search},email.ilike.${search}`);
    }

    // Evolution: 정렬 지원
    query = query.order(orderBy || 'user_id', { ascending: ascending ?? true });

    const { data, error, count } = await query.range(start, end);

    if (error) {
      this._throwError('회원 목록 조회', error, { table: this.table });
    }

    return {
      items: (data || []).map(normalizeMember).map(toPublicMember),
      ...buildPaginationMetadata(count, page, pageSize),
      orderBy: orderBy || 'user_id',
      orderDirection: (ascending ?? true) ? 'asc' : 'desc'
    };
  }

  async _findByField(column, value) {
    const normalizedValue = normalizeLookup(value);
    if (!normalizedValue) {
      return null;
    }
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq(column, normalizedValue)
      .limit(1)
      .maybeSingle();

    if (error) {
      this._throwError('회원 조회', error, { table: this.table });
    }
    return normalizeMember(data);
  }
}

module.exports = {
  SupabaseMemberRepository
};
