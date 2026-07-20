'use strict';

const {
  createHttpError,
  normalizeMaxUser,
  normalizeRoomSecret,
  normalizeRoomText,
  normalizeSessionKey,
  normalizeText,
  publicRoom,
  summarizeParticipantCounts,
  roomKeyForNo
} = require('./ChatRoomRepositoryShared');

class MemoryChatRoomRepository {
  constructor(options = {}) {
    this.rooms = [];
    this.nextNo = 1;
    this.participantTtlMs = Number(options.participantTtlMs || 1000 * 60 * 60 * 6);
    this.messagesByRoomNo = new Map();
    this._seedDefaultRoom(options.defaultRoom !== false ? options.defaultRoom : null);
  }

  getMeta() {
    return {
      driver: 'memory',
      ready: true
    };
  }

  list() {
    this._cleanup();
    return this.rooms
      .slice()
      .sort((left, right) => right.no - left.no)
      .map((room) => publicRoom(room, summarizeParticipantCounts(room.participants)));
  }

  get(roomNo) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  create(payload = {}, context = {}) {
    this._cleanup();

    const title = normalizeRoomText(payload.title);
    if (!title) {
      throw createHttpError(400, '대화방 제목을 입력해 주세요.');
    }

    const greeting = normalizeRoomText(payload.greeting);
    if (!greeting) {
      throw createHttpError(400, '환영 메시지를 입력해 주세요.');
    }

    const rawVisibility = normalizeText(payload.visibility || payload.mode || 'public').toLowerCase();
    const isPrivate = rawVisibility === 'private' || rawVisibility === 'secret' || rawVisibility === '2';
    const password = isPrivate ? normalizeRoomSecret(payload.password || '') : '';
    if (isPrivate && password.length < 4) {
      throw createHttpError(400, '비밀 대화방 비밀번호는 4자 이상이어야 합니다.');
    }

    const room = {
      no: this.nextNo++,
      roomId: '',
      title: title.slice(0, 60),
      greeting: greeting.slice(0, 120),
      ownerUserId: normalizeText(context.userId, 'guest'),
      ownerName: normalizeText(context.nickName, '손님'),
      maxUser: normalizeMaxUser(payload.maxUser, 10),
      password,
      isPrivate,
      createdAt: new Date().toISOString(),
      persistent: false,
      participants: []
    };
    room.roomId = roomKeyForNo(room.no);
    this.rooms.push(room);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  join(roomNo, payload = {}, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const sessionKey = normalizeSessionKey(payload.sessionKey);

    if (room.password && room.password !== normalizeRoomSecret(payload.password || '')) {
      throw createHttpError(403, '대화방 비밀번호가 올바르지 않습니다.');
    }

    const existing = room.participants.find((entry) => entry.sessionKey === sessionKey);
    const now = new Date().toISOString();
    const participant = {
      sessionKey,
      userId: normalizeText(context.userId, 'guest'),
      nickName: normalizeText(context.nickName, '손님'),
      joinedAt: existing?.joinedAt || now,
      lastSeenAt: now
    };
    const nextParticipants = existing
      ? room.participants.map((entry) => (entry.sessionKey === sessionKey ? { ...entry, ...participant } : entry))
      : room.participants.concat([participant]);
    const nextSummary = summarizeParticipantCounts(nextParticipants);
    if (!existing && nextSummary.userCount > room.maxUser) {
      throw createHttpError(409, '대화방 정원이 가득 찼습니다.');
    }

    if (existing) {
      Object.assign(existing, participant);
    } else {
      room.participants.push(participant);
    }

    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  leave(roomNo, payload = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const sessionKey = payload.sessionKey ? normalizeSessionKey(payload.sessionKey) : '';

    const leavingParticipant = sessionKey
      ? room.participants.find((entry) => entry.sessionKey === sessionKey)
      : null;
    const remainingParticipants = sessionKey
      ? room.participants.filter((entry) => entry.sessionKey !== sessionKey)
      : room.participants;

    // [LOG_ID: 20260721_0500] 방장이 여러 세션(다중 탭/기기)으로 입장했을 때, 방장의 "첫" 세션이
    // room.ownerSessionKey에 못박혀 있어 그 세션만 나가도 방장이 다른 세션으로 여전히 남아있는데도
    // 방 전체가 종료되던 버그(smoke:chat-counts 실패 원인) — 남은 참여자 중 방장(userId 기준)이
    // 하나도 없을 때만 방을 통째로 종료하도록 수정한다(원본 규칙: "방장이 나가면 종료"는 유지하되
    // 방장의 마지막 세션이 나갈 때로 판정 기준을 옮김).
    const ownerHasOtherSession = remainingParticipants.some((entry) => entry.userId === room.ownerUserId);
    if (leavingParticipant && leavingParticipant.userId === room.ownerUserId && !ownerHasOtherSession) {
      this.messagesByRoomNo.delete(Number(room.no || 0));
      this.rooms = this.rooms.filter((entry) => entry.no !== room.no);
      return publicRoom({ ...room, participants: [], _closed: true }, summarizeParticipantCounts([]));
    }

    room.participants = remainingParticipants;
    this._removeIfDisposable(room);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG_ID: 20260714_2200] 원전 /OUT id(강퇴) 재현 — 방 개설자(ownerUserId)만 실행 가능.
  kick(roomNo, targetUserId, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const requesterId = normalizeText(context.userId, 'guest');
    if (room.ownerUserId !== requesterId) {
      throw createHttpError(403, '방 개설자만 강퇴할 수 있습니다.');
    }
    const target = normalizeText(targetUserId, '');
    const before = room.participants.length;
    room.participants = room.participants.filter((entry) => entry.userId !== target);
    if (room.participants.length === before) {
      throw createHttpError(404, '해당 이용자가 방에 없습니다.');
    }
    this._removeIfDisposable(room);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG_ID: 20260714_2200] 원전 /E TITLE, /E USER(방 설정 변경) 재현 — 방 개설자 전용.
  updateRoom(roomNo, payload = {}, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const requesterId = normalizeText(context.userId, 'guest');
    if (room.ownerUserId !== requesterId) {
      throw createHttpError(403, '방 개설자만 설정을 변경할 수 있습니다.');
    }
    if (payload.title !== undefined) {
      const title = normalizeRoomText(payload.title);
      if (!title) {
        throw createHttpError(400, '방 제목을 입력해 주세요.');
      }
      room.title = title.slice(0, 60);
    }
    if (payload.maxUser !== undefined) {
      room.maxUser = normalizeMaxUser(payload.maxUser, room.maxUser);
    }
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG: 20260428_2332] Memory chat driver must preserve the same message APIs
  // as the Supabase driver so local/default environments do not 500 on chat send/list.
  sendMessage(roomNo, payload = {}, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const numericRoomNo = Number(room.no || roomNo);
    const messages = this.messagesByRoomNo.get(numericRoomNo) || [];
    const rawContent = payload?.content ?? payload?.message ?? '';
    const content = normalizeText(rawContent);

    if (!content) {
      throw createHttpError(400, '메시지 내용을 입력해 주세요.');
    }

    const message = {
      id: Date.now() + Math.random(),
      userId: normalizeText(context.userId, 'guest'),
      nickName: normalizeText(context.nickName, '손님'),
      content,
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    if (messages.length > 100) {
      messages.shift();
    }

    this.messagesByRoomNo.set(numericRoomNo, messages);
    return { ...message };
  }

  listMessages(roomNo) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const numericRoomNo = Number(room.no || roomNo);
    return (this.messagesByRoomNo.get(numericRoomNo) || []).map((message) => ({ ...message }));
  }

  _seedDefaultRoom(defaultRoom) {
    if (defaultRoom === null) {
      return;
    }

    const seed = typeof defaultRoom === 'object' ? defaultRoom : {};
    const room = {
      no: 1,
      roomId: normalizeText(seed.roomId, 'lobby'),
      title: normalizeText(seed.title, '실시간 대화방'),
      greeting: normalizeText(seed.greeting, '실시간 대화방에 접속했습니다.'),
      ownerUserId: normalizeText(seed.ownerUserId, 'system'),
      ownerName: normalizeText(seed.ownerName, '손님'),
      maxUser: normalizeMaxUser(seed.maxUser || 99, 99),
      password: '',
      isPrivate: false,
      createdAt: new Date().toISOString(),
      persistent: true,
      participants: []
    };
    this.rooms.push(room);
    this.nextNo = 2;
  }

  _cleanup() {
    const cutoff = Date.now() - this.participantTtlMs;
    for (const room of this.rooms) {
      room.participants = (room.participants || []).filter((entry) => {
        const lastSeen = Date.parse(entry.lastSeenAt || entry.joinedAt || '');
        return !Number.isNaN(lastSeen) && lastSeen >= cutoff;
      });
    }
  }

  _removeIfDisposable(room) {
    if (!room || room.persistent || room.participants.length > 0) {
      return;
    }
    this.messagesByRoomNo.delete(Number(room.no || 0));
    this.rooms = this.rooms.filter((entry) => entry.no !== room.no);
  }

  _findRoom(roomNo) {
    const numericNo = Number(roomNo);
    const room = this.rooms.find((entry) => entry.no === numericNo || entry.roomId === String(roomNo || ''));
    if (!room) {
      throw createHttpError(404, '대화방 번호를 찾을 수 없습니다.');
    }
    return room;
  }
}

module.exports = {
  MemoryChatRoomRepository
};
