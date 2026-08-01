'use strict';

// [LOG_ID: 20260719_1600] 토론의 광장(CONF) — 인메모리 저장소.
// 회의실(열기/닫기/목록) + 안건(발의/열람) + 재청(1인 1회). Supabase 드라이버와 동일 의미로 맞춘다.
const { createHttpError, normalizeText } = require('./httpUtils');
// [LOG_ID: 20260731_2200] normalizeText(httpUtils.normalizeText와 완전히 동일한 로직이었다)/normUserId
// 로컬 복제를 ConfRepositoryShared.js로 통합 — 다른 도메인의 XRepositoryShared.js 관례를 따른다.
const { normUserId } = require('./ConfRepositoryShared');

class MemoryConfRepository {
  constructor() {
    this.nextRoomNo = 1;
    this.nextAgendaId = 1;
    this.rooms = [];        // { no, title, ownerUserId, ownerName, isOpen, createdAt, closedAt }
    this.agendas = [];      // { id, roomNo, agendaNo, title, content, authorId, authorName, createdAt }
    this.seconds = [];      // { agendaId, userId }
  }

  getMeta() {
    return { driver: 'memory', ready: true };
  }

  _findRoom(roomNo) {
    const room = this.rooms.find((r) => r.no === Number(roomNo));
    if (!room) throw createHttpError(404, '회의실을 찾을 수 없습니다.');
    return room;
  }

  _agendaCount(roomNo) {
    return this.agendas.filter((a) => a.roomNo === Number(roomNo)).length;
  }

  _publicRoom(room) {
    return {
      no: room.no,
      title: room.title,
      owner: room.ownerUserId,
      ownerName: room.ownerName,
      isOpen: room.isOpen,
      agendaCount: this._agendaCount(room.no),
      createdAt: room.createdAt
    };
  }

  _secondCount(agendaId) {
    return this.seconds.filter((s) => s.agendaId === Number(agendaId)).length;
  }

  _publicAgenda(agenda, context = {}) {
    const myId = normUserId(context.userId, 'guest');
    return {
      id: agenda.id,
      roomNo: agenda.roomNo,
      no: agenda.agendaNo,
      title: agenda.title,
      content: agenda.content,
      author: agenda.authorId,
      authorName: agenda.authorName,
      secondCount: this._secondCount(agenda.id),
      seconded: this.seconds.some((s) => s.agendaId === agenda.id && s.userId === myId),
      createdAt: agenda.createdAt
    };
  }

  // ── 회의실 ──
  async listRooms(options = {}) {
    const includeClosed = options.includeClosed === true;
    return this.rooms
      .filter((r) => includeClosed || r.isOpen)
      .sort((a, b) => b.no - a.no)
      .map((r) => this._publicRoom(r));
  }

  async createRoom(payload = {}, context = {}) {
    const title = normalizeText(payload.title);
    if (!title) throw createHttpError(400, '회의실 제목을 입력해 주세요.');
    const room = {
      no: this.nextRoomNo++,
      title: title.slice(0, 60),
      ownerUserId: normUserId(context.userId, 'guest'),
      ownerName: normalizeText(context.nickName, '손님'),
      isOpen: true,
      createdAt: new Date().toISOString(),
      closedAt: null
    };
    this.rooms.push(room);
    return this._publicRoom(room);
  }

  async closeRoom(roomNo, context = {}) {
    const room = this._findRoom(roomNo);
    const requesterId = normUserId(context.userId, 'guest');
    if (room.ownerUserId !== requesterId && !context.isAdmin) {
      throw createHttpError(403, '회의실 개설자만 닫을 수 있습니다.');
    }
    room.isOpen = false;
    room.closedAt = new Date().toISOString();
    return this._publicRoom(room);
  }

  // ── 안건 ──
  async listAgendas(roomNo, context = {}) {
    this._findRoom(roomNo);
    return this.agendas
      .filter((a) => a.roomNo === Number(roomNo))
      .sort((a, b) => b.agendaNo - a.agendaNo)
      .map((a) => this._publicAgenda(a, context));
  }

  async createAgenda(roomNo, payload = {}, context = {}) {
    const room = this._findRoom(roomNo);
    if (!room.isOpen) throw createHttpError(409, '닫힌 회의실에는 안건을 발의할 수 없습니다.');
    const title = normalizeText(payload.title);
    if (!title) throw createHttpError(400, '안건 제목을 입력해 주세요.');
    const agendaNo = this._agendaCount(room.no) + 1;
    const agenda = {
      id: this.nextAgendaId++,
      roomNo: room.no,
      agendaNo,
      title: title.slice(0, 80),
      content: normalizeText(payload.content).slice(0, 4000),
      authorId: normUserId(context.userId, 'guest'),
      authorName: normalizeText(context.nickName, '손님'),
      createdAt: new Date().toISOString()
    };
    this.agendas.push(agenda);
    return this._publicAgenda(agenda, context);
  }

  async getAgenda(agendaId, context = {}) {
    const agenda = this.agendas.find((a) => a.id === Number(agendaId));
    if (!agenda) throw createHttpError(404, '안건을 찾을 수 없습니다.');
    return this._publicAgenda(agenda, context);
  }

  // ── 재청(동의) ──
  async secondAgenda(agendaId, context = {}) {
    const agenda = this.agendas.find((a) => a.id === Number(agendaId));
    if (!agenda) throw createHttpError(404, '안건을 찾을 수 없습니다.');
    // [LOG: 20260801_1000] createAgenda는 닫힌 방에 발의를 막지만 secondAgenda는 동일 검사가
    // 없어, 닫힌 방의 안건에 재청이 가능했다 — createAgenda와 동일한 규칙 적용.
    const room = this._findRoom(agenda.roomNo);
    if (!room.isOpen) throw createHttpError(409, '닫힌 회의실의 안건에는 재청할 수 없습니다.');
    const userId = normUserId(context.userId, 'guest');
    // [LOG: 20260802_1400] 발의자(authorId)가 자신의 안건에 재청(self-second)하는 것을 허용하면
    // 1인이 발의+재청을 동시에 해 절차상 의결정족수를 인위적으로 부풀릴 수 있다.
    // 재청은 발의자 외의 제3자가 "이 안건을 논의할 가치가 있다"고 동의하는 의회 절차.
    // createAgenda와 동일한 패턴으로 발의자 본인은 재청 불가.
    if (userId === agenda.authorId) {
      throw createHttpError(400, '자신이 발의한 안건에는 재청할 수 없습니다.');
    }
    if (this.seconds.some((s) => s.agendaId === agenda.id && s.userId === userId)) {
      throw createHttpError(409, '이미 재청한 안건입니다.');
    }
    this.seconds.push({ agendaId: agenda.id, userId });
    return this._publicAgenda(agenda, context);
  }
}

module.exports = { MemoryConfRepository };
