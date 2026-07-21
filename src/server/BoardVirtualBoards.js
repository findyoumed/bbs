'use strict';

const MERGED_BOARD_SOURCES = Object.freeze({
  pds: Object.freeze(['pds', 'pds_all', 'pds_util', 'pds_game', 'pds_graphic', 'pds_sound', 'pds_prog'])
});

const DEFAULT_SOURCE_BOARD_IDS = Object.freeze({
  pds: 'pds_all'
});

// [LOG_ID: 20260721_0940] \uC774 fallback \uC815\uC758\uB294 hanulso.mnu\uC5D0 PDS\uAC00 \uC2E4\uC81C <item type="board">\uB85C
// \uBC30\uC120\uB418\uAE30 \uC804 \uC2DC\uC808\uC758 \uAC12(\uB2F5\uAE00 \uAC00\uB2A5/\uCCA8\uBD80 \uBD88\uAC00)\uC774 \uADF8\uB300\uB85C \uB0A8\uC544 \uC788\uC5C8\uB2E4. resolveBoardDefinitions()\uAC00
// DEFAULT_BOARDS \u2192 \uBA54\uB274 \u2192 \uC774 fallback \uC21C\uC73C\uB85C \uBCD1\uD569\uD558\uBA74\uC11C \uB098\uC911 \uAC12\uC774 \uD56D\uC0C1 \uC774\uAE34\uB2E4 \u2014 \uC989 \uBA54\uB274\uAC00 \uC815\uD55C
// \uC9C4\uC9DC \uAC12(<attachment>yes</attachment>, <reply>no</reply>)\uC744 \uC774 fallback\uC774 \uB9E4\uBC88 \uB36E\uC5B4\uC368,
// PDS\uC758 \uD575\uC2EC \uAE30\uB2A5\uC778 \uD30C\uC77C \uCCA8\uBD80\uAC00 "\uAC8C\uC2DC\uD310\uC5D0\uC11C \uCCA8\uBD80 \uAE30\uB2A5\uC774 \uBE44\uD65C\uC131\uD654" \uC624\uB958\uB85C \uD56D\uC0C1 \uB9C9\uD788\uACE0, \uBC18\uB300\uB85C
// \uB2F5\uAE00\uC740 \uBA54\uB274 \uC758\uB3C4(\uBE44\uD65C\uC131)\uC640 \uB2EC\uB9AC \uD56D\uC0C1 \uD5C8\uC6A9\uB418\uACE0 \uC788\uC5C8\uB2E4(\uC804 \uAC8C\uC2DC\uD310 \uAE00\uC4F0\uAE30/\uB2F5\uAE00 \uD68C\uADC0 \uC810\uAC80 \uC911 \uBC1C\uACAC).
// \uBA54\uB274 \uD30C\uC2F1\uC774 \uC2E4\uD328\uD560 \uB54C\uB9CC \uC4F0\uC774\uB294 \uCD5C\uD6C4 fallback\uC774\uBBC0\uB85C, \uC2E4\uC81C \uBA54\uB274 \uAC12\uACFC \uB3D9\uC77C\uD558\uAC8C \uB9DE\uCD98\uB2E4.
const VIRTUAL_BOARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    boardId: 'pds',
    name: '\uC790\uB8CC\uC2E4 (PDS)',
    menuPath: 'top',
    door: '8',
    accessLevel: 1,
    writeSysopOnly: false,
    replyEnabled: false,
    attachmentEnabled: true,
    headerFile: '',
    footerFile: 'txt/cmd_board_footer.txt'
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
