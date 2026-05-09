'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const AssetManager = require('../src/core/AssetManager');
const MenuResolver = require('../src/server/MenuResolver');
const RssService = require('../src/server/RssService');
const { createAttachmentRepository } = require('../src/server/AttachmentRepository');
const { resolveLegacyPaths } = require('../src/server/projectPaths');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');
const createRequestHandler = require('../src/server/createRequestHandler');

async function request(base, pathname, options = {}) {
  const response = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${pathname} -> ${JSON.stringify(payload)}`);
  }

  // [LOG: 20260425_2057] Extract data from standard API envelope
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }

  return payload;
}

const { assert } = require('./lib/scriptUtils');

async function main() {
  process.env.BOARD_REPOSITORY_DRIVER = 'memory';

  const projectRoot = path.resolve(__dirname, '..');
  const attachmentBaseDir = path.join(projectRoot, 'data', 'tmp', `smoke-boards-${process.pid}-${Date.now()}`);

  const boardRepository = createBoardRepositoryFromEnv(process.env);
  const legacyPaths = resolveLegacyPaths(process.env, projectRoot);
  if (boardRepository.getMeta().driver !== 'memory') {
    throw new Error(`smoke-boards.js expects memory repository, got ${boardRepository.getMeta().driver}`);
  }

  const requestHandler = createRequestHandler({
    projectRoot,
    assetManager: new AssetManager(legacyPaths.legacyTxtPath),
    boardRepository,
    attachmentRepository: createAttachmentRepository(projectRoot, { baseDir: attachmentBaseDir }),
    menuResolver: new MenuResolver(legacyPaths.menuFilePath),
    rssService: new RssService({
      newsMenuPath: legacyPaths.newsMenuPath,
      weatherMenuPath: legacyPaths.weatherMenuPath
    })
  });

  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const meta = await request(base, '/api/boards/meta');
    const boards = await request(base, '/api/boards');
    const menu = await request(base, '/api/menu');
    const plaza = await request(base, '/api/boards/plaza?page=1');
    // [LOG: 20260408_1000] '답글'은 plaza seed에 없으므로 실제 존재하는 '샘플'로 교체
    const plazaSearch = await request(base, `/api/boards/plaza?page=1&lt=${encodeURIComponent('샘플')}`);
    // [LOG: 20260408_1000] bbs_pds_prog_os → pds_prog (현재 board ID 기준)
    const prog = await request(base, '/api/boards/pds_prog?page=1');
    const firstPostId = plaza.items[0].id;
    const firstPost = await request(base, `/api/boards/plaza/posts/${firstPostId}?view=1&userId=guest`);
    const noticeBoard = boards.find((board) => board.boardId === 'notice') || {};
    const created = await request(base, '/api/boards/plaza/posts', {
      method: 'POST',
      body: { title: 'Smoke board post', content: 'board smoke test body', userId: 'guest', nickName: '손님' }
    });
    const uploadedAttachment = await request(base, `/api/boards/plaza/posts/${created.post.id}/attachments`, {
      method: 'POST',
      body: {
        name: 'smoke.txt',
        mimeType: 'text/plain',
        contentBase64: Buffer.from('attachment smoke', 'utf-8').toString('base64'),
        userId: 'guest',
        nickName: '손님'
      }
    });
    const attachmentList = await request(base, `/api/boards/plaza/posts/${created.post.id}/attachments`);
    const downloadedAttachment = await fetch(`${base}/api/boards/plaza/posts/${created.post.id}/attachments/${uploadedAttachment.id}/download`).then((response) => response.text());
    const replied = await request(base, `/api/boards/plaza/posts/${created.post.id}/reply`, {
      method: 'POST',
      body: { title: 'Smoke board reply', content: 'reply body', userId: 'guest', nickName: '손님' }
    });
    const updated = await request(base, `/api/boards/plaza/posts/${created.post.id}`, {
      method: 'PATCH',
      body: { title: 'Smoke board post updated', content: 'board smoke test update', userId: 'guest', nickName: '손님' }
    });
    const recommended = await request(base, `/api/boards/plaza/posts/${firstPostId}/recommend`, {
      method: 'POST',
      body: { userId: 'guest', nickName: '손님' }
    });
    const deleted = await request(base, `/api/boards/plaza/posts/${replied.post.id}`, {
      method: 'DELETE',
      body: { userId: 'guest', nickName: '손님' }
    });
    const deletedAttachment = await request(base, `/api/boards/plaza/posts/${created.post.id}/attachments/${uploadedAttachment.id}`, {
      method: 'DELETE',
      body: { userId: 'guest', nickName: '손님' }
    });
    const attachmentListAfterDelete = await request(base, `/api/boards/plaza/posts/${created.post.id}/attachments`);
    const routedHtml = await fetch(`${base}/board/plaza`).then((response) => response.text());

    assert(noticeBoard.writeSysopOnly === true, 'notice board should inherit writeSysopOnly from menu');
    assert(noticeBoard.replyEnabled === false, 'notice board should inherit replyEnabled from menu');
    assert(noticeBoard.attachmentEnabled === true, 'notice board should inherit attachmentEnabled from menu');
    assert(plazaSearch.search?.mode === 'lt', 'board search mode should round-trip');
    assert(plazaSearch.pagination.totalCount >= 1, 'board search should return seeded matches');
    assert(attachmentList.length === 1, 'attachment list should include uploaded file');
    assert(downloadedAttachment === 'attachment smoke', 'attachment download should return uploaded content');
    assert(attachmentListAfterDelete.length === 0, 'attachment should be deleted');
    // [LOG: 20260408_1000] main.js → app.js (단일 파일 SPA 전환 반영)
    assert(routedHtml.includes('type="module" src="/js/app.js"'), 'board route should serve module app shell');

    console.log(JSON.stringify({
      ok: true,
      repository: meta.driver,
      boardCount: boards.length,
      menuRoot: menu.go,
      menuDoorCount: menu.children.length,
      progBoardName: prog.board.name,
      progBoardTotal: prog.pagination.totalCount,
      noticeFlags: {
        writeSysopOnly: noticeBoard.writeSysopOnly,
        replyEnabled: noticeBoard.replyEnabled,
        attachmentEnabled: noticeBoard.attachmentEnabled
      },
      plazaTotal: plaza.pagination.totalCount,
      plazaSearchTotal: plazaSearch.pagination.totalCount,
      plazaSearchMode: plazaSearch.search?.mode || '',
      viewedPostId: firstPostId,
      viewedHit: firstPost.post.hit,
      createdId: created.post.id,
      attachmentId: uploadedAttachment.id,
      attachmentName: uploadedAttachment.originalName,
      replyId: replied.post.id,
      updatedTitle: updated.post.title,
      recommendedCount: recommended.post.recommend,
      deletedReplyId: deleted.post.id,
      deletedAttachmentId: deletedAttachment.id,
      routedHtmlOk: true
    }, null, 2));
  } finally {
    server.close();
    try {
      fs.rmSync(attachmentBaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch (error) {
      // Ignore Windows file lock races in best-effort test cleanup.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
