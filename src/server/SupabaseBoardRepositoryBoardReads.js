'use strict';

const {
  createHttpError,
  mapBoardRow,
  cloneBoard
} = require('./BoardRepositoryShared');
const { shouldUseBoardFallback } = require('./SupabaseBoardRepositorySchema');

const BOARD_CACHE_TTL_MS = 30 * 1000;

function getBoardCache(repo) {
  if (!repo._boardCache) {
    repo._boardCache = new Map();
  }
  return repo._boardCache;
}

function cacheBoard(repo, board) {
  if (!board?.boardId) return board;
  getBoardCache(repo).set(board.boardId, {
    at: Date.now(),
    board: cloneBoard(board)
  });
  return board;
}

function getCachedBoard(repo, boardId) {
  const cached = getBoardCache(repo).get(boardId);
  if (!cached) return null;
  if (Date.now() - cached.at >= BOARD_CACHE_TTL_MS) {
    getBoardCache(repo).delete(boardId);
    return null;
  }
  return cloneBoard(cached.board);
}

function mergeBoardDefinition(repo, board) {
  if (!board) {
    return null;
  }

  const definition = repo.boards.find((entry) => entry.boardId === board.boardId);
  if (!definition) {
    return board;
  }

  return {
    ...cloneBoard(definition),
    ...board
  };
}

function compareBoardOrder(left, right) {
  const leftMenuPath = String(left?.menuPath || '').trim();
  const rightMenuPath = String(right?.menuPath || '').trim();
  if (leftMenuPath !== rightMenuPath) {
    return leftMenuPath.localeCompare(rightMenuPath, 'ko');
  }

  const leftDoor = Number(String(left?.door || '').trim() || 0);
  const rightDoor = Number(String(right?.door || '').trim() || 0);
  if (leftDoor !== rightDoor) {
    return leftDoor - rightDoor;
  }

  return String(left?.boardId || '').localeCompare(String(right?.boardId || ''), 'ko');
}

function mergeBoardList(repo, boards) {
  const merged = new Map();
  for (const board of boards || []) {
    if (!board?.boardId) continue;
    merged.set(board.boardId, mergeBoardDefinition(repo, board));
  }
  for (const board of repo.boards || []) {
    if (!board?.boardId || merged.has(board.boardId)) continue;
    merged.set(board.boardId, cloneBoard(board));
  }
  return Array.from(merged.values()).sort(compareBoardOrder);
}

async function listBoards(repo) {
  const cached = repo._boardListCache;
  if (cached && (Date.now() - cached.at) < BOARD_CACHE_TTL_MS) {
    return cached.data.map(cloneBoard);
  }

  const { data, error } = await repo.client
    .from(repo.tables.boards)
    .select('*')
    .order('menu_path', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('board_id', { ascending: true });

  if (error) {
    // [LOG_ID: 20260805_0913] The legacy menu definitions are already loaded
    // during cold start. Keep the public board list available when Supabase is
    // temporarily unavailable or rejects the server key; board/post requests
    // still surface their own storage errors instead of blocking the shell.
    const fallback = repo.boards.map(cloneBoard);
    repo._boardListCache = { at: Date.now(), data: fallback };
    if (repo.logger && typeof repo.logger.warn === 'function') {
      repo.logger.warn('Supabase board list unavailable; using legacy definitions.', {
        code: error.code || '',
        message: error.message || 'unknown error'
      });
    }
    return fallback.map(cloneBoard);
  }

  const result = mergeBoardList(repo, (data || []).map((row) => mapBoardRow(row)));
  const cache = getBoardCache(repo);
  const now = Date.now();
  for (const board of result) {
    if (board?.boardId) {
      cache.set(board.boardId, { at: now, board: cloneBoard(board) });
    }
  }
  repo._boardListCache = { at: now, data: result.map(cloneBoard) };
  return result;
}

async function getBoard(repo, boardId) {
  const cached = getCachedBoard(repo, boardId);
  if (cached) {
    return cached;
  }

  const { data, error } = await repo.client
    .from(repo.tables.boards)
    .select('*')
    .eq('board_id', boardId)
    // [LOG_ID: 20260805_0920] Legacy migrations can leave duplicate board
    // rows. A board lookup needs one definition, so avoid maybeSingle()'s
    // PGRST116 error and keep the deterministic first row.
    .limit(1);

  if (error) {
    if (shouldUseBoardFallback(error)) {
      return cloneBoard(repo.boards.find((board) => board.boardId === boardId));
    }
    throw createHttpError(502, `게시판 조회 실패: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row) {
    return cacheBoard(repo, mergeBoardDefinition(repo, mapBoardRow(row)));
  }

  return cacheBoard(repo, cloneBoard(repo.boards.find((board) => board.boardId === boardId)));
}

module.exports = {
  getBoard,
  listBoards,
  mergeBoardDefinition,
  mergeBoardList
};
