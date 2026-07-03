'use strict';

const fs = require('fs');
const path = require('path');

const codePath = path.resolve(__dirname, '../../../../public/js/core/boardService.js');
const code = fs.readFileSync(codePath, 'utf8')
  .replace('export function createBoardService', 'function createBoardService');

const mockContext = {
  createBoardService: null
};

// [LOG: 20260425_2358] boardService ESM을 CommonJS 단위 테스트에서 직접 검증한다.
eval(code + '; mockContext.createBoardService = createBoardService;');

const { createBoardService } = mockContext;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
  }
}

module.exports = (async () => {
  console.log('Running boardService tests...');

  const fetchedBoards = [
    { id: 'free', boardId: 'free', door: '10', name: '자유게시판 (FREE)', go: 'free', menuPath: 'top/community' },
    { id: 'qa', boardId: 'qa', door: '20', name: '질문 답변', go: 'ASK' },
    { id: 'gallery', boardId: 'gallery', door: '30', name: '사진 자료실' },
    { id: 'notice', boardId: 'notice', door: '40', name: '공지 사항 (NOTICE)', menuPath: '   ' }
  ];
  let apiFetchCalls = 0;
  const state = { boards: [] };
  const service = createBoardService({
    apiFetch: async (path) => {
      apiFetchCalls += 1;
      assertEqual(path, '/api/boards', 'loadBoards should request the board list endpoint');
      return { boards: fetchedBoards };
    },
    state
  });

  await service.loadBoards();
  assertEqual(apiFetchCalls, 1, 'loadBoards should fetch once when state is empty');
  assertEqual(state.boards.length, 4, 'loadBoards should populate the board list');

  await service.loadBoards();
  assertEqual(apiFetchCalls, 1, 'loadBoards should not refetch when boards are already loaded');

  assertEqual(service.getBoardKey(fetchedBoards[0]), 'free', 'getBoardKey should prefer boardId');
  assertEqual(service.getBoardDoor(fetchedBoards[0]), '10', 'getBoardDoor should return the board door');
  assertEqual(service.getBoardDisplayName(fetchedBoards[0]), '자유게시판', 'display names should strip alias suffixes');
  assertEqual(service.getBoardCode(fetchedBoards[0]), 'FREE', 'getBoardCode should use go aliases in uppercase');
  assertEqual(service.getBoardCode(fetchedBoards[2]), 'GALLERY', 'getBoardCode should fall back to board keys');
  assertEqual(service.getBoardCode(fetchedBoards[3]), 'NOTICE', 'getBoardCode should extract aliases from board names when go is missing');
  assertEqual(service.getBoardMenuPath(fetchedBoards[0]), 'top/community', 'explicit menu paths should be preserved');
  assertEqual(service.getBoardMenuPath(fetchedBoards[1]), 'top', 'missing menu paths should default to top');
  assertEqual(service.getBoardMenuPath(fetchedBoards[3]), 'top', 'blank menu paths should also default to top');

  assertEqual(service.normalizeSearchKey(' 자유 게시판 '), '자유게시판', 'normalizeSearchKey should trim spaces');
  assertEqual(service.findBoardByKey('qa')?.id, 'qa', 'findBoardByKey should match board IDs');
  assertEqual(service.findBoardByDoor('20')?.id, 'qa', 'findBoardByDoor should match board doors');
  assertEqual(service.findBoardByCode(' free ')?.id, 'free', 'findBoardByCode should match aliases case-insensitively');
  assertEqual(service.findBoardByCode('30')?.id, 'gallery', 'findBoardByCode should match door numbers');
  assertEqual(service.findBoardByCode('질문 답변')?.id, 'qa', 'findBoardByCode should match display names');
  assertEqual(service.findBoardByCode('notice')?.id, 'notice', 'findBoardByCode should match aliases extracted from board names');
  assertEqual(service.findBoardByCode('missing'), null, 'findBoardByCode should return null for unknown values');

  assert(service.compareDoor('10', '20') < 0, 'compareDoor should sort smaller door numbers first');
  assert(service.compareDoor('30', '20') > 0, 'compareDoor should sort larger door numbers last');
  assertEqual(service.compareDoor('', ''), 0, 'compareDoor should safely handle empty values');

  let arrayFetchCalls = 0;
  const directArrayService = createBoardService({
    apiFetch: async () => {
      arrayFetchCalls += 1;
      return fetchedBoards;
    }
  });
  await directArrayService.loadBoards();
  assertEqual(arrayFetchCalls, 1, 'loadBoards should also accept direct array responses');
  assertEqual(directArrayService.findBoardByCode('NOTICE')?.id, 'notice', 'services without explicit state should still expose loaded boards');

  console.log('boardService tests passed!');
})();
