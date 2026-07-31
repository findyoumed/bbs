'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');

const {
  buildStoredName,
  createHttpError,
  decodeAttachmentPayload,
  normalizeEntry
} = require('./AttachmentRepositoryShared');
// [LOG_ID: 20260729_0330] 병합 게시판 필터를 손으로 조립(`.in('board_id', …)`)하지 않고 정본인
// applyBoardFilter를 쓴다 — board_id 컬럼만 건드리는 테이블 무관 헬퍼라 첨부 테이블에도 그대로
// 쓸 수 있다. 종전엔 이 조립이 파일 안에서 세 벌로 갈려 있었다(.filter(Boolean) 유무, 단일
// 게시판일 때 .eq()로 낮추는 처리 누락).
// [LOG_ID: 20260730_0430] 지금은 _summariesForPosts 한 곳만 이 넓히기가 필요하다 — 병합 목록
// 화면의 여러 물리 게시판에 걸친 배치 조회라 단일 물리 id로 좁힐 수가 없다. 단건/목록 조회는
// 호출부가 물리 id를 해석해 넘겨주므로 정확 비교를 쓴다(boardRoutes.attachmentBoardId 참고).
const { applyBoardFilter } = require('./SupabaseBoardRepositoryQueryHelpers');

// [LOG_ID: 20260729_0330] 첨부 본문(content_base64)을 제외한 메타 컬럼 — 목록/단건 조회가
// 공유한다. 종전엔 _list가 select('*')로 본문까지 받아 그대로 버렸다(normalizeEntry는
// content_base64를 읽지 않는다): 1MB 첨부 3개짜리 글의 목록을 그리려고 ~4MB를 실어오던 셈.
const ATTACHMENT_META_COLUMNS = 'id, board_id, post_id, user_id, nick_name, filename, original_filename, mime_type, file_size, download_count, created_at';

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
    // [LOG_ID: 20260730_0430] boardId는 호출부(boardRoutes.attachmentBoardId)가 이미 물리 id로
    // 해석해 넘겨준다 — 여기서 병합 소스로 넓힐 필요가 없다(넓히면 오히려 형제 자료실 게시판의
    // 첨부까지 받아들이는 더 느슨한 비교가 된다).
    const { data, error } = await this.client
      .from(this.table)
      .select(ATTACHMENT_META_COLUMNS)
      .eq('board_id', boardId)
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
    // board_id로 저장돼 있다(실측 확인: 물리 게시판 직접 조회에선 정상 표시, 가상 'pds'
    // 목록에선 항상 undefined). 이 배치 조회는 한 페이지에 여러 물리 게시판의 글이 섞여 들어오므로
    // 단일 물리 id로 좁힐 수 없다 — 첨부 조회 경로 중 유일하게 applyBoardFilter로 넓히는 지점.
    const query = applyBoardFilter(
      this.client.from(this.table).select('post_id, original_filename, filename, file_size, download_count, id'),
      boardId
    );
    const { data, error } = await query
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
        // [LOG: 20260731_1720] 대소문자 무결성을 위해 소문자 정형화 처리
        user_id: (context.userId && context.userId !== 'guest') ? context.userId.toLowerCase() : 'guest',
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

    // [LOG_ID: 20260729_0330] 종전엔 이 UPDATE도 .select('*')라, 방금 위에서 이미 받아 buffer로
    // 디코딩해 둔 content_base64(최대 1MB → base64 ~1.4MB)를 응답으로 한 번 더 실어왔다.
    // normalizeEntry는 그 컬럼을 읽지 않으므로 순수 낭비였다 — 다운로드 1건당 전송량이 두 배.
    const { data, error } = await this.client
      .from(this.table)
      .update({
        download_count: Number(row.download_count || 0) + 1
      })
      .eq('id', Number(row.id))
      .select(ATTACHMENT_META_COLUMNS)
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

  // get/read(다운로드)/delete가 모두 공유하는 단건 조회 지점.
  // [LOG_ID: 20260730_0430] _list와 마찬가지로 boardId는 이미 물리 id로 해석돼 들어온다.
  async _getRow(boardId, postId, attachmentId, includeContent) {
    const columns = includeContent ? '*' : ATTACHMENT_META_COLUMNS;
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
