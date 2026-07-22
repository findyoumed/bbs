'use strict';

const { createHttpError, maybeUuid, normalizeText, stripControlCharacters } = require('./httpUtils');

function normalizeRoomText(value, fallback = '', maxLength = 120) {
  const text = normalizeText(stripControlCharacters(value), fallback);
  return text.slice(0, Math.max(0, Number(maxLength) || 0));
}

function normalizeRoomSecret(value) {
  return stripControlCharacters(value).trim();
}

function normalizeSessionKey(value) {
  const sessionKey = normalizeRoomSecret(value);
  if (!sessionKey) {
    throw createHttpError(400, '대화방 세션 키가 필요합니다.');
  }
  if (sessionKey.length > 120) {
    throw createHttpError(400, '대화방 세션 키가 너무 깁니다.');
  }
  if (!/^[A-Za-z0-9:_-]+$/.test(sessionKey)) {
    throw createHttpError(400, '대화방 세션 키 형식이 올바르지 않습니다.');
  }
  return sessionKey;
}

function normalizeMaxUser(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(2, Math.min(99, Math.floor(parsed)));
}

function roomKeyForNo(roomNo) {
  const numericNo = Number(roomNo);
  if (!Number.isFinite(numericNo) || numericNo <= 1) {
    return 'lobby';
  }
  return `room-${Math.floor(numericNo)}`;
}

function visibilityLabel(room) {
  return room?.password || room?.isPrivate ? '비밀방' : '공개';
}

// [LOG_ID: 20260722_2800] 하이텔 책(그림 6.2 "대화실 참여") 실측 — 원전은 입장/퇴장할 때
// "■■ 닉네임(아이디) 님이 입장(퇴장)하였습니다. ■■" 시스템 메시지를 대화 로그에 함께
// 남긴다. join()/leave()가 이 헬퍼로 만든 메시지를 각 드라이버의 messagesByRoomNo에 그대로
// push하면, 이미 3초 간격으로 돌고 있는 /messages 폴링이 다른 참여자들에게도 자동으로
// 전달한다(별도 폴링/스키마 불필요 — 메시지 자체가 두 드라이버 다 서버 메모리에만 있음).
// 정확한 문구는 클라이언트(chatAnsiBuilders.js msgLine)가 type==='system'을 보고 조립한다.
function buildSystemMessage(eventType, userId, nickName) {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'system',
    eventType,
    userId: normalizeText(userId, 'guest'),
    nickName: normalizeText(nickName, '손님'),
    content: '',
    createdAt: new Date().toISOString()
  };
}


function summarizeParticipantCounts(participants = [], persistedAuthUserCount = 0) {
  const authUsers = new Set();
  let guestSessionCount = 0;
  let sessionCount = 0;

  for (const participant of participants || []) {
    sessionCount += 1;
    const userId = maybeUuid(participant?.userId);
    if (userId) {
      authUsers.add(userId);
    } else {
      guestSessionCount += 1;
    }
  }

  const authUserCount = Math.max(0, Number(persistedAuthUserCount || 0), authUsers.size);
  return {
    userCount: guestSessionCount + authUserCount,
    authUserCount,
    guestSessionCount,
    sessionCount,
    countMode: 'hybrid-occupancy'
  };
}

function normalizeParticipantSummary(counts) {
  if (counts && typeof counts === 'object') {
    const sessionCount = counts.sessionCount ?? counts.userCount ?? 0;
    return {
      userCount: Math.max(0, Number(counts.userCount || 0)),
      authUserCount: Math.max(0, Number(counts.authUserCount || 0)),
      guestSessionCount: Math.max(0, Number(counts.guestSessionCount || 0)),
      sessionCount: Math.max(0, Number(sessionCount)),
      countMode: normalizeText(counts.countMode, 'hybrid-occupancy')
    };
  }

  const numeric = Math.max(0, Number(counts || 0));
  return {
    userCount: numeric,
    authUserCount: 0,
    guestSessionCount: numeric,
    sessionCount: numeric,
    countMode: 'sessions'
  };
}

function publicRoom(room, counts = 0) {
  if (!room) {
    return null;
  }

  const summary = normalizeParticipantSummary(counts);

  return {
    no: Number(room.no || 0),
    roomId: normalizeText(room.roomId, roomKeyForNo(room.no)),
    title: normalizeText(room.title, '실시간 대화방'),
    greeting: normalizeText(room.greeting, '실시간 대화방에 접속했습니다.'),
    owner: normalizeText(room.ownerUserId, 'guest'),
    ownerName: normalizeText(room.ownerName, '손님'),
    userCount: summary.userCount,
    authUserCount: summary.authUserCount,
    guestSessionCount: summary.guestSessionCount,
    sessionCount: summary.sessionCount,
    countMode: summary.countMode,
    maxUser: normalizeMaxUser(room.maxUser, 99),
    visibility: visibilityLabel(room),
    requiresPassword: Boolean(room.password || room.isPrivate),
    createdAt: room.createdAt || new Date().toISOString(),
    // [LOG_ID: 20260721_2350] ST/W/WHO/UID(대화방 참여자 조회) 명령이 클라이언트에서
    // state._chatRoom.participants를 읽는데, 이 함수는 지금까지 인원 "수"(counts)만 내려주고
    // 실제 참여자 목록은 한 번도 내려준 적이 없어 그 명령들이 전부 "참여자 정보를 확인할 수
    // 없습니다"만 뜨는 죽은 기능이었다(라이브 테스트로 확인) — sessionKey 등 내부 상관 토큰은
    // 빼고 표시에 필요한 userId/nickName만 내려준다.
    participants: Array.isArray(room.participants)
      ? room.participants.map((p) => ({ userId: p.userId, nickName: p.nickName }))
      : []
  };
}

module.exports = {
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
  roomKeyForNo,
  visibilityLabel
};
