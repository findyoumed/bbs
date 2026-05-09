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
  return error.code === 'PGRST205'
    || String(error.message).includes('schema cache')
    || String(error.message).includes('relation');
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
    userId: columns.author_id ? 'author_id' : (columns.user_id ? 'user_id' : null),
    nickName: columns.author_nickname ? 'author_nickname' : (columns.nick_name ? 'nick_name' : null),
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
