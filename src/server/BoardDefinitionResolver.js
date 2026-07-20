'use strict';

const MenuResolver = require('./MenuResolver');
const { getVirtualBoardDefinitions } = require('./BoardVirtualBoards');
const logger = require('./logger');

const PLAZA_POST_HEADERS = ['\uAC00\uC785\uC778\uC0AC', '\uD6A1\uC124\uC218\uC124', '\uBB3B\uACE0\uB2F5\uD558\uAE30', '\uCEF4\uD4E8\uD130\uCD08\uBCF4\uC2DC\uC808'];

// [LOG_ID: 20260720_2205] welcome/membership/market/te99는 지금의 hanulso.mnu 기반 메뉴
// 시스템 이전의 레거시 하드코딩 잔재였다 — 현재 메뉴 어디에도 연결되지 않고(door 2/3/52/53는
// 옛 TOP 번호 체계), Supabase boards 테이블에도 레코드가 없으며, 시드 콘텐츠도 전혀 없었다
// ("실제로 있는 메뉴만 보여줘" 검토 중 사용자 지적으로 발견, 완전한 죽은 코드라 삭제).
const DEFAULT_BOARDS = [
  { boardId: 'notice', name: '공지사항', menuPath: 'top', door: '1', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'tosysop', name: '건의하기', menuPath: 'top', door: '4', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'plaza', name: '자유 게시판', menuPath: 'top', door: '51', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '', postHeaders: PLAZA_POST_HEADERS },
  { boardId: 'humor', name: '유머', menuPath: 'top', door: '54', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' }
];

function mergeBoardDefinitions(...groups) {
  const merged = new Map();
  for (const group of groups) {
    for (const board of group || []) {
      if (!board?.boardId) continue;
      const current = merged.get(board.boardId) || {};
      merged.set(board.boardId, { ...current, ...board, boardId: board.boardId });
    }
  }
  return Array.from(merged.values());
}

function boolFromLegacy(value, trueValues) {
  return trueValues.includes(String(value || '').trim().toLowerCase());
}

function collectBoardsFromMenu(node, currentMenuPath, out) {
  for (const child of node?.children || []) {
    if (child.type === 'board' || child.type === 'weather' || child.type === 'news') {
      const boardId = child.go || child.id;
      if (!boardId) continue;
      out.push({
        boardId,
        boardType: child.type, // 타입 정보를 보관하여 프런트에서 식별할 수 있도록 함
        name: child.name || boardId,
        menuPath: currentMenuPath || 'top',
        door: String(child.door || ''),
        accessLevel: Number(child.accessLevel || 1),
        writeSysopOnly: boolFromLegacy(child.writeSysopOnly, ['yes', 'true', '1']),
        replyEnabled: !boolFromLegacy(child.reply, ['no', 'false', '0']),
        attachmentEnabled: boolFromLegacy(child.attachment, ['yes', 'true', '1']),
        headerFile: child.header || '',
        footerFile: child.footer || ''
      });
      continue;
    }

    if (child.type === 'menu') {
      collectBoardsFromMenu(child, child.go || child.id || currentMenuPath, out);
    }
  }
}

function resolveBoardsFromMenuFile(menuFilePath) {
  if (!menuFilePath) return [];

  try {
    const menuResolver = new MenuResolver(menuFilePath);
    const tree = menuResolver.getTree();
    const boards = [];
    collectBoardsFromMenu(tree, tree.go || 'top', boards);
    return boards;
  } catch (error) {
    logger.warn('failed to load boards from menu', { component: 'BoardDefinitionResolver', error: error.message });
    return [];
  }
}

function resolveBoardDefinitions(menuFilePath) {
  return mergeBoardDefinitions(
    DEFAULT_BOARDS,
    resolveBoardsFromMenuFile(menuFilePath),
    getVirtualBoardDefinitions()
  );
}

module.exports = {
  DEFAULT_BOARDS,
  mergeBoardDefinitions,
  resolveBoardsFromMenuFile,
  resolveBoardDefinitions
};
