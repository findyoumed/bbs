'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');

const {
  buildStoredName,
  createHttpError,
  decodeAttachmentPayload,
  isMissingAttachmentsTableError,
  normalizeEntry
} = require('./AttachmentRepositoryShared');
const { getMergedBoardSourceIds } = require('./BoardVirtualBoards');

class SupabaseAttachmentRepository extends BaseRepository {
  constructor(options = {}) {
    super({ ...options, driverName: 'supabase' });
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
    this.table = options.table || 'attachments';
    this.maxBytes = Number(options.maxBytes || 1024 * 1024);
  }

  getMeta() {
    return {
      ...super.getMeta(),
      table: this.table
    };
  }

  list(boardId, postId) {
    return this._list(boardId, postId);
  }

  async _list(boardId, postId) {
    // [LOG_ID: 20260729_0215] summariesForPosts(20260728_2350)와 동일한 이유로 병합 소스 전체를
    // 대상으로 넓힌다 — PDS 가상 게시판('pds') boardId로 이 메서드를 부르면 실제 첨부가 저장된
    // 물리 하위 게시판(pds_all 등)과 절대 일치하지 않아 목록이 항상 비어 보였다. post_id는
    // 이미 전역 PK라 board_id 필터는 부가 검증일 뿐이므로, 병합 소스로 넓혀도 안전하다.
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .in('board_id', getMergedBoardSourceIds(boardId))
      .eq('post_id', Number(postId))
      .order('id', { ascending: true });

    if (error) {
      this._throwError('첨부 목록 조회', error, { table: this.table });
    }

    return (data || []).map(normalizeEntry);
  }

  // [LOG_ID: 20260718_1200] 자료실(PDS) 목록에 파일명/크기/전송을 붙이기 위한 배치 조회.
  // 글마다 list()를 부르면 페이지당 15번 왕복이라, post_id IN (...) 한 번으로 끝낸다.
  // 글당 첫 첨부(id 오름차순 첫 행)만 대표로 쓴다. 반환: { [postId]: {name,size,downloadCount} }.
  summariesForPosts(boardId, postIds) {
    return this._summariesForPosts(boardId, postIds);
  }

  async _summariesForPosts(boardId, postIds) {
    const ids = (postIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (!ids.length) return {};

    // [LOG_ID: 20260728_2350] PDS 목록 화면은 사용자가 실제로 접근하는 유일한 경로인 가상
    // 게시판('pds')을 boardId로 넘겨오지만, 첨부는 업로드 당시의 물리 하위 게시판(pds_prog 등)
    // board_id로 저장돼 있다. 여기서 그 가상 id 그대로 .eq('board_id', boardId)를 걸면 실제
    // 하위 게시판들과 절대 일치하지 않아, PDS 목록 화면의 파일명/크기/전송 칸이 항상 비어
    // 있었다(실측 확인: 물리 게시판 직접 조회에선 정상 표시, 가상 'pds' 목록에선 항상 undefined).
    // 목록 조회(applyBoardFilter)와 동일하게 병합 소스 전체로 필터를 넓힌다.
    const boardIds = getMergedBoardSourceIds(boardId).filter(Boolean);
    const { data, error } = await this.client
      .from(this.table)
      .select('post_id, original_filename, filename, file_size, download_count, id')
      .in('board_id', boardIds)
      .in('post_id', ids)
      .order('id', { ascending: true });

    if (error) {
      this._throwError('첨부 요약 조회', error, { table: this.table });
    }

    const byPost = {};
    for (const row of data || []) {
      const key = Number(row.post_id);
      if (byPost[key]) continue; // 첫(가장 이른) 첨부만
      byPost[key] = {
        name: String(row.original_filename || row.filename || ''),
        size: Number(row.file_size || 0),
        downloadCount: Number(row.download_count || 0)
      };
    }
    return byPost;
  }

  get(boardId, postId, attachmentId) {
    return this._get(boardId, postId, attachmentId);
  }

  async _get(boardId, postId, attachmentId) {
    const row = await this._getRow(boardId, postId, attachmentId, false);
    return normalizeEntry(row);
  }

  add(boardId, postId, payload, context = {}) {
    return this._add(boardId, postId, payload, context);
  }

  async _add(boardId, postId, payload, context = {}) {
    const { originalName, mimeType, buffer } = decodeAttachmentPayload(payload, this.maxBytes);
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        board_id: boardId,
        post_id: Number(postId),
        user_id: context.userId || 'guest',
        nick_name: context.nickName || '손님',
        filename: buildStoredName(originalName),
        original_filename: originalName,
        mime_type: mimeType,
        file_size: buffer.length,
        download_count: 0,
        content_base64: buffer.toString('base64')
      })
      .select('*')
      .single();

    if (error) {
      this._throwError('첨부 저장', error, { table: this.table });
    }

    return normalizeEntry(data);
  }

  read(boardId, postId, attachmentId) {
    return this._read(boardId, postId, attachmentId);
  }

  async _read(boardId, postId, attachmentId) {
    const row = await this._getRow(boardId, postId, attachmentId, true);
    const contentBase64 = String(row.content_base64 || '').trim();
    if (!contentBase64) {
      throw createHttpError(404, '첨부 파일 내용이 저장소에 없습니다.');
    }

    let buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch (error) {
      throw createHttpError(500, '첨부 파일 내용이 손상되었습니다.');
    }

    const { data, error } = await this.client
      .from(this.table)
      .update({
        download_count: Number(row.download_count || 0) + 1
      })
      .eq('id', Number(row.id))
      .select('*')
      .single();

    if (error) {
      this._throwError('첨부 다운로드 수 갱신', error, { table: this.table });
    }

    return {
      entry: normalizeEntry(data),
      buffer
    };
  }

  delete(boardId, postId, attachmentId) {
    return this._delete(boardId, postId, attachmentId);
  }

  async _delete(boardId, postId, attachmentId) {
    const row = await this._getRow(boardId, postId, attachmentId, false);
    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq('id', Number(row.id));

    if (error) {
      this._throwError('첨부 삭제', error, { table: this.table });
    }

    return normalizeEntry(row);
  }

  async _getRow(boardId, postId, attachmentId, includeContent) {
    // [LOG_ID: 20260729_0215] _list와 동일한 이유로 병합 소스 전체를 대상으로 넓힌다 — 이 메서드는
    // get/read(다운로드)/delete가 모두 공유하므로, 고치지 않으면 PDS 다운로드('DN' 목록 화면
    // 즉시다운로드)까지 가상 boardId('pds') 탓에 "첨부 파일을 찾을 수 없습니다" 404로 실패한다.
    const columns = includeContent
      ? '*'
      : 'id, board_id, post_id, user_id, nick_name, filename, original_filename, mime_type, file_size, download_count, created_at';
    const { data, error } = await this.client
      .from(this.table)
      .select(columns)
      .in('board_id', getMergedBoardSourceIds(boardId))
      .eq('post_id', Number(postId))
      .eq('id', Number(attachmentId))
      .maybeSingle();

    if (error) {
      this._throwError('첨부 조회', error, { table: this.table });
    }
    if (!data) {
      throw createHttpError(404, '첨부 파일을 찾을 수 없습니다.');
    }

    return data;
  }
}

module.exports = {
  SupabaseAttachmentRepository
};
