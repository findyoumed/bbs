'use strict';

const BaseRouter = require('./BaseRouter');
const logger = require('../logger');

class BoardRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/boards/meta', handler: 'getMeta' },
      { method: 'GET', pattern: '/api/boards', handler: 'listBoards' },
      { method: 'GET', pattern: '/api/boards/hot', handler: 'listHotPosts' },
      { method: 'GET', pattern: '/api/boards/counts', handler: 'listBoardCounts' },
      { method: 'GET', pattern: '/api/boards/:boardId', handler: 'listPosts', needContext: true },
      { 
        method: 'POST', 
        pattern: '/api/boards/:boardId/posts', 
        handler: 'createPost', 
        needContext: true,
        middlewares: ['ensureAuthenticated'],
        validate: {
          body: {
            title: { required: true, maxLength: 200 },
            content: { required: true }
          }
        }
      },
      { 
        method: 'POST', 
        pattern: '/api/boards/:boardId/posts/:postId/reply', 
        handler: 'replyToPost', 
        needContext: true,
        middlewares: ['ensureAuthenticated'],
        validate: {
          body: {
            content: { required: true }
          }
        }
      },
      {
        method: 'POST',
        pattern: '/api/boards/:boardId/posts/:postId/recommend',
        handler: 'recommendPost',
        needContext: true,
        needBody: true,
        middlewares: ['ensureAuthenticated']
      },
      { method: 'GET', pattern: '/api/boards/:boardId/posts/:postId', handler: 'getPost', needContext: true },
      {
        method: 'PATCH',
        pattern: '/api/boards/:boardId/posts/:postId',
        handler: 'updatePost',
        needContext: true,
        needBody: true,
        middlewares: ['ensureAuthenticated']
      },
      {
        method: 'DELETE',
        pattern: '/api/boards/:boardId/posts/:postId',
        handler: 'deletePost',
        needContext: true,
        needBody: true,
        middlewares: ['ensureAuthenticated']
      },
      { method: 'GET', pattern: '/api/boards/:boardId/posts/:postId/attachments', handler: 'listAttachments', needContext: true },
      { method: 'POST', pattern: '/api/boards/:boardId/posts/:postId/attachments', handler: 'addAttachment', needContext: true, needBody: true },
      { method: 'GET', pattern: '/api/boards/:boardId/posts/:postId/attachments/:attachmentId', handler: 'handleAttachmentItem', needContext: true, needBody: true },
      { method: 'GET', pattern: '/api/boards/:boardId/posts/:postId/attachments/:attachmentId/download', handler: 'handleAttachmentItem', needContext: true, needBody: true },
      { method: 'DELETE', pattern: '/api/boards/:boardId/posts/:postId/attachments/:attachmentId', handler: 'handleAttachmentItem', needContext: true, needBody: true }
    ];
  }

  async getMeta() {
    return this.send(200, this.deps.boardRepository.getMeta());
  }

  async listBoards() {
    return this.send(200, await this.deps.boardRepository.listBoards());
  }

  // [LOG_ID: 20260713_1230] 나우누리식 게시판 메뉴 ( 신규 / 전체 ) 건수
  async listBoardCounts() {
    return this.send(200, await this.deps.boardRepository.listBoardCounts());
  }

  async listHotPosts() {
    const limit = Number(this.requestUrl.searchParams.get('limit')) || 10;
    const days = Number(this.requestUrl.searchParams.get('days')) || 7;
    return this.send(200, await this.deps.boardRepository.listHotPosts({ limit, days }));
  }

  async listPosts(params) {
    const boardId = params.boardId;
    const options = this.getQueryOptions({ pageSize: 15 });
    const context = await this.getContext();

    const result = await this.deps.boardRepository.listPosts(boardId, {
      ...options,
      category: this.requestUrl.searchParams.get('category') || this.requestUrl.searchParams.get('header') || '',
      // [LOG_ID: 20260727_2340] 주제어검색(K) 명령이 완전히 무동작이었다 — 클라이언트가 searchParams.k를
      // 세워도 loadPosts()가 URL에 k를 아예 안 실었고(postService.js에서 별도 수정), 설령 실렸어도
      // 여기서 요청 쿼리스트링의 k를 한 번도 읽어 boardRepository로 넘긴 적이 없었다(둘 다 고쳐야
      // 실제로 필터링됨 — 리포지토리 레벨(applySupabaseSearch/BoardRepositorySearch.js)의 k 처리
      // 로직 자체는 이미 정상 구현돼 있었는데, 그 앞단 두 곳에서 값이 아예 전달되지 않았다).
      k: this.requestUrl.searchParams.get('k') || '',
      lt: this.requestUrl.searchParams.get('lt') || '',
      li: this.requestUrl.searchParams.get('li') || '',
      lc: this.requestUrl.searchParams.get('lc') || '',
      ln: this.requestUrl.searchParams.get('ln') || '',
      la: this.requestUrl.searchParams.get('la') || '',
      recent: this.requestUrl.searchParams.get('recent') || '',
      context
    });

    await this.enrichWithAttachmentSummaries(boardId, result);
    return this.send(200, result);
  }

  // [LOG_ID: 20260718_1200] 자료실(PDS) 목록 화면은 원전처럼 파일명/크기/전송(다운로드 수)을
  // 보여줘야 한다. 이 정보는 attachments 테이블에 있는데 목록 조회(listPosts)는 게시글만
  // 가져오므로, 자료실 게시판일 때만 페이지의 글들에 대표(첫) 첨부 요약을 한 번에 붙인다.
  //
  // 게이팅 기준은 attachment_enabled가 아니라 **자료실 여부(menu_path='pds' 또는 board_id
  // 'pds'/'pds_*')**다 — 실측하니 열린광장·유머 등 일반 게시판도 attachment_enabled=true라,
  // 그걸로 가르면 일반 게시판 목록까지 파일 컬럼으로 바뀐다. 파일 컬럼은 자료실 전용이다.
  isPdsBoard(board) {
    if (!board) return false;
    const id = String(board.boardId || board.id || '').trim();
    const menuPath = String(board.menuPath || '').trim();
    return menuPath === 'pds' || id === 'pds' || id.startsWith('pds_');
  }

  async enrichWithAttachmentSummaries(boardId, result) {
    const board = result && result.board;
    const items = result && Array.isArray(result.items) ? result.items : [];
    if (!this.isPdsBoard(board) || !items.length) {
      return;
    }
    const attachmentRepository = this.deps.attachmentRepository;
    if (!attachmentRepository || typeof attachmentRepository.summariesForPosts !== 'function') {
      return;
    }

    try {
      // [LOG_ID: 20260727_1330] 20260721_2300 당시엔 첨부 라우트(addAttachment 등)가 local_id를
      // attachments.post_id에 그대로 저장하고 있어서, 여기 요약 조회를 그 local_id에 맞춰 왔다.
      // 하지만 attachments.post_id는 실제로는 posts.id(전역 PK)를 참조하는 FK(ON DELETE CASCADE)라,
      // local_id를 저장하는 쪽이 근본 원인의 버그였다 — 서로 다른 게시판의 local_id가 우연히 같은
      // 전역 id와 겹치면 첨부가 엉뚱한 글에 FK로 묶여, 그 글이 지워질 때 무관한 첨부까지
      // CASCADE로 함께 사라지는 문제가 있었다(실측: humor 로컬 2번 글의 첨부가 plaza 전역 id=2번
      // 글에 묶여 있었음). addAttachment 등 저장 경로를 전역 id 기준으로 고쳤으므로(같은 LOG_ID),
      // 여기도 되돌려 전역 id(item.id)로 일치시킨다.
      const postIds = items.map((item) => item.id).filter((id) => id != null);
      const summaries = await attachmentRepository.summariesForPosts(boardId, postIds);
      for (const item of items) {
        const summary = summaries[Number(item.id)];
        if (summary) {
          item.fileName = summary.name;
          item.fileSize = summary.size;
          item.downloadCount = summary.downloadCount;
        }
      }
    } catch (error) {
      // 첨부 요약은 부가 정보다 — 실패해도 목록 자체는 그대로 내려준다.
      // [LOG_ID: 20260721_1030] this.deps.logger는 실제로 어디서도 주입되지 않아 이 경고가
      // 항상 조용히 삼켜지고 있었다(에러 핸들링 일관성 점검 중 발견) — 공용 logger 모듈을 직접 쓴다.
      logger.warn('첨부 요약 조회 실패', { component: 'BoardRouter', boardId, error: error.message });
    }
  }

  async createPost(params) {
    const boardId = params.boardId;
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(201, await this.deps.boardRepository.createPost(boardId, body, context));
  }

  async replyToPost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(201, await this.deps.boardRepository.replyToPost(boardId, postId, body, context));
  }

  async recommendPost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const context = await this.getContext();
    return this.send(200, await this.deps.boardRepository.recommendPost(boardId, postId, context));
  }

  // [LOG_ID: 20260728_1728] PDS 가상 게시판 및 검색 상태의 내비게이션 정확성 보존을 위해 virtualBoardId와 search 파라미터를 추가 연계
  async getPost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const viewerContext = await this.getContext();
    const virtualBoardId = this.requestUrl.searchParams.get('virtualBoardId') || '';
    const search = {
      lt: this.requestUrl.searchParams.get('lt') || '',
      li: this.requestUrl.searchParams.get('li') || '',
      lc: this.requestUrl.searchParams.get('lc') || '',
      ln: this.requestUrl.searchParams.get('ln') || '',
      la: this.requestUrl.searchParams.get('la') || '',
      k: this.requestUrl.searchParams.get('k') || '',
      recent: this.requestUrl.searchParams.get('recent') || ''
    };
    return this.send(200, await this.deps.boardRepository.getPost(boardId, postId, {
      incrementHit: this.requestUrl.searchParams.get('view') === '1',
      viewerId: this.requestUrl.searchParams.get('userId') || viewerContext.userId || 'guest',
      viewerLevel: viewerContext.level || 1,
      context: viewerContext,
      virtualBoardId,
      search
    }));
  }

  async updatePost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const body = await this.getBody();
    const context = await this.getContext();
    return this.send(200, await this.deps.boardRepository.updatePost(boardId, postId, body || {}, context));
  }

  async deletePost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const context = await this.getContext();
    const result = await this.deps.boardRepository.deletePost(boardId, postId, context);
    // [LOG_ID: 20260727_1425] 완전 삭제는 attachments.post_id의 ON DELETE CASCADE로 이미 정리되지만
    // (20260727_1339에서 FK를 올바른 전역 id로 고친 뒤부터), "원글에 답글이 남아있어 자리표시자로
    // 바뀌는" tombstone 경로는 글 행 자체가 살아있어 CASCADE가 아예 발동하지 않는다 — 첨부파일이
    // 화면엔 "[삭제된 글입니다]"로 보이는 글 아래에서도 계속 목록·다운로드가 가능하게 남는 모순이
    // 있었다(실측 확인). 여기서 명시적으로 정리한다 — Memory 드라이버(FK/CASCADE 없음)의 완전
    // 삭제 경로도 원래 정리되지 않았으므로 tombstone 여부와 무관하게 항상 시도한다(Supabase
    // 완전 삭제는 이미 비어 있어 그냥 아무 일도 안 함).
    await this.cleanupAttachmentsForDeletedPost(boardId, result?.post?.id);
    return this.send(200, result);
  }

  async cleanupAttachmentsForDeletedPost(boardId, globalPostId) {
    const attachmentRepository = this.deps.attachmentRepository;
    if (!attachmentRepository || !globalPostId) {
      return;
    }
    try {
      const attachments = await attachmentRepository.list(boardId, globalPostId);
      for (const attachment of attachments || []) {
        await attachmentRepository.delete(boardId, globalPostId, attachment.id);
      }
    } catch (error) {
      // 첨부 정리는 부가 작업이다 — 실패해도 글 삭제 자체는 이미 끝났으므로 삼키지 않고 로그만.
      logger.warn('삭제된 글의 첨부 정리 실패', { component: 'BoardRouter', boardId, globalPostId, error: error.message });
    }
  }

  async listAttachments(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const context = await this.getContext();
    const article = await this.ensureAttachmentReadable(boardId, postId, context);
    // [LOG_ID: 20260727_1330] postId(URL의 local_id)를 그대로 attachmentRepository에 넘기면 안 된다 —
    // article.post.id(전역 posts.id)를 대신 쓴다. 아래 addAttachment 주석 참고.
    return this.send(200, await this.deps.attachmentRepository.list(boardId, article.post.id));
  }

  async addAttachment(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const body = await this.getBody();
    const context = await this.getContext();
    const article = await this.ensureAttachmentWritable(boardId, postId, context);
    // [LOG_ID: 20260727_1330] attachments.post_id는 posts.id(전역 PK)를 참조하는 FK(ON DELETE
    // CASCADE)인데, 이 URL의 :postId는 게시판별로 독립 채번되는 local_id라 전역 id와 다르다
    // (PostReads.js 170행 주석: "서로 다른 하위 게시판에 local_id가 같은 글이 동시에 존재할 수
    // 있다"). 지금까지 이 local_id 값을 그대로 post_id에 저장해 와서, 우연히 다른 게시판의
    // 전역 id와 값이 겹치면 그 무관한 글에 첨부파일이 FK로 묶였다 — 실측 확인: humor 게시판
    // 로컬 2번 글(전역 id=309)에 올린 첨부가 실제로는 plaza 게시판 전역 id=2번 글에 CASCADE로
    // 묶여, 그 글이 지워지면 이 humor 첨부까지 통째로 사라지고, 반대로 humor 글을 지워도 첨부는
    // 전혀 정리되지 않는 상태였다. article.post.id(getPost가 이미 조회해 둔 전역 id)를 쓴다.
    return this.send(201, await this.deps.attachmentRepository.add(boardId, article.post.id, body || {}, context));
  }

  async handleAttachmentItem(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    const attachmentId = Number(params.attachmentId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    if (isNaN(attachmentId)) this.validationError('Invalid attachment ID');

    const isDownload = this.pathname.endsWith('/download');
    const context = await this.getContext();

    const article = await this.ensureAttachmentReadable(boardId, postId, context);
    // [LOG_ID: 20260727_1330] addAttachment와 동일한 이유로 전역 id를 쓴다.
    const globalPostId = article.post.id;

    if (this.method === 'GET' && isDownload) {
      const { entry, buffer } = await this.deps.attachmentRepository.read(boardId, globalPostId, attachmentId);
      this.res.writeHead(200, {
        'Content-Type': entry.mimeType || 'application/octet-stream',
        'Content-Length': buffer.length,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(entry.originalName)}`
      });
      this.res.end(buffer);
      return true;
    }

    if (this.method === 'DELETE' && !isDownload) {
      await this.ensureAttachmentWritable(boardId, postId, context);
      return this.send(200, await this.deps.attachmentRepository.delete(boardId, globalPostId, attachmentId));
    }
    return false;
  }

  async ensureAttachmentReadable(boardId, postId, context = {}) {
    return this.deps.boardRepository.getPost(boardId, postId, {
      incrementHit: false,
      viewerId: context?.userId || 'guest',
      viewerLevel: context?.level || 1,
      context
    });
  }

  async ensureAttachmentWritable(boardId, postId, context) {
    const article = await this.deps.boardRepository.getPost(boardId, postId, {
      incrementHit: false,
      viewerId: context?.userId || 'guest',
      viewerLevel: context?.level || 1,
      context
    });

    if (!article.board?.attachmentEnabled) {
      this.validationError('해당 게시판은 첨부 기능이 비활성화되어 있습니다.');
    }

    if (context?.isAdmin) {
      return article;
    }

    if (!context?.userId || article.post?.userId !== context.userId) {
      this.forbidden('작성자만 첨부 파일을 관리할 수 있습니다.');
    }

    return article;
  }
}

async function handleBoardRoutes(deps) {
  const router = new BoardRouter(deps);
  return await router.handle();
}

module.exports = handleBoardRoutes;
