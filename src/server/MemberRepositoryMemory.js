'use strict';

const BaseRepository = require('./BaseRepository');
const {
  createHttpError,
  mergeMemberRecord,
  normalizeLookup,
  sameText,
  toPublicMember
} = require('./MemberRepositoryShared');
const { hashPassword, isHashedPassword, verifyPasswordHash } = require('./PasswordHashing');

const { buildPaginationMetadata } = require('./queryUtils');

class MemoryMemberRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'memory' });
    this.members = new Map([
      ['guest', { userId: 'guest', nickName: '손님', email: '', birthday: '', sex: 'M', level: 1, isOpen: true, isAdmin: false, registrationDateTime: '', lastLoginDateTime: '', password: hashPassword('') }],
      ['sysop', { userId: 'sysop', nickName: '시스옵', email: '', birthday: '', sex: 'M', level: 99, isOpen: true, isAdmin: true, registrationDateTime: '', lastLoginDateTime: '', password: hashPassword('123456') }]
    ]);
  }

  getMeta() {
    return {
      ...super.getMeta(),
      count: this.members.size - 1 // Exclude guest
    };
  }

  async getMember(userId) {
    return toPublicMember(this.members.get(normalizeLookup(userId)) || null);
  }

  async findByNickName(nickName) {
    return this._findByField('nickName', nickName);
  }

  async findByEmail(email) {
    return this._findByField('email', email);
  }

  async verifyPassword(userId, password) {
    const member = this.members.get(normalizeLookup(userId)) || null;
    if (!member) {
      return false;
    }
    const ok = verifyPasswordHash(password, member.password);
    // 레거시 평문 비밀번호로 성공한 로그인은 즉시 해시로 조용히 마이그레이션한다(재로그인/계정
    // 잠김 없이). 신규 계정은 setPassword가 이미 해시를 저장하므로 여기 걸릴 일이 없다.
    if (ok && !isHashedPassword(member.password)) {
      member.password = hashPassword(password);
    }
    return ok;
  }

  async ensureMember(input = {}) {
    const normalizedUserId = normalizeLookup(input.userId);
    const next = mergeMemberRecord(normalizedUserId, this.members.get(normalizedUserId) || null, input);
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  async setLevel(userId, level, defaults = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const current = this.members.get(normalizedUserId) || null;
    const next = mergeMemberRecord(normalizedUserId, current, {
      nickName: defaults.nickName,
      email: defaults.email,
      birthday: current?.birthday ?? '',
      sex: current?.sex ?? 'M',
      isOpen: current?.isOpen ?? true,
      isAdmin: defaults.isAdmin ?? current?.isAdmin ?? false,
      registrationDateTime: current?.registrationDateTime ?? '',
      lastLoginDateTime: current?.lastLoginDateTime ?? '',
      password: current?.password ?? '',
      level
    });
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  async setPassword(userId, password, defaults = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const next = mergeMemberRecord(normalizedUserId, this.members.get(normalizedUserId) || null, {
      nickName: defaults.nickName,
      email: defaults.email,
      isAdmin: defaults.isAdmin,
      password: hashPassword(password)
    });
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  async setEmail(userId, email) {
    const normalizedUserId = normalizeLookup(userId);
    const current = this.members.get(normalizedUserId) || null;
    if (!current) {
      throw createHttpError(404, '회원 정보를 찾을 수 없습니다.');
    }
    const next = mergeMemberRecord(normalizedUserId, current, { email });
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  // [LOG_ID: 20260802_1500] updateProfile 경쟁 조건 수정 — 사용자가 관리하는 프로필 필드
  // (nickName/email/birthday/sex/isOpen)만 갱신하고, 관리자가 관리하는 필드(level/isAdmin/
  // password/registrationDateTime/lastLoginDateTime)는 절대 건드리지 않는 타깃 UPDATE.
  // ensureMember를 쓰면 stale한 existing.level이 관리자 레벨 변경을 덮어쓰는 경쟁 조건이
  // 발생한다(updateProfile이 existing을 읽은 뒤 관리자가 setLevel을 완료했을 때).
  async updateUserProfile(userId, patch = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const current = this.members.get(normalizedUserId) || null;
    if (!current) {
      throw createHttpError(404, '회원 정보를 찾을 수 없습니다.');
    }
    // level/isAdmin/password/registrationDateTime/lastLoginDateTime 은 건드리지 않는다.
    const next = {
      ...current,
      nickName: String(patch.nickName ?? current.nickName ?? '').trim() || normalizedUserId,
      email: String(patch.email ?? current.email ?? '').trim(),
      birthday: String(patch.birthday ?? current.birthday ?? '').trim(),
      sex: String(patch.sex ?? current.sex ?? 'M').trim() || 'M',
      isOpen: Boolean(patch.isOpen ?? current.isOpen ?? true)
    };
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  // [LOG_ID: 20260722_3000] 부재통지(ABSENT/NOMAN) — global.absentMessages(프로세스 메모리
  // Map, 서버 재시작/서버리스 인스턴스 교체마다 소실)를 대체하는 영속 저장.
  async setAbsence(userId, { start = null, end = null, reason = '' } = {}) {
    const normalizedUserId = normalizeLookup(userId);
    const current = this.members.get(normalizedUserId) || null;
    if (!current) {
      throw createHttpError(404, '회원 정보를 찾을 수 없습니다.');
    }
    const next = mergeMemberRecord(normalizedUserId, current, {
      absentStart: start || null,
      absentEnd: end || null,
      absentReason: String(reason || '').trim()
    });
    this.members.set(normalizedUserId, next);
    return toPublicMember(next);
  }

  async deleteMember(userId) {
    const normalizedUserId = normalizeLookup(userId);
    const member = this.members.get(normalizedUserId) || null;
    if (!member) {
      throw createHttpError(404, '회원 정보를 찾을 수 없습니다.');
    }
    this.members.delete(normalizedUserId);
    return toPublicMember(member);
  }

  async countMembers() {
    return Array.from(this.members.values()).filter((member) => normalizeLookup(member?.userId).toLowerCase() !== 'guest').length;
  }

  async listMembers(options = {}) {
    const page = Number(options.page || 1);
    const pageSize = Number(options.pageSize || 20);
    const offset = options.offset !== undefined ? Number(options.offset) : (page - 1) * pageSize;
    const limit = options.limit !== undefined ? Number(options.limit) : pageSize;
    
    const isAscending = options.ascending ?? (options.orderDirection !== 'desc');
    
    let allMembers = Array.from(this.members.values())
      .filter((member) => normalizeLookup(member?.userId).toLowerCase() !== 'guest');

    // Evolution: 필터링 지원
    if (options.level !== undefined && options.level !== '') {
      allMembers = allMembers.filter(m => m.level === Number(options.level));
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      allMembers = allMembers.filter(m => 
        String(m.userId || '').toLowerCase().includes(s) || 
        String(m.nickName || '').toLowerCase().includes(s) || 
        String(m.email || '').toLowerCase().includes(s)
      );
    }

    // Evolution: 정렬 지원
    const sortField = options.orderBy || 'userId';
    const direction = isAscending ? 1 : -1;
    allMembers.sort((a, b) => {
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();
      return valA < valB ? -direction : (valA > valB ? direction : 0);
    });
    
    const items = allMembers.slice(offset, offset + limit).map(toPublicMember);
    
    return {
      items,
      ...buildPaginationMetadata(allMembers.length, page, pageSize),
      orderBy: sortField,
      orderDirection: isAscending ? 'asc' : 'desc'
    };
  }

  async _findByField(field, value) {
    const normalizedValue = normalizeLookup(value);
    if (!normalizedValue) {
      return null;
    }
    for (const member of this.members.values()) {
      if (sameText(member[field], normalizedValue)) {
        return toPublicMember(member);
      }
    }
    return null;
  }
}

module.exports = {
  MemoryMemberRepository
};
