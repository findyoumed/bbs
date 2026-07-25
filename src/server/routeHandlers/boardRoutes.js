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
      // [LOG_ID: 20260721_2300] local_id 이전 후 첨부 라우트(addAttachment 등)는 클라이언트가
      // 보내는 postId(=local_id ?? id)를 그대로 attachments.post_id에 저장하는데, 여기서만
      // item.id(전역 PK)로 조회해 두 값이 일치하지 않는 게시판(id!=local_id, 실서비스 전부 해당)에서
      // 자료실 목록의 파일명/용량/다운로드수 요약이 항상 빈 채로 나오는 버그였다 — 실제 첨부가 아직
      // 하나도 없어 지금까지 드러나지 않았을 뿐(Supabase 직접 조회로 id/local_id 발산 확인).
      const postIds = items.map((item) => item.localId ?? item.id).filter((id) => id != null);
      const summaries = await attachmentRepository.summariesForPosts(boardId, postIds);
      for (const item of items) {
        const summary = summaries[Number(item.localId ?? item.id)];
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

  async getPost(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const viewerContext = await this.getContext();
    return this.send(200, await this.deps.boardRepository.getPost(boardId, postId, {
      incrementHit: this.requestUrl.searchParams.get('view') === '1',
      viewerId: this.requestUrl.searchParams.get('userId') || viewerContext.userId || 'guest',
      viewerLevel: viewerContext.level || 1,
      context: viewerContext
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
    return this.send(200, await this.deps.boardRepository.deletePost(boardId, postId, context));
  }

  async listAttachments(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const context = await this.getContext();
    await this.ensureAttachmentReadable(boardId, postId, context);
    return this.send(200, await this.deps.attachmentRepository.list(boardId, postId));
  }

  async addAttachment(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    const body = await this.getBody();
    const context = await this.getContext();
    await this.ensureAttachmentWritable(boardId, postId, context);
    return this.send(201, await this.deps.attachmentRepository.add(boardId, postId, body || {}, context));
  }

  async handleAttachmentItem(params) {
    const boardId = params.boardId;
    const postId = Number(params.postId);
    const attachmentId = Number(params.attachmentId);
    if (isNaN(postId)) this.validationError('Invalid post ID');
    if (isNaN(attachmentId)) this.validationError('Invalid attachment ID');

    const isDownload = this.pathname.endsWith('/download');
    const context = await this.getContext();

    await this.ensureAttachmentReadable(boardId, postId, context);

    if (this.method === 'GET' && isDownload) {
      const { entry, buffer } = await this.deps.attachmentRepository.read(boardId, postId, attachmentId);
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
      return this.send(200, await this.deps.attachmentRepository.delete(boardId, postId, attachmentId));
    }
    return false;
  }

  async ensureAttachmentReadable(boardId, postId, context = {}) {
    await this.deps.boardRepository.getPost(boardId, postId, {
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
