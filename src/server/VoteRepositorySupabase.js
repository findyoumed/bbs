'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const { createHttpError } = require('./httpUtils');

// [LOG: 20260622_2301] SupabaseVoteRepository 구현 — Supabase 모드 투표 시스템
// [LOG: 20260731_2300] _createHttpError 로컬 메서드 제거 — httpUtils.createHttpError로 통합
class SupabaseVoteRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
    this.table = options.table || 'votes';
    this.recordsTable = options.recordsTable || 'vote_records';
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table,
      recordsTable: this.recordsTable
    };
  }

  async checkHealth() {
    try {
      const { error } = await this.client
        .from(this.table)
        .select('id')
        .limit(1);
      if (error) throw error;
      return { status: 'ok', driver: this.driverName };
    } catch (error) {
      return { status: 'error', driver: this.driverName, message: error.message };
    }
  }

  async listVotes(context = {}) {
    return this._track('listVotes', async () => {
      // 1. votes 조회
      const { data: votes, error: votesError } = await this.client
        .from(this.table)
        .select('*')
        .order('id', { ascending: false });

      if (votesError) this._throwError('listVotes:votes', votesError, { table: this.table });
      if (!votes || votes.length === 0) return [];

      const voteIds = votes.map(v => v.id);

      // 2. 관련 records 조회
      const { data: records, error: recordsError } = await this.client
        .from(this.recordsTable)
        .select('*')
        .in('vote_id', voteIds);

      if (recordsError) this._throwError('listVotes:records', recordsError, { table: this.recordsTable });

      const recordsMap = new Map();
      for (const record of records || []) {
        const list = recordsMap.get(record.vote_id) ?? [];
        list.push(record);
        recordsMap.set(record.vote_id, list);
      }

      // 3. 데이터 결합
      const normalizedRequesterId = String(context.userId || '').trim().toLowerCase();
      return votes.map(vote => {
        const voteRecords = recordsMap.get(vote.id) ?? [];
        const counts = new Array(vote.options.length).fill(0);
        let userVotedOption = null;

        for (const record of voteRecords) {
          if (record.option_index >= 0 && record.option_index < counts.length) {
            counts[record.option_index]++;
          }
          if (normalizedRequesterId && record.user_id === normalizedRequesterId) {
            userVotedOption = record.option_index;
          }
        }

        return {
          id: Number(vote.id),
          title: vote.title,
          options: vote.options,
          createdBy: vote.created_by,
          createdAt: vote.created_at,
          isActive: vote.is_active,
          counts,
          totalVotes: voteRecords.length,
          userVotedOption
        };
      });
    });
  }

  async getVote(voteId, context = {}) {
    return this._track('getVote', async () => {
      const id = Number(voteId);

      const { data: vote, error: voteError } = await this.client
        .from(this.table)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (voteError) this._throwError('getVote:vote', voteError, { table: this.table });
      if (!vote) throw createHttpError(404, '투표를 찾을 수 없습니다.');

      const { data: records, error: recordsError } = await this.client
        .from(this.recordsTable)
        .select('*')
        .eq('vote_id', id);

      if (recordsError) this._throwError('getVote:records', recordsError, { table: this.recordsTable });

      const normalizedRequesterId = String(context.userId || '').trim().toLowerCase();
      const counts = new Array(vote.options.length).fill(0);
      let userVotedOption = null;

      for (const record of records || []) {
        if (record.option_index >= 0 && record.option_index < counts.length) {
          counts[record.option_index]++;
        }
        if (normalizedRequesterId && record.user_id === normalizedRequesterId) {
          userVotedOption = record.option_index;
        }
      }

      return {
        id: Number(vote.id),
        title: vote.title,
        options: vote.options,
        createdBy: vote.created_by,
        createdAt: vote.created_at,
        isActive: vote.is_active,
        counts,
        totalVotes: (records || []).length,
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

      const payload = {
        title,
        options,
        created_by: (context.userId && context.userId !== 'guest') ? context.userId.toLowerCase() : 'guest',
        is_active: true
      };

      const { data, error } = await this.client
        .from(this.table)
        .insert(payload)
        .select()
        .single();

      if (error) this._throwError('createVote', error, { table: this.table });

      return {
        id: Number(data.id),
        title: data.title,
        options: data.options,
        createdBy: data.created_by,
        createdAt: data.created_at,
        isActive: data.is_active
      };
    });
  }

  async castVote(voteId, optionIndex, context = {}) {
    return this._track('castVote', async () => {
      const id = Number(voteId);
      const optIdx = Number(optionIndex);
      const rawUserId = context.userId || 'guest';
      const userId = rawUserId !== 'guest' ? rawUserId.toLowerCase() : rawUserId;

      // 투표 활성 여부 검증
      const { data: vote, error: voteError } = await this.client
        .from(this.table)
        .select('is_active, options')
        .eq('id', id)
        .maybeSingle();

      if (voteError) this._throwError('castVote:verify', voteError, { table: this.table });
      if (!vote) throw createHttpError(404, '투표를 찾을 수 없습니다.');
      if (!vote.is_active) throw createHttpError(400, '종료된 투표입니다.');
      if (optIdx < 0 || optIdx >= vote.options.length) throw createHttpError(400, '올바르지 않은 선택지입니다.');

      const payload = {
        vote_id: id,
        user_id: userId,
        option_index: optIdx
      };

      const { data, error } = await this.client
        .from(this.recordsTable)
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // UNIQUE constraint violation
          throw createHttpError(409, '이미 투표에 참여하셨습니다.');
        }
        this._throwError('castVote:insert', error, { table: this.recordsTable });
      }

      return {
        voteId: Number(data.vote_id),
        userId: data.user_id,
        optionIndex: data.option_index,
        createdAt: data.created_at
      };
    });
  }

  async deleteVote(voteId, context = {}) {
    return this._track('deleteVote', async () => {
      const id = Number(voteId);

      const { data: vote, error: findError } = await this.client
        .from(this.table)
        .select('created_by')
        .eq('id', id)
        .maybeSingle();

      if (findError) this._throwError('deleteVote:find', findError, { table: this.table });
      if (!vote) throw createHttpError(404, '투표를 찾을 수 없습니다.');

      const requesterId = String(context.userId || '').trim().toLowerCase();
      if (!context.isAdmin && vote.created_by !== requesterId) {
        throw createHttpError(403, '삭제 권한이 없습니다.');
      }

      const { data: deleted, error: deleteError } = await this.client
        .from(this.table)
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (deleteError) this._throwError('deleteVote:delete', deleteError, { table: this.table });

      return {
        id: Number(deleted.id),
        title: deleted.title,
        options: deleted.options,
        createdBy: deleted.created_by,
        createdAt: deleted.created_at,
        isActive: deleted.is_active
      };
    });
  }
}

module.exports = {
  SupabaseVoteRepository
};
