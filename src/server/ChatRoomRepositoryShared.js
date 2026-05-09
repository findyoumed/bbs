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
    createdAt: room.createdAt || new Date().toISOString()
  };
}

module.exports = {
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
