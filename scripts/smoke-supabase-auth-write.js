'use strict';

const path = require('path');
const { loadEnv } = require('./lib/scriptUtils');
const { createClient } = require('@supabase/supabase-js');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');

function resolveNickname(user) {
  const metadata = user?.user_metadata || {};
  return String(
    metadata.nickname ||
    metadata.nick_name ||
    metadata.name ||
    metadata.username ||
    user?.email?.split('@')[0] ||
    '회원'
  ).trim() || '회원';
}

async function main() {
  loadEnv(path.join(path.resolve(__dirname, '..'), '.env'));

  const repository = createBoardRepositoryFromEnv(process.env);
  if (repository.getMeta().driver !== 'supabase') {
    throw new Error(`smoke-supabase-auth-write.js expects supabase repository, got ${repository.getMeta().driver}`);
  }

  const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const { data, error } = await authClient.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    throw error;
  }
  const authUser = data?.users?.[0];
  if (!authUser) {
    throw new Error('No auth users available for smoke test');
  }

  const context = {
    userId: authUser.id,
    nickName: resolveNickname(authUser),
    isAdmin: false
  };
  const stamp = Date.now();

  const created = await repository.createPost('plaza', {
    title: `[auth smoke] ${stamp}`,
    content: `auth smoke body ${stamp}`,
    userId: context.userId,
    nickName: context.nickName
  }, context);

  try {
    const viewed = await repository.getPost('plaza', created.post.id, {
      incrementHit: false,
      viewerId: context.userId
    });

    if (viewed.post.userId !== context.userId) {
      throw new Error(`expected author ${context.userId}, got ${viewed.post.userId}`);
    }

    console.log(JSON.stringify({
      ok: true,
      createdId: created.post.id,
      authorId: viewed.post.userId,
      nickName: viewed.post.nickName
    }, null, 2));
  } finally {
    await repository.deletePost('plaza', created.post.id, context);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
