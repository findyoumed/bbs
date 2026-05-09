'use strict';

const { roomKeyForNo, createHttpError } = require('./ChatRoomRepositoryShared');

class ChatRoomRepositorySupabaseQueries {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }

  _selectColumns() {
    return 'id, room_no, room_key, name, description, owner_user_id, owner_name, max_user, password, is_private, is_locked, created_at, last_activity_at';
  }

  async listRows() {
    const { data, error } = await this.client.from(this.table).select(this._selectColumns()).order('room_no', { ascending: false });
    if (error) this._throw('대화방 목록 조회', error);
    return data || [];
  }

  async findRoomByNo(roomNo) {
    const num = Number(roomNo);
    if (!Number.isFinite(num) || num <= 0) throw createHttpError(404, '잘못된 대화방 번호');
    const { data, error } = await this.client.from(this.table).select(this._selectColumns()).eq('room_no', num).maybeSingle();
    if (error) this._throw('대화방 조회', error);
    if (!data) throw createHttpError(404, '대화방을 찾을 수 없음');
    return data;
  }

  async nextRoomNo() {
    const { data, error } = await this.client.from(this.table).select('room_no').order('room_no', { ascending: false }).limit(1).maybeSingle();
    if (error) this._throw('대화방 번호 확인', error);
    return Math.max(1, Number(data?.room_no || 0) + 1);
  }

  async createDefaultRoom() {
    const { data: inserted, error } = await this.client.from(this.table).insert({
      room_no: 1, room_key: 'lobby', name: '실시간 대화방', description: '실시간 대화방에 접속했습니다.',
      owner_user_id: 'system', owner_name: '손님', max_user: 99, password: '', is_private: false, is_locked: false, last_activity_at: new Date().toISOString()
    }).select(this._selectColumns()).single();
    if (error) this._throw('기본 대화방 생성', error);
    return inserted;
  }

  _throw(action, error) {
    const msg = error?.message || '알 수 없는 오류';
    const detail = error?.details || '';
    if (String(msg).includes(this.table)) {
      throw createHttpError(502, `대화방 테이블(${this.table}) 확인 필요: ${msg} (${detail})`);
    }
    throw createHttpError(502, `${action} 실패: ${msg} (${detail})`);
  }
}

module.exports = { ChatRoomRepositorySupabaseQueries };
