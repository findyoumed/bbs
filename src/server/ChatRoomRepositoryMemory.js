'use strict';

const {
  buildSystemMessage,
  createHttpError,
  maybeUuid,
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
      title: title.slice(0, 100),
      greeting: greeting.slice(0, 120),
      ownerUserId: normalizeText(context.userId, 'guest').toLowerCase(), // [LOG: 20260731_1755] toLowerCase 추가
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
      // [LOG_ID: 20260828_1752] Keep the Supabase Auth UUID beside the app user id so
      // multiple browser sessions for one authenticated member consume one room slot.
      // The memory driver is used by local/dev and smoke environments, so it must obey
      // the same hybrid occupancy contract as the Supabase driver.
      authUserId: maybeUuid(context.authUserId) || '',
      userId: normalizeText(context.userId, 'guest').toLowerCase(), // [LOG: 20260731_1755] toLowerCase 추가
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

    // [LOG_ID: 20260722_2800] 원전(그림 6.2) 입장 알림 재현 — 재입장(같은 세션 재조인)도
    // 실제 터미널에서 다시 접속한 것과 같으므로 매번 알린다.
    this._pushSystemMessage(room.no, 'join', participant.userId, participant.nickName);

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
    // [LOG_ID: 20260721_0810] 기본방(#1, persistent:true)은 방장 판정과 무관하게 항상 살아남아야
    // 한다 — Supabase 드라이버는 room_no!==1로 명시 제외하는데 Memory 드라이버는 시드 방장
    // userId('system')가 실제로는 아무도 못 쓸 값이라는 가정에만 기대고 있었다. 관리자가 만약
    // userId 'system'으로 가입해 이 방에 드나들면 그 가정이 깨져 로비가 삭제될 수 있었다 —
    // Supabase와 동일하게 persistent 플래그로 명시 제외한다.
    const ownerHasOtherSession = remainingParticipants.some((entry) => entry.userId === room.ownerUserId);
    if (!room.persistent && leavingParticipant && leavingParticipant.userId === room.ownerUserId && !ownerHasOtherSession) {
      this.messagesByRoomNo.delete(Number(room.no || 0));
      this.rooms = this.rooms.filter((entry) => entry.no !== room.no);
      return publicRoom({ ...room, participants: [], _closed: true }, summarizeParticipantCounts([]));
    }

    room.participants = remainingParticipants;
    // [LOG_ID: 20260722_2800] 원전(그림 6.2) 퇴장 알림 재현. 방 자체가 곧 사라지는 경우(위
    // 조기 return 분기)는 메시지도 함께 버려지므로 거기서는 남기지 않는다 — 여기 도달했다는
    // 것 자체가 방이 계속 존재한다는 뜻이라 안전하게 남긴다(방이 이 직후 _removeIfDisposable로
    // 정리돼도 메시지 맵 전체가 지워지므로 무해하다).
    if (leavingParticipant) {
      this._pushSystemMessage(room.no, 'leave', leavingParticipant.userId, leavingParticipant.nickName);
    }
    this._removeIfDisposable(room);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG_ID: 20260714_2200] 원전 /OUT id(강퇴) 재현 — 방 개설자(ownerUserId)만 실행 가능.
  // [LOG_ID: 20260728_1629] kick()이 participants에서만 제거하고 시스템 메시지를 전혀 남기지
  // 않아, 강퇴된 사람과 남은 참여자 모두 강퇴 사실을 알 방법이 없었다(join()/leave()는 둘 다
  // _pushSystemMessage()를 호출하는데 kick()만 빠져 있었음). 강퇴된 참여자의 닉네임/아이디를
  // 'kick' eventType 시스템 메시지로 남겨 폴링 중인 다른 참여자들에게 자동으로 전달되게 한다.
  kick(roomNo, targetUserId, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const requesterId = normalizeText(context.userId, 'guest').toLowerCase(); // [LOG: 20260731_1755] toLowerCase 추가
    if (room.ownerUserId !== requesterId) {
      throw createHttpError(403, '방 개설자만 강퇴할 수 있습니다.');
    }
    // [LOG_ID: 20260801_0950] /OUT 강퇴 시 대소문자 구분 없는 비교를 위해 ID와 닉네임을 소문자로 변환하여 비교한다.
    const target = normalizeText(targetUserId, '').toLowerCase();
    const kicked = room.participants.find((entry) => String(entry.userId || '').toLowerCase() === target || String(entry.nickName || '').toLowerCase() === target);
    if (!kicked) {
      throw createHttpError(404, '해당 이용자가 방에 없습니다.');
    }
    // [LOG: 20260801_1200] 방 개설자(owner)가 자신을 강퇴(self-kick)하면 leave()의 방 종료 로직을
    // 우회해 room.ownerUserId가 살아있는 채로 owner만 participants에서 빠지는 불일치 상태가 된다.
    // '/OUT'은 다른 이용자를 내보내는 명령으로, 자기 자신을 대상으로 할 수 없다.
    if (String(kicked.userId || '').toLowerCase() === requesterId) {
      throw createHttpError(400, '자신을 강퇴할 수 없습니다. 나가려면 퇴장 명령을 사용해 주세요.');
    }
    room.participants = room.participants.filter((entry) => entry.userId !== kicked.userId);
    // [LOG_ID: 20260728_1629] 강퇴 시스템 메시지 — join/leave와 동일한 패턴.
    this._pushSystemMessage(room.no, 'kick', kicked.userId, kicked.nickName);
    this._removeIfDisposable(room);
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG_ID: 20260714_2200] 원전 /E TITLE, /E USER(방 설정 변경) 재현 — 방 개설자 전용.
  updateRoom(roomNo, payload = {}, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
    const requesterId = normalizeText(context.userId, 'guest').toLowerCase(); // [LOG: 20260731_1755] toLowerCase 추가
    if (room.ownerUserId !== requesterId) {
      throw createHttpError(403, '방 개설자만 설정을 변경할 수 있습니다.');
    }
    if (payload.title !== undefined) {
      const title = normalizeRoomText(payload.title);
      if (!title) {
        throw createHttpError(400, '방 제목을 입력해 주세요.');
      }
      // [LOG_ID: 20260727_1256] 대화방 개설 API(POST /api/chat/rooms)는 제목을 100자로 검증·거부하는데
      // (chatServiceRoutes.js validate, LOG_ID 20260727_1215) 여기 저장 상한은 60이라 61~100자 제목은
      // 개설 시 검증을 통과해놓고 저장 단계에서 조용히 60자로 잘렸다(같은 버그가 이 설정변경(/E TITLE)
      // 경로에도 있었다). 검증이 약속하는 값(100)을 저장 상한도 그대로 지키게 맞춘다.
      room.title = title.slice(0, 100);
    }
    if (payload.maxUser !== undefined) {
      room.maxUser = normalizeMaxUser(payload.maxUser, room.maxUser);
    }
    return publicRoom(room, summarizeParticipantCounts(room.participants));
  }

  // [LOG_ID: 20260722_0100] Supabase 드라이버와 동일한 정책 — 회원탈퇴 시 그 회원이 방장인
  // 대화방을 정리한다(기본방#1 제외). 자세한 사유는 ChatRoomRepositorySupabase.js 참고.
  closeRoomsOwnedBy(userId) {
    this._cleanup();
    // [LOG: 20260731_1710] 대소문자 매칭 일치를 위해 소문자 정규화 처리
    const target = normalizeText(userId, '').trim().toLowerCase();
    if (!target) return 0;

    const closingNos = this.rooms
      .filter((room) => !room.persistent && room.ownerUserId === target)
      .map((room) => room.no);

    if (!closingNos.length) return 0;

    closingNos.forEach((no) => this.messagesByRoomNo.delete(no));
    this.rooms = this.rooms.filter((room) => !closingNos.includes(room.no));

    return closingNos.length;
  }

  // [LOG: 20260428_2332] Memory chat driver must preserve the same message APIs
  // as the Supabase driver so local/default environments do not 500 on chat send/list.
  sendMessage(roomNo, payload = {}, context = {}) {
    this._cleanup();
    const room = this._findRoom(roomNo);
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

    this._appendMessage(room.no || roomNo, message);
    return { ...message };
  }

  // [LOG_ID: 20260722_2800] join()/leave() 공용 — 입장/퇴장 시스템 메시지를 일반 메시지와
  // 동일한 저장소에 남겨, 이미 3초 간격으로 도는 /messages 폴링이 자동으로 실어나르게 한다.
  _pushSystemMessage(roomNo, eventType, userId, nickName) {
    this._appendMessage(roomNo, buildSystemMessage(eventType, userId, nickName));
  }

  _appendMessage(roomNo, message) {
    const numericRoomNo = Number(roomNo);
    const messages = this.messagesByRoomNo.get(numericRoomNo) || [];
    messages.push(message);
    if (messages.length > 100) {
      messages.shift();
    }
    this.messagesByRoomNo.set(numericRoomNo, messages);
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
