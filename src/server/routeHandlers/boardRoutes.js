'use strict';

const BaseRouter = require('./BaseRouter');

class BoardRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/boards/meta', handler: 'getMeta' },
      { method: 'GET', pattern: '/api/boards', handler: 'listBoards' },
      { method: 'GET', pattern: '/api/boards/hot', handler: 'listHotPosts' },
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
      { method: 'PATCH', pattern: '/api/boards/:boardId/posts/:postId', handler: 'updatePost', needContext: true, needBody: true },
      { method: 'DELETE', pattern: '/api/boards/:boardId/posts/:postId', handler: 'deletePost', needContext: true, needBody: true },
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

  async listHotPosts() {
    const limit = Number(this.requestUrl.searchParams.get('limit')) || 10;
    const days = Number(this.requestUrl.searchParams.get('days')) || 7;
    return this.send(200, await this.deps.boardRepository.listHotPosts({ limit, days }));
  }

  async listPosts(params) {
    const boardId = params.boardId;
    const options = this.getQueryOptions({ pageSize: 15 });
    const context = await this.getContext();
    
    return this.send(200, await this.deps.boardRepository.listPosts(boardId, {
      ...options,
      category: this.requestUrl.searchParams.get('category') || this.requestUrl.searchParams.get('header') || '',
      lt: this.requestUrl.searchParams.get('lt') || '',
      li: this.requestUrl.searchParams.get('li') || '',
      lc: this.requestUrl.searchParams.get('lc') || '',
      ln: this.requestUrl.searchParams.get('ln') || '',
      la: this.requestUrl.searchParams.get('la') || '',
      context
    }));
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
