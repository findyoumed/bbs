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
  const userId = 'guest';
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
    createdId = created.post.id;
    const replied = await repository.replyToPost('plaza', createdId, {
      title: `${payload.title} reply`,
      content: `${payload.content} reply`,
      userId,
      nickName: payload.nickName
    }, payload);
    replyId = replied.post.id;

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
