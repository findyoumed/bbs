'use strict';
const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const { buildSystemMessage, createHttpError, maybeUuid, normalizeMaxUser, normalizeRoomSecret, normalizeRoomText, normalizeSessionKey, normalizeText, publicRoom, summarizeParticipantCounts, roomKeyForNo } = require('./ChatRoomRepositoryShared');
const { ChatRoomMemberPersistence } = require('./ChatRoomMemberPersistence');
const { ChatRoomRepositorySupabaseQueries } = require('./ChatRoomRepositorySupabaseQueries');

class SupabaseChatRoomRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, { auth: { persistSession: false } });
    this.table = options.table || 'chat_rooms';
    this.membersTable = options.membersTable || 'chat_room_members';
    this.participantTtlMs = Number(options.participantTtlMs ?? 1000 * 60 * 60 * 6);
    this.roomTtlMs = Number(options.roomTtlMs ?? 0);
    this.defaultRoom = options.defaultRoom !== false;
    this.participantsByRoomNo = new Map();
    this.messagesByRoomNo = new Map();
    this.defaultRoomPromise = null;
    this.memberPersistence = new ChatRoomMemberPersistence({ client: this.client, membersTable: this.membersTable, participantTtlMs: this.participantTtlMs });
    this.queries = new ChatRoomRepositorySupabaseQueries(this.client, this.table);
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table,
      membersTable: this.membersTable,
      participantPersistence: 'auth-members:database, sessions:memory'
    };
  }

  async list() {
    await this._ensureDefaultRoom(); await this._cleanup();
    const rows = await this.queries.listRows();
    const authCounts = await this.memberPersistence.loadActiveAuthMemberCounts(rows.map(r => r.id));
    return rows.map(r => this._toPublicRoom(r, summarizeParticipantCounts(this._participantsForRoom(r.room_no), authCounts.get(r.id) || 0)));
  }

  async get(roomNo) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const row = await this.queries.findRoomByNo(roomNo);
    const authCount = await this.memberPersistence.loadActiveAuthMemberCount(row.id);
    return this._toPublicRoom(row, summarizeParticipantCounts(this._participantsForRoom(row.room_no), authCount));
  }

  async create(payload = {}, context = {}) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const title = normalizeRoomText(payload.title); if (!title) throw createHttpError(400, '제목 필수');
    const greeting = normalizeRoomText(payload.greeting); if (!greeting) throw createHttpError(400, '환영 메시지 필수');
    const isPrivate = ['private', 'secret', '2'].includes(normalizeText(payload.visibility || payload.mode || 'public').toLowerCase());
    const password = isPrivate ? normalizeRoomSecret(payload.password || '') : '';
    if (isPrivate && password.length < 4) throw createHttpError(400, '비밀번호 4자 이상');

    for (let i = 0; i < 5; i++) {
      const nextNo = await this.queries.nextRoomNo();
      const { data, error } = await this.client.from(this.table).insert({
        // [LOG_ID: 20260727_1256] 개설 API 경로(chatServiceRoutes.js validate)는 제목을 100자로
        // 검증·거부하는데 여기 저장 상한은 60이라, 61~100자 제목은 검증을 통과해놓고 이 저장
        // 단계에서 조용히 60자로 잘렸다(실측: 90자 제목 → 검증 통과 → 저장은 60자, 안내 없음).
        room_no: nextNo, room_key: roomKeyForNo(nextNo), name: title.slice(0, 100), description: greeting.slice(0, 120),
        owner_user_id: normalizeText(context.userId, 'guest'), owner_name: normalizeText(context.nickName, '손님'),
        creator_id: maybeUuid(context.userId), max_user: normalizeMaxUser(payload.maxUser, 10), password, is_private: isPrivate, is_locked: false, last_activity_at: new Date().toISOString()
      }).select(this.queries._selectColumns()).single();
      if (!error) return this._toPublicRoom(data);
      if (!this._isConflict(error)) throw createHttpError(502, `생성 실패: ${error.message}`);
    }
    throw createHttpError(502, '방 번호 할당 실패');
  }

  async join(roomNo, payload = {}, context = {}) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const room = await this.queries.findRoomByNo(roomNo);
    if (room.password && room.password !== normalizeRoomSecret(payload.password || '')) throw createHttpError(403, '비밀번호 틀림');
    const sessionKey = normalizeSessionKey(payload.sessionKey), participants = this._participantsForRoom(room.room_no);
    const existing = participants.find(p => p.sessionKey === sessionKey), now = new Date().toISOString();
    // [LOG_ID: 20260727_1401] authUserId(진짜 Supabase Auth UUID)를 별도로 들고 다녀야 한다 —
    // userId는 이 앱 자체 텍스트 ID라 chat_room_members.user_id(auth.users FK)에 못 쓴다.
    const p = { sessionKey, userId: normalizeText(context.userId, 'guest'), authUserId: maybeUuid(context.authUserId) || '', nickName: normalizeText(context.nickName, '손님'), joinedAt: existing?.joinedAt || now, lastSeenAt: now };
    const authCount = await this.memberPersistence.loadActiveAuthMemberCount(room.id);
    const nextSummary = summarizeParticipantCounts(existing ? participants.map(e => e.sessionKey === sessionKey ? p : e) : participants.concat([p]), authCount);
    if (!existing && nextSummary.userCount > normalizeMaxUser(room.max_user, 99)) throw createHttpError(409, '정원 초과');
    if (existing) Object.assign(existing, p); else participants.push(p);
    this.participantsByRoomNo.set(Number(room.room_no), participants);
    // [LOG_ID: 20260722_2800] 원전(그림 6.2) 입장 알림 재현 — Memory 드라이버와 동일.
    this._pushSystemMessage(room.room_no, 'join', p.userId, p.nickName);
    await this.memberPersistence.persistJoin(room, p); await this._touch(room.room_no);
    room.last_activity_at = now; return this._toPublicRoom(room, nextSummary);
  }

  async leave(roomNo, payload = {}, context = {}) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const room = await this.queries.findRoomByNo(roomNo), sessionKey = payload.sessionKey ? normalizeSessionKey(payload.sessionKey) : '';

    const participants = this._participantsForRoom(room.room_no);
    const leaving = sessionKey ? participants.find(p => p.sessionKey === sessionKey) : null;
    const filtered = participants.filter(p => p.sessionKey !== sessionKey);

    // [LOG_ID: 20260721_0500] 방장이 여러 세션(다중 탭/기기)으로 입장했을 때 방장의 "첫" 세션만
    // ownerSessionByRoomNo에 못박혀 있어, 그 세션만 나가도 방장이 다른 세션으로 여전히 남아있는데
    // 방 전체가 종료되던 버그(Memory 드라이버와 동일 패턴) — 남은 참여자 중 방장(userId 기준)이
    // 하나도 없을 때만 방을 종료하도록 수정. 기본방(#1)은 계속 예외.
    const ownerHasOtherSession = filtered.some(p => p.userId === room.owner_user_id);
    if (leaving && leaving.userId === room.owner_user_id && !ownerHasOtherSession && Number(room.room_no) !== 1) {
      this.participantsByRoomNo.delete(Number(room.room_no));
      this.messagesByRoomNo.delete(Number(room.room_no));
      await this.client.from(this.table).delete().eq('room_no', room.room_no);
      return this._toPublicRoom({ ...room, _closed: true }, summarizeParticipantCounts([]));
    }

    if (filtered.length) this.participantsByRoomNo.set(Number(room.room_no), filtered); else this.participantsByRoomNo.delete(Number(room.room_no));
    // [LOG_ID: 20260722_2800] 원전(그림 6.2) 퇴장 알림 재현 — 방이 통째로 종료되는 위 분기는
    // 메시지 저장소 자체를 지우므로 거기서는 남기지 않는다(Memory 드라이버와 동일 원칙).
    if (leaving) {
      this._pushSystemMessage(room.room_no, 'leave', leaving.userId, leaving.nickName);
    }
    await this.memberPersistence.persistLeave(room, payload, context, filtered);
    const authCount = await this.memberPersistence.loadActiveAuthMemberCount(room.id);
    await this._touch(room.room_no); room.last_activity_at = new Date().toISOString();
    return this._toPublicRoom(room, summarizeParticipantCounts(filtered, authCount));
  }

  // [LOG_ID: 20260714_2200] 원전 /OUT id(강퇴) 재현 — 방 개설자(owner_user_id)만 실행 가능.
  // 세션 목록에서만 제거(참여자 수/목록에 즉시 반영) — leave()도 메시지 전송을 별도로 막지
  // 않는 동일한 얕은 프레즌스 모델이라, 강퇴도 그 이상을 강제하지 않는다.
  async kick(roomNo, targetUserId, context = {}) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const room = await this.queries.findRoomByNo(roomNo);
    const requesterId = normalizeText(context.userId, 'guest');
    if (room.owner_user_id !== requesterId) throw createHttpError(403, '방 개설자만 강퇴할 수 있습니다.');
    const target = normalizeText(targetUserId, '');
    const participants = this._participantsForRoom(room.room_no);
    const before = participants.length;
    const filtered = participants.filter(p => p.userId !== target);
    if (filtered.length === before) throw createHttpError(404, '해당 이용자가 방에 없습니다.');
    if (filtered.length) this.participantsByRoomNo.set(Number(room.room_no), filtered); else this.participantsByRoomNo.delete(Number(room.room_no));
    const authCount = await this.memberPersistence.loadActiveAuthMemberCount(room.id);
    return this._toPublicRoom(room, summarizeParticipantCounts(filtered, authCount));
  }

  // [LOG_ID: 20260714_2200] 원전 /E TITLE, /E USER(방 설정 변경) 재현 — 방 개설자 전용.
  async updateRoom(roomNo, payload = {}, context = {}) {
    await this._ensureDefaultRoom(); await this._cleanup();
    const room = await this.queries.findRoomByNo(roomNo);
    const requesterId = normalizeText(context.userId, 'guest');
    if (room.owner_user_id !== requesterId) throw createHttpError(403, '방 개설자만 설정을 변경할 수 있습니다.');
    const updates = {};
    if (payload.title !== undefined) {
      const title = normalizeRoomText(payload.title);
      if (!title) throw createHttpError(400, '방 제목을 입력해 주세요.');
      // [LOG_ID: 20260727_1256] 개설 API(POST /api/chat/rooms)는 제목을 100자로 검증·거부하는데
      // (chatServiceRoutes.js validate, LOG_ID 20260727_1215) 여기 저장 상한은 60이라 61~100자
      // 제목은 검증을 통과해놓고 저장 단계에서 조용히 60자로 잘렸다. 검증이 약속하는 값(100)을
      // 저장 상한도 그대로 지키게 맞춘다. DB 컬럼(chat_rooms.name)은 TEXT라 길이 제약 없음.
      updates.name = title.slice(0, 100);
    }
    if (payload.maxUser !== undefined) {
      updates.max_user = normalizeMaxUser(payload.maxUser, room.max_user);
    }
    if (Object.keys(updates).length === 0) return this._toPublicRoom(room);
    const { data, error } = await this.client.from(this.table).update(updates).eq('room_no', Number(roomNo)).select(this.queries._selectColumns()).single();
    if (error) throw createHttpError(502, `수정 실패: ${error.message}`);
    return this._toPublicRoom(data);
  }

  // [LOG_ID: 20260722_0100] 회원탈퇴 시 그 회원이 방장인 대화방이 정리되지 않으면, 다시는
  // 로그인할 수 없는 아이디가 owner_user_id로 영원히 남아 그 방의 설정변경(/E)·강퇴(/OUT) 같은
  // 방장 전용 기능이 영구적으로 막힌다. 기존 leave()가 "방장이 나가면 방 종료"하는 정책과
  // 동일하게, 탈퇴 시점에도 같은 정책을 적용한다(기본방#1은 leave()와 동일하게 예외).
  async closeRoomsOwnedBy(userId) {
    const target = normalizeText(userId, '');
    if (!target) return 0;

    const { data: rooms, error } = await this.client
      .from(this.table)
      .select('room_no')
      .eq('owner_user_id', target)
      .neq('room_no', 1);

    if (error) throw createHttpError(502, `방 조회 실패: ${error.message}`);

    const roomNos = (rooms || []).map((row) => Number(row.room_no)).filter((n) => Number.isFinite(n));
    if (!roomNos.length) return 0;

    roomNos.forEach((no) => {
      this.participantsByRoomNo.delete(no);
      this.messagesByRoomNo.delete(no);
    });

    const { error: deleteError } = await this.client.from(this.table).delete().in('room_no', roomNos);
    if (deleteError) throw createHttpError(502, `방 삭제 실패: ${deleteError.message}`);

    return roomNos.length;
  }

  async sendMessage(roomNo, payload = {}, context = {}) {
    const num = Number(roomNo);
    const msg = {
      id: Date.now() + Math.random(),
      userId: normalizeText(context.userId, 'guest'),
      nickName: normalizeText(context.nickName, '손님'),
      content: normalizeText(payload.content),
      createdAt: new Date().toISOString()
    };
    this._appendMessage(num, msg);
    await this._touch(num);
    return msg;
  }

  // [LOG_ID: 20260722_2800] join()/leave() 공용 — Memory 드라이버와 동일한 원리.
  _pushSystemMessage(roomNo, eventType, userId, nickName) {
    this._appendMessage(roomNo, buildSystemMessage(eventType, userId, nickName));
  }

  _appendMessage(roomNo, message) {
    const num = Number(roomNo);
    const messages = this.messagesByRoomNo.get(num) || [];
    messages.push(message);
    if (messages.length > 100) messages.shift(); // 최근 100개 유지
    this.messagesByRoomNo.set(num, messages);
  }

  async listMessages(roomNo) {
    await this.queries.findRoomByNo(roomNo);
    return this.messagesByRoomNo.get(Number(roomNo)) || [];
  }

  _toPublicRoom(row, summary = null) {
    const n = Number(row.room_no || 0);
    return publicRoom({ no: n, roomId: normalizeText(row.room_key, roomKeyForNo(n)), title: row.name, greeting: row.description, ownerUserId: row.owner_user_id, ownerName: row.owner_name, maxUser: row.max_user, password: row.password, isPrivate: row.is_private, createdAt: row.created_at, participants: this._participantsForRoom(n) }, summary || summarizeParticipantCounts(this._participantsForRoom(n), 0));
  }

  _participantsForRoom(no) {
    const num = Number(no || 0), list = (this.participantsByRoomNo.get(num) || []).filter(p => Date.parse(p.lastSeenAt || p.joinedAt) >= Date.now() - this.participantTtlMs);
    if (list.length) this.participantsByRoomNo.set(num, list); else this.participantsByRoomNo.delete(num);
    return list;
  }

  async _cleanup() {
    Array.from(this.participantsByRoomNo.keys()).forEach(n => this._participantsForRoom(n));
    await this.memberPersistence.cleanupExpired();
    if (this.roomTtlMs <= 0) return;
    const { data, error } = await this.client.from(this.table).select('room_no').neq('room_no', 1).eq('is_locked', false).lt('last_activity_at', new Date(Date.now() - this.roomTtlMs).toISOString());
    if (error) return;
    for (const r of data || []) {
      if (this._participantsForRoom(r.room_no).length === 0) await this.client.from(this.table).delete().eq('room_no', r.room_no);
    }
  }

  async _ensureDefaultRoom() {
    if (!this.defaultRoom) return;
    if (!this.defaultRoomPromise) this.defaultRoomPromise = (async () => {
      const { data } = await this.client.from(this.table).select('id').eq('room_no', 1).maybeSingle();
      return data || await this.queries.createDefaultRoom();
    })();
    await this.defaultRoomPromise;
  }

  _isConflict(e) { return String(e?.message).toLowerCase().includes('duplicate key'); }
  async _touch(n) { await this.client.from(this.table).update({ last_activity_at: new Date().toISOString() }).eq('room_no', Number(n)); }
}

module.exports = { SupabaseChatRoomRepository };
