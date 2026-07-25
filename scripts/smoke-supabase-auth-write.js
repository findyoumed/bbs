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
  // [LOG_ID: 20260725_2130] 전수조사 중 재현: 게시글 상세/삭제 API는 게시판별 번호(localId)로
  // 주소를 잡는 계약인데(smoke-supabase-live.js에서 같은 유형으로 이미 고침) 전역 row id를
  // 그대로 넘겨 매번 404로 죽었다.
  const createdId = created.post.localId ?? created.post.id;

  try {
    const viewed = await repository.getPost('plaza', createdId, {
      incrementHit: false,
      viewerId: context.userId
    });

    if (viewed.post.userId !== context.userId) {
      throw new Error(`expected author ${context.userId}, got ${viewed.post.userId}`);
    }

    console.log(JSON.stringify({
      ok: true,
      createdId,
      authorId: viewed.post.userId,
      nickName: viewed.post.nickName
    }, null, 2));
  } finally {
    await repository.deletePost('plaza', createdId, context);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
