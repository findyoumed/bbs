'use strict';

const MERGED_BOARD_SOURCES = Object.freeze({
  pds: Object.freeze(['pds', 'pds_all', 'pds_util', 'pds_game', 'pds_graphic', 'pds_sound', 'pds_prog'])
});

const DEFAULT_SOURCE_BOARD_IDS = Object.freeze({
  pds: 'pds_all'
});

const VIRTUAL_BOARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    boardId: 'pds',
    name: '\uC790\uB8CC\uC2E4',
    menuPath: 'top',
    door: '6',
    accessLevel: 1,
    writeSysopOnly: false,
    replyEnabled: true,
    attachmentEnabled: false,
    headerFile: '',
    footerFile: ''
  })
]);

function normalizeBoardId(boardId) {
  return String(boardId || '').trim();
}

function getMergedBoardSourceIds(boardId) {
  const normalized = normalizeBoardId(boardId);
  const sources = MERGED_BOARD_SOURCES[normalized];
  return sources ? sources.slice() : [normalized];
}

function isVirtualBoardId(boardId) {
  return Object.prototype.hasOwnProperty.call(MERGED_BOARD_SOURCES, normalizeBoardId(boardId));
}

function resolveSourceBoardId(boardId, postBoardId = '') {
  const normalizedBoardId = normalizeBoardId(boardId);
  const normalizedPostBoardId = normalizeBoardId(postBoardId);
  const sources = MERGED_BOARD_SOURCES[normalizedBoardId];
  if (sources && sources.includes(normalizedPostBoardId)) {
    return normalizedPostBoardId;
  }
  return DEFAULT_SOURCE_BOARD_IDS[normalizedBoardId] || normalizedBoardId;
}

function getVirtualBoardDefinitions() {
  return VIRTUAL_BOARD_DEFINITIONS.map((board) => ({ ...board }));
}

module.exports = {
  getMergedBoardSourceIds,
  getVirtualBoardDefinitions,
  isVirtualBoardId,
  resolveSourceBoardId
};
