'use strict';

const { createHttpError } = require('./BoardRepositoryShared');

const CAPABILITY_PROBE_COLUMNS = [
  'family_id',
  'sort_order',
  'depth',
  'user_id',
  'author_id',
  'nick_name',
  'author_nickname',
  'hit',
  'hits',
  'recommend',
  'likes',
  'board_type',
  'is_hidden',
  'is_notice',
  'category',
  'header'
];

function shouldUseBoardFallback(error) {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  return error?.code === 'PGRST205'
    || error?.status === 401
    || error?.status === 403
    // Repository helpers wrap upstream Supabase failures as HTTP 5xx errors,
    // which can hide the original provider message. Public read paths may
    // safely degrade for any such storage failure; other 4xx validation
    // errors remain outside this range and keep their existing behavior.
    || (status >= 500 && status < 600)
    || message.includes('schema cache')
    || message.includes('relation')
    || message.includes('invalid api key')
    || message.includes('invalid jwt')
    || message.includes('jwt expired')
    || message.includes('fetch failed')
    || message.includes('network')
    || message.includes('timed out');
}

function isMissingColumnError(error) {
  return shouldUseBoardFallback(error)
    || String(error?.message || '').includes('does not exist');
}

async function probeColumnExists(repo, column) {
  repo.postColumnPresence = repo.postColumnPresence || {};
  if (Object.prototype.hasOwnProperty.call(repo.postColumnPresence, column)) {
    return repo.postColumnPresence[column];
  }

  const { error } = await repo.client
    .from(repo.tables.posts)
    .select(column)
    .limit(1);

  if (!error) {
    repo.postColumnPresence[column] = true;
    return true;
  }

  if (isMissingColumnError(error)) {
    repo.postColumnPresence[column] = false;
    return false;
  }

  throw createHttpError(502, `게시글 컬럼 probe 실패 (${column}): ${error.message}`);
}

async function probeCapabilitiesFromEmptyTable(repo, keys) {
  for (const column of CAPABILITY_PROBE_COLUMNS) {
    if (!keys.has(column) && await probeColumnExists(repo, column)) {
      keys.add(column);
    }
  }

  return keys;
}

function buildCapabilities(keys) {
  const has = (column) => keys.has(column);
  const columns = Object.fromEntries(CAPABILITY_PROBE_COLUMNS.map((column) => [column, has(column)]));

  return {
    threaded: columns.family_id && columns.sort_order && columns.depth,
    // [LOG_ID: 20260727_1450] posts 테이블은 author_id(UUID, auth.users FK, isUuid 게이트 때문에
    // 거의 항상 NULL — 20260727_1256/1401/1441과 동일 패턴)와 user_id(TEXT, 이 앱의 실제 식별자,
    // 항상 채워짐)를 동시에 갖고 있다. 이전엔 author_id를 먼저 확인해 두 컬럼이 공존하는 이
    // 라이브 스키마에서 "userId 컬럼"이 사실상 항상 비어 있는 author_id로 잘못 잡혔다 — 그 결과
    // ID검색(LI)이 실제로는 입력값을 userId가 아니라 닉네임으로만 비교하는 조용한 폴백 경로를
    // 타고 있었다(실측 재현: LI로 실제 작성자 userId "sysop" 검색 시 0건, 반대로 닉네임 "시샵"으로
    // 검색하면 정상 매칭 — 사용자가 ID로 검색해도 항상 못 찾는 상태였다). mapPostRow의 우선순위
    // (row.user_id 우선)와 일치하도록, 실제로 채워지는 컬럼을 먼저 선택한다.
    userId: columns.user_id ? 'user_id' : (columns.author_id ? 'author_id' : null),
    nickName: columns.nick_name ? 'nick_name' : (columns.author_nickname ? 'author_nickname' : null),
    hit: columns.hits ? 'hits' : (columns.hit ? 'hit' : null),
    recommend: columns.recommend ? 'recommend' : (columns.likes ? 'likes' : null),
    boardType: columns.board_type ? 'board_type' : null,
    hidden: columns.is_hidden,
    notice: columns.is_notice,
    category: columns.category ? 'category' : (columns.header ? 'header' : null),
    columns
  };
}

async function ensureCapabilities(repo) {
  if (repo.capabilities) return repo.capabilities;

  const { data, error } = await repo.client
    .from(repo.tables.posts)
    .select('*')
    .limit(1);

  if (error) throw createHttpError(502, `게시글 스키마 조회 실패: ${error.message}`);

  const keys = new Set(Object.keys((data || [])[0] || {}));
  if (keys.size === 0) {
    await probeCapabilitiesFromEmptyTable(repo, keys);
  }

  repo.capabilities = buildCapabilities(keys);

  return repo.capabilities;
}

module.exports = {
  shouldUseBoardFallback,
  ensureCapabilities
};
