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
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('board_id', boardId)
      .eq('post_id', Number(postId))
      .order('id', { ascending: true });

    if (error) {
      this._throwError('첨부 목록 조회', error, { table: this.table });
    }

    return (data || []).map(normalizeEntry);
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
    const columns = includeContent
      ? '*'
      : 'id, board_id, post_id, user_id, nick_name, filename, original_filename, mime_type, file_size, download_count, created_at';
    const { data, error } = await this.client
      .from(this.table)
      .select(columns)
      .eq('board_id', boardId)
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
