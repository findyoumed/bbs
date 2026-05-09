'use strict';

const { createHttpError, normalizeText } = require('./httpUtils');
const { maybeUuid } = require('./ChatRoomRepositoryShared');

class ChatRoomMemberPersistence {
  constructor({ client, membersTable, participantTtlMs }) {
    this.client = client;
    this.membersTable = membersTable;
    this.participantTtlMs = participantTtlMs;
  }

  async persistJoin(room, participant) {
    const userId = maybeUuid(participant?.userId);
    if (!userId || !room?.id || !this.membersTable) {
      return;
    }

    const now = participant.lastSeenAt || new Date().toISOString();
    
    // [LOG: 20260411_2355] Duplicate key 방지를 위해 upsert 사용
    const { error: upsertError } = await this.client
      .from(this.membersTable)
      .upsert({
        room_id: room.id,
        user_id: userId,
        nickname: normalizeText(participant.nickName, '회원'),
        joined_at: participant.joinedAt || now,
        last_seen_at: now,
        left_at: null // 다시 입장 시 퇴장 기록 초기화
      }, {
        onConflict: 'room_id, user_id'
      });

    if (upsertError) {
      this._throwError('대화방 참여자 기록(upsert)', upsertError);
    }
  }

  async persistLeave(room, payload, context, remainingParticipants) {
    const userId = maybeUuid(context?.userId || payload?.userId);
    if (!userId || !room?.id || !this.membersTable) {
      return;
    }

    if ((remainingParticipants || []).some((entry) => maybeUuid(entry.userId) === userId)) {
      return;
    }

    const now = new Date().toISOString();
    const { error } = await this.client
      .from(this.membersTable)
      .update({
        last_seen_at: now,
        left_at: now
      })
      .eq('room_id', room.id)
      .eq('user_id', userId)
      .is('left_at', null);

    if (error) {
      this._throwError('대화방 참여자 종료', error);
    }
  }

  async cleanupExpired() {
    if (!(this.participantTtlMs > 0) || !this.membersTable) {
      return;
    }

    const cutoff = new Date(Date.now() - this.participantTtlMs).toISOString();
    const now = new Date().toISOString();
    const { error } = await this.client
      .from(this.membersTable)
      .update({ left_at: now })
      .is('left_at', null)
      .lt('last_seen_at', cutoff);

    if (error) {
      this._throwError('대화방 참여자 정리', error);
    }
  }

  async loadActiveAuthMemberCounts(roomIds = []) {
    const validRoomIds = (roomIds || []).map((roomId) => normalizeText(roomId)).filter(Boolean);
    if (!this.membersTable || validRoomIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client
      .from(this.membersTable)
      .select('room_id, user_id')
      .in('room_id', validRoomIds)
      .is('left_at', null);

    if (error) {
      this._throwError('대화방 참여자 수 조회', error);
    }

    const grouped = new Map();
    for (const row of data || []) {
      const roomId = normalizeText(row.room_id);
      const userId = maybeUuid(row.user_id);
      if (!roomId || !userId) {
        continue;
      }
      if (!grouped.has(roomId)) {
        grouped.set(roomId, new Set());
      }
      grouped.get(roomId).add(userId);
    }

    return new Map(Array.from(grouped.entries()).map(([roomId, users]) => [roomId, users.size]));
  }

  async loadActiveAuthMemberCount(roomId) {
    return (await this.loadActiveAuthMemberCounts([roomId])).get(normalizeText(roomId)) || 0;
  }

  _throwError(action, error) {
    const msg = error?.message || '알 수 없는 오류';
    const detail = error?.details || '';
    if (String(msg).includes(this.membersTable)) {
      throw createHttpError(502, `대화방 참여자 테이블(${this.membersTable}) 확인이 필요합니다. Supabase 마이그레이션을 진행해주세요: ${msg} (${detail})`);
    }
    throw createHttpError(502, `${action} 실패: ${msg} (${detail})`);
  }
}

module.exports = { ChatRoomMemberPersistence };
