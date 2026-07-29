'use strict';

// [LOG_ID: 20260719_1600] 토론의 광장(CONF) — Supabase 저장소. Memory 드라이버와 동일 의미.
// 테이블: conf_rooms / conf_agendas / conf_seconds (supabase/migrations/0019_conf_system.sql).
const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const { createHttpError } = require('./httpUtils');

function normText(value, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

class SupabaseConfRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, { auth: { persistSession: false } });
    this.roomsTable = options.roomsTable || 'conf_rooms';
    this.agendasTable = options.agendasTable || 'conf_agendas';
    this.secondsTable = options.secondsTable || 'conf_seconds';
  }

  getMeta() {
    return { ...super.getMeta(), roomsTable: this.roomsTable, agendasTable: this.agendasTable, secondsTable: this.secondsTable };
  }

  _fail(label, error) {
    throw createHttpError(502, `${label} 실패: ${error.message}`);
  }

  async _agendaCount(roomNo) {
    const { count, error } = await this.client.from(this.agendasTable)
      .select('id', { count: 'exact', head: true }).eq('room_no', Number(roomNo));
    if (error) this._fail('안건 수 조회', error);
    return count || 0;
  }

  _publicRoom(row, agendaCount) {
    return {
      no: Number(row.room_no),
      title: row.title,
      owner: row.owner_user_id,
      ownerName: row.owner_name,
      isOpen: row.is_open !== false,
      agendaCount: Number(agendaCount || 0),
      createdAt: row.created_at
    };
  }

  async _publicAgenda(row, context = {}) {
    const myId = normText(context.userId, 'guest');
    const { count, error } = await this.client.from(this.secondsTable)
      .select('id', { count: 'exact', head: true }).eq('agenda_id', row.id);
    if (error) this._fail('재청 수 조회', error);
    const { data: mine } = await this.client.from(this.secondsTable)
      .select('id').eq('agenda_id', row.id).eq('user_id', myId).maybeSingle();
    return {
      id: row.id,
      roomNo: Number(row.room_no),
      no: Number(row.agenda_no),
      title: row.title,
      content: row.content || '',
      author: row.author_id,
      authorName: row.author_name,
      secondCount: count || 0,
      seconded: Boolean(mine),
      createdAt: row.created_at
    };
  }

  async _findRoomRow(roomNo) {
    const { data, error } = await this.client.from(this.roomsTable)
      .select('*').eq('room_no', Number(roomNo)).maybeSingle();
    if (error) this._fail('회의실 조회', error);
    if (!data) throw createHttpError(404, '회의실을 찾을 수 없습니다.');
    return data;
  }

  // ── 회의실 ──
  // [LOG_ID: 20260721_1010] 방마다 안건 수를 순차 await로 조회하던 N+1 쿼리를
  // Promise.all로 병렬화 — 회의실이 많을수록 목록 조회가 방 개수에 비례해 느려지던 문제.
  async listRooms(options = {}) {
    let query = this.client.from(this.roomsTable).select('*').order('room_no', { ascending: false });
    if (options.includeClosed !== true) query = query.eq('is_open', true);
    const { data, error } = await query;
    if (error) this._fail('회의실 목록 조회', error);
    return Promise.all((data || []).map(async (row) => this._publicRoom(row, await this._agendaCount(row.room_no))));
  }

  async createRoom(payload = {}, context = {}) {
    const title = normText(payload.title);
    if (!title) throw createHttpError(400, '회의실 제목을 입력해 주세요.');
    // room_no 할당 — 현재 최대 + 1 (UNIQUE 충돌 시 재시도).
    for (let i = 0; i < 5; i++) {
      const { data: maxRow } = await this.client.from(this.roomsTable)
        .select('room_no').order('room_no', { ascending: false }).limit(1).maybeSingle();
      const nextNo = (maxRow ? Number(maxRow.room_no) : 0) + 1;
      const { data, error } = await this.client.from(this.roomsTable).insert({
        room_no: nextNo, title: title.slice(0, 60),
        owner_user_id: normText(context.userId, 'guest'), owner_name: normText(context.nickName, '손님'),
        is_open: true, created_at: new Date().toISOString()
      }).select('*').single();
      if (!error) return this._publicRoom(data, 0);
      if (!/duplicate|unique/i.test(error.message)) this._fail('회의실 생성', error);
    }
    throw createHttpError(502, '회의실 번호 할당 실패');
  }

  async closeRoom(roomNo, context = {}) {
    const room = await this._findRoomRow(roomNo);
    const requesterId = normText(context.userId, 'guest');
    if (room.owner_user_id !== requesterId && !context.isAdmin) {
      throw createHttpError(403, '회의실 개설자만 닫을 수 있습니다.');
    }
    const { data, error } = await this.client.from(this.roomsTable)
      .update({ is_open: false, closed_at: new Date().toISOString() })
      .eq('room_no', Number(roomNo)).select('*').single();
    if (error) this._fail('회의실 닫기', error);
    return this._publicRoom(data, await this._agendaCount(roomNo));
  }

  // ── 안건 ──
  // [LOG_ID: 20260721_1010] 안건마다 재청 수를 순차 await로 조회하던 N+1 쿼리를 병렬화.
  async listAgendas(roomNo, context = {}) {
    await this._findRoomRow(roomNo);
    const { data, error } = await this.client.from(this.agendasTable)
      .select('*').eq('room_no', Number(roomNo)).order('agenda_no', { ascending: false });
    if (error) this._fail('안건 목록 조회', error);
    return Promise.all((data || []).map((row) => this._publicAgenda(row, context)));
  }

  async createAgenda(roomNo, payload = {}, context = {}) {
    const room = await this._findRoomRow(roomNo);
    if (room.is_open === false) throw createHttpError(409, '닫힌 회의실에는 안건을 발의할 수 없습니다.');
    const title = normText(payload.title);
    if (!title) throw createHttpError(400, '안건 제목을 입력해 주세요.');
    const agendaNo = (await this._agendaCount(roomNo)) + 1;
    const { data, error } = await this.client.from(this.agendasTable).insert({
      room_no: Number(roomNo), agenda_no: agendaNo, title: title.slice(0, 80),
      content: normText(payload.content).slice(0, 4000),
      author_id: normText(context.userId, 'guest'), author_name: normText(context.nickName, '손님'),
      created_at: new Date().toISOString()
    }).select('*').single();
    if (error) this._fail('안건 발의', error);
    return this._publicAgenda(data, context);
  }

  async getAgenda(agendaId, context = {}) {
    const { data, error } = await this.client.from(this.agendasTable).select('*').eq('id', Number(agendaId)).maybeSingle();
    if (error) this._fail('안건 조회', error);
    if (!data) throw createHttpError(404, '안건을 찾을 수 없습니다.');
    return this._publicAgenda(data, context);
  }

  // ── 재청 ──
  async secondAgenda(agendaId, context = {}) {
    const agenda = await this.getAgenda(agendaId, context);
    const userId = normText(context.userId, 'guest');
    const { error } = await this.client.from(this.secondsTable)
      .insert({ agenda_id: Number(agendaId), user_id: userId, created_at: new Date().toISOString() });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw createHttpError(409, '이미 재청한 안건입니다.');
      this._fail('재청', error);
    }
    return this.getAgenda(agendaId, context);
  }
}

module.exports = { SupabaseConfRepository };
