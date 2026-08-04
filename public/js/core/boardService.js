function createEmptyBoardIndexes() {
  return {
    byCode: new Map(),
    byDoor: new Map(),
    byKey: new Map()
  };
}

export function createBoardService(deps = {}) {
  const apiFetch = deps.apiFetch;
  const state = deps.state || { boards: [] };
  let cachedBoardsRef = null;
  let cachedBoardCount = -1;
  let boardIndexes = createEmptyBoardIndexes();

  function getBoards() {
    return Array.isArray(state.boards) ? state.boards : [];
  }

  function resetBoardIndexes() {
    cachedBoardsRef = null;
    cachedBoardCount = -1;
    boardIndexes = createEmptyBoardIndexes();
  }

  function hydrateBoards(data) {
    // [LOG_ID: 20260804_1114] Main bootstrap can seed the same board state used by
    // the standalone loader without issuing a second request.
    state.boards = Array.isArray(data) ? data : (data?.boards || []);
    resetBoardIndexes();
    return state.boards;
  }

  async function loadBoards() {
    if (getBoards().length > 0) return;
    const data = await apiFetch('/api/boards');
    hydrateBoards(data);
  }

  function getBoardKey(board) {
    return String(board?.boardId || board?.id || '').trim();
  }

  function getBoardDoor(board) {
    return String(board?.door || '').trim();
  }

  function findBoardByKey(boardId) {
    const key = String(boardId || '').trim();
    if (!key) return null;
    const byKey = ensureBoardIndexes().byKey;
    if (byKey.has(key)) return byKey.get(key);

    // [LOG_ID: 20260717_1925] URL 대문자 복원을 위해 대소문자 구분 없는 탐색 폴백 지원
    const lowerKey = key.toLowerCase();
    for (const [k, v] of byKey.entries()) {
      if (k.toLowerCase() === lowerKey) return v;
    }
    return null;
  }

  function findBoardByDoor(door) {
    const key = String(door || '').trim();
    if (!key) return null;
    return ensureBoardIndexes().byDoor.get(key) || null;
  }

  function splitBoardNameParts(board) {
    const source = String(board?.name || '').trim();
    const match = source.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
    const displayName = String(match?.[1] || source || '').trim() || source || '게시판';
    const alias = String(board?.go || match?.[2] || '').trim();
    return {
      displayName,
      alias: alias ? alias.toUpperCase() : '',
    };
  }

  function getBoardDisplayName(board) {
    return splitBoardNameParts(board).displayName;
  }

  function getBoardCode(board) {
    const parts = splitBoardNameParts(board);
    return parts.alias || String(getBoardKey(board) || '').trim().toUpperCase();
  }

  function getBoardMenuPath(board) {
    return String(board?.menuPath || 'top').trim() || 'top';
  }

  function normalizeSearchKey(value) {
    return String(value || '')
      .replace(/\s+/g, '')
      .trim()
      .toUpperCase();
  }

  function compareDoor(left, right) {
    return Number(String(left || '').trim() || 0) - Number(String(right || '').trim() || 0);
  }

  function rememberBoardIndex(map, key, board) {
    if (!key || map.has(key)) return;
    map.set(key, board);
  }

  function ensureBoardIndexes() {
    const boards = getBoards();
    if (cachedBoardsRef === boards && cachedBoardCount === boards.length) {
      return boardIndexes;
    }

    const nextIndexes = createEmptyBoardIndexes();

    // [LOG: 20260425_2021] 게시판 검색은 반복 호출되므로 현재 목록 기준 조회 인덱스를 한 번만 구성한다.
    boards.forEach((board) => {
      rememberBoardIndex(nextIndexes.byKey, getBoardKey(board), board);
      rememberBoardIndex(nextIndexes.byDoor, getBoardDoor(board), board);
      rememberBoardIndex(nextIndexes.byCode, normalizeSearchKey(getBoardKey(board)), board);
      rememberBoardIndex(nextIndexes.byCode, normalizeSearchKey(getBoardDoor(board)), board);
      rememberBoardIndex(nextIndexes.byCode, normalizeSearchKey(getBoardCode(board)), board);
      rememberBoardIndex(nextIndexes.byCode, normalizeSearchKey(getBoardDisplayName(board)), board);
    });

    cachedBoardsRef = boards;
    cachedBoardCount = boards.length;
    boardIndexes = nextIndexes;
    return boardIndexes;
  }

  function findBoardByCode(code) {
    const key = normalizeSearchKey(code);
    if (!key) return null;
    return ensureBoardIndexes().byCode.get(key) || null;
  }

  return {
    compareDoor,
    findBoardByCode,
    findBoardByDoor,
    findBoardByKey,
    getBoardCode,
    getBoardDisplayName,
    getBoardDoor,
    getBoardKey,
    getBoardMenuPath,
    hydrateBoards,
    loadBoards,
    normalizeSearchKey
  };
}
