'use strict';

const BaseRepository = require('./BaseRepository');
const { createHttpError } = require('./httpUtils');

// [LOG: 20260622_2301] MemoryVoteRepository 구현 — 메모리 모드 투표 시스템
// [LOG: 20260731_2300] _createHttpError 로컬 메서드 제거 — httpUtils.createHttpError로 통합
class MemoryVoteRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'memory' });
    this.nextVoteId = 2; // dummy seed가 1을 사용하므로 2부터 시작
    this.votes = []; // { id, title, options, createdBy, createdAt, isActive }
    this.records = []; // { voteId, userId, optionIndex, createdAt }

    // 더미 데이터 추가 (검증용)
    this._seed();
  }

  getMeta() {
    return {
      ...super.getMeta(),
      voteCount: this.votes.length,
      recordCount: this.records.length
    };
  }

  async checkHealth() {
    return { status: 'ok', driver: this.driverName };
  }

  _seed() {
    this.votes.push({
      id: 1,
      title: 'BBS의 최고 인기 부가 기능은?',
      options: ['바이오리듬', '오늘의 운세', 'MBTI 성격유형', '설문조사(투표)'],
      createdBy: 'sysop',
      createdAt: new Date().toISOString(),
      isActive: true
    });
    this.records.push(
      { voteId: 1, userId: 'sysop', optionIndex: 3, createdAt: new Date().toISOString() },
      { voteId: 1, userId: 'guest', optionIndex: 1, createdAt: new Date().toISOString() }
    );
  }

  async listVotes(context = {}) {
    return this._track('listVotes', async () => {
      const normalizedRequesterId = String(context.userId || '').trim().toLowerCase();
      const result = [];
      for (const vote of this.votes) {
        const counts = new Array(vote.options.length).fill(0);
        let userVotedOption = null;

        const voteRecords = this.records.filter(r => r.voteId === vote.id);
        for (const record of voteRecords) {
          if (record.optionIndex >= 0 && record.optionIndex < counts.length) {
            counts[record.optionIndex]++;
          }
          if (normalizedRequesterId && record.userId === normalizedRequesterId) {
            userVotedOption = record.optionIndex;
          }
        }

        result.push({
          id: vote.id,
          title: vote.title,
          options: vote.options,
          createdBy: vote.createdBy,
          createdAt: vote.createdAt,
          isActive: vote.isActive,
          counts,
          totalVotes: voteRecords.length,
          userVotedOption
        });
      }
      // 최신 등록 순
      return result.sort((a, b) => b.id - a.id);
    });
  }

  async getVote(voteId, context = {}) {
    return this._track('getVote', async () => {
      const id = Number(voteId);
      const vote = this.votes.find(v => v.id === id);
      if (!vote) {
        throw createHttpError(404, '투표를 찾을 수 없습니다.');
      }

      const normalizedRequesterId = String(context.userId || '').trim().toLowerCase();
      const counts = new Array(vote.options.length).fill(0);
      let userVotedOption = null;

      const voteRecords = this.records.filter(r => r.voteId === vote.id);
      for (const record of voteRecords) {
        if (record.optionIndex >= 0 && record.optionIndex < counts.length) {
          counts[record.optionIndex]++;
        }
        if (normalizedRequesterId && record.userId === normalizedRequesterId) {
          userVotedOption = record.optionIndex;
        }
      }

      return {
        id: vote.id,
        title: vote.title,
        options: vote.options,
        createdBy: vote.createdBy,
        createdAt: vote.createdAt,
        isActive: vote.isActive,
        counts,
        totalVotes: voteRecords.length,
        userVotedOption
      };
    });
  }

  async createVote(input = {}, context = {}) {
    return this._track('createVote', async () => {
      const title = String(input.title || '').trim();
      const options = Array.isArray(input.options) ? input.options.map(o => String(o || '').trim()).filter(Boolean) : [];

      if (!title) throw createHttpError(400, '투표 제목이 필요합니다.');
      if (options.length < 2) throw createHttpError(400, '최소 2개 이상의 선택지가 필요합니다.');

      const vote = {
        id: this.nextVoteId++,
        title,
        options,
        createdBy: (context.userId && context.userId !== 'guest') ? context.userId.toLowerCase() : 'guest',
        createdAt: new Date().toISOString(),
        isActive: true
      };

      this.votes.push(vote);
      return vote;
    });
  }

  async castVote(voteId, optionIndex, context = {}) {
    return this._track('castVote', async () => {
      const id = Number(voteId);
      const optIdx = Number(optionIndex);
      const rawUserId = context.userId || 'guest';
      const userId = rawUserId !== 'guest' ? rawUserId.toLowerCase() : rawUserId;

      const vote = this.votes.find(v => v.id === id);
      if (!vote) throw createHttpError(404, '투표를 찾을 수 없습니다.');
      if (!vote.isActive) throw createHttpError(400, '종료된 투표입니다.');
      if (optIdx < 0 || optIdx >= vote.options.length) throw createHttpError(400, '올바르지 않은 선택지입니다.');

      // 1인 1표 중복 체크
      const alreadyVoted = this.records.some(r => r.voteId === id && r.userId === userId);
      if (alreadyVoted) throw createHttpError(409, '이미 투표에 참여하셨습니다.');

      const record = {
        voteId: id,
        userId,
        optionIndex: optIdx,
        createdAt: new Date().toISOString()
      };

      this.records.push(record);
      return record;
    });
  }

  async deleteVote(voteId, context = {}) {
    return this._track('deleteVote', async () => {
      const id = Number(voteId);
      const voteIdx = this.votes.findIndex(v => v.id === id);
      if (voteIdx === -1) throw createHttpError(404, '투표를 찾을 수 없습니다.');

      const vote = this.votes[voteIdx];
      // 작성자 본인 혹은 운영자만 삭제 가능
      const requesterId = String(context.userId || '').trim().toLowerCase();
      if (!context.isAdmin && vote.createdBy !== requesterId) {
        throw createHttpError(403, '삭제 권한이 없습니다.');
      }

      this.votes.splice(voteIdx, 1);
      // 관련 기록 삭제
      this.records = this.records.filter(r => r.voteId !== id);

      return vote;
    });
  }
}

module.exports = {
  MemoryVoteRepository
};
