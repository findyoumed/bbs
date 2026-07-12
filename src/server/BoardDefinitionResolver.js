'use strict';

const MenuResolver = require('./MenuResolver');
const { getVirtualBoardDefinitions } = require('./BoardVirtualBoards');
const logger = require('./logger');

const PLAZA_POST_HEADERS = ['\uAC00\uC785\uC778\uC0AC', '\uD6A1\uC124\uC218\uC124', '\uBB3B\uACE0\uB2F5\uD558\uAE30', '\uCEF4\uD4E8\uD130\uCD08\uBCF4\uC2DC\uC808'];

const DEFAULT_BOARDS = [
  { boardId: 'notice', name: '공지사항', menuPath: 'top', door: '1', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'welcome', name: '가입인사', menuPath: 'top', door: '2', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'membership', name: '특선회원신청', menuPath: 'top', door: '3', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'tosysop', name: '건의하기', menuPath: 'top', door: '4', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'plaza', name: '자유 게시판', menuPath: 'top', door: '51', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '', postHeaders: PLAZA_POST_HEADERS },
  { boardId: 'market', name: '장터 게시판', menuPath: 'top', door: '52', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
  { boardId: 'te99', name: '질문 게시판', menuPath: 'top', door: '53', accessLevel: 1, writeSysopOnly: false, replyEnabled: true, attachmentEnabled: false, headerFile: '', footerFile: '' },
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
