'use strict';

const path = require('path');
const { loadEnv } = require('./lib/scriptUtils');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');

const rootDir = path.resolve(__dirname, '..');

async function main() {
  loadEnv(path.join(rootDir, '.env'));

  const repository = createBoardRepositoryFromEnv(process.env);
  if (repository.getMeta().driver !== 'supabase') {
    throw new Error(`smoke-supabase-live.js expects supabase repository, got ${repository.getMeta().driver}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  // [LOG: 20260620_1120] 게시판 글쓰기는 BoardRepositoryAccess가 게스트(userId==='guest')를 401로 차단한다.
  // 라이브 쓰기 검증이므로 비-게스트 작성자 ID를 사용한다. (생성한 글은 finally에서 정리)
  const userId = 'smoke_live_writer';
  const payload = {
    title: `[smoke] ${stamp}`,
    content: `live smoke body ${stamp}`,
    userId,
    nickName: 'CodexSmoke'
  };

  let createdId = null;
  let replyId = null;

  try {
    const before = await repository.listPosts('plaza', { page: 1, pageSize: 5 });
    const created = await repository.createPost('plaza', payload, payload);
    // [LOG_ID: 20260725_2130] 전수조사 중 재현: 게시글 상세/답글/수정/삭제 API는 게시판별 번호
    // (localId)로 주소를 잡는 계약인데(fetchPostByLocalId 참고, smoke-full-traversal.js에서
    // 20260725_1900에 이미 고친 것과 동일 유형) 이 라이브 스모크는 전역 row id를 그대로 넘기고
    // 있었다 — 답글 생성에서 "Parent post was not found."로 매번 죽었다.
    createdId = created.post.localId ?? created.post.id;
    const replied = await repository.replyToPost('plaza', createdId, {
      title: `${payload.title} reply`,
      content: `${payload.content} reply`,
      userId,
      nickName: payload.nickName
    }, payload);
    replyId = replied.post.localId ?? replied.post.id;

    const fetched = await repository.getPost('plaza', createdId, {
      incrementHit: false,
      viewerId: userId
    });

    const updated = await repository.updatePost('plaza', createdId, {
      title: `${payload.title} updated`,
      content: `${payload.content} updated`
    }, payload);

    await repository.deletePost('plaza', replyId, payload);
    replyId = null;
    await repository.deletePost('plaza', createdId, payload);
    createdId = null;

    const after = await repository.listPosts('plaza', { page: 1, pageSize: 5 });

    console.log(JSON.stringify({
      ok: true,
      beforeTotal: before.pagination.totalCount,
      createdId: created.post.id,
      replyId: replied.post.id,
      fetchedTitle: fetched.post.title,
      updatedTitle: updated.post.title,
      afterTotal: after.pagination.totalCount,
      restoredCount: before.pagination.totalCount === after.pagination.totalCount
    }, null, 2));
  } finally {
    if (replyId) {
      try {
        await repository.deletePost('plaza', replyId, payload);
      } catch (error) {
        console.error(`cleanup failed for reply ${replyId}: ${error.message}`);
      }
    }
    if (createdId) {
      try {
        await repository.deletePost('plaza', createdId, payload);
      } catch (error) {
        console.error(`cleanup failed for post ${createdId}: ${error.message}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
