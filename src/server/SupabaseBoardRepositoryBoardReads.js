'use strict';

const {
  createHttpError,
  mapBoardRow,
  cloneBoard
} = require('./BoardRepositoryShared');
const { shouldUseBoardFallback } = require('./SupabaseBoardRepositorySchema');

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
  const { data, error } = await repo.client
    .from(repo.tables.boards)
    .select('*')
    .order('menu_path', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('board_id', { ascending: true });

  if (error) {
    if (shouldUseBoardFallback(error)) {
      return repo.boards.map(cloneBoard);
    }
    throw createHttpError(502, `게시판 목록 조회 실패: ${error.message}`);
  }

  return mergeBoardList(repo, (data || []).map((row) => mapBoardRow(row)));
}

async function getBoard(repo, boardId) {
  const { data, error } = await repo.client
    .from(repo.tables.boards)
    .select('*')
    .eq('board_id', boardId)
    .maybeSingle();

  if (error) {
    if (shouldUseBoardFallback(error)) {
      return cloneBoard(repo.boards.find((board) => board.boardId === boardId));
    }
    throw createHttpError(502, `게시판 조회 실패: ${error.message}`);
  }

  if (data) {
    return mergeBoardDefinition(repo, mapBoardRow(data));
  }

  return cloneBoard(repo.boards.find((board) => board.boardId === boardId));
}

module.exports = {
  getBoard,
  listBoards,
  mergeBoardDefinition,
  mergeBoardList
};
