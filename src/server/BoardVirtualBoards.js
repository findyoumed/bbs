'use strict';

// [LOG_ID: 20260729_0330] 두 조회표는 Object.create(null) 기반이어야 한다 — 평범한 객체
// 리터럴이면 프로토타입 체인이 Object.prototype으로 이어져, boardId가 '__proto__'/'constructor'/
// 'toString' 같은 이름일 때 MERGED_BOARD_SOURCES[normalized]가 undefined가 아니라 상속된 값
// (Object.prototype 자체나 Object 함수)을 참값으로 돌려준다. 그러면 getMergedBoardSourceIds의
// sources.slice()가 TypeError로 죽는다(실측: getMergedBoardSourceIds('constructor') →
// "sources.slice is not a function"). isVirtualBoardId만 hasOwnProperty로 막고 있어 세 함수가
// 같은 표를 서로 다르게 읽던 비대칭도 이걸로 함께 해소된다 — 쪽지 카드에서 고친
// 프로토타입 오염(LOG_ID 20260729_0105)과 동일 계열.
const MERGED_BOARD_SOURCES = Object.freeze(Object.assign(Object.create(null), {
  pds: Object.freeze(['pds', 'pds_all', 'pds_util', 'pds_game', 'pds_graphic', 'pds_sound', 'pds_prog'])
}));

const DEFAULT_SOURCE_BOARD_IDS = Object.freeze(Object.assign(Object.create(null), {
  pds: 'pds_all'
}));

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

// [LOG_ID: 20260729_0330] 가상↔물리 board_id 불일치 해설을 이 한 곳으로 모은다(종전엔
// 호출처 6곳이 "…와 동일한 이유로"로 서로를 가리키는 주석을 각자 들고 있어, 한 가지 사실을
// 알려고 주석 그래프를 순회해야 했다).
//
// PDS는 물리 게시판 7개(pds_all/pds_util/pds_game 등)를 가상 게시판 'pds' 하나로 병합해
// 보여준다. 글·첨부 행은 전부 업로드/작성 당시의 **물리** board_id로 저장되는데, 병합 화면에
// 있는 클라이언트는 **가상** id 'pds'를 보내온다. 따라서 board_id를 리터럴로 등호 비교하면
// 실제 데이터와 절대 일치하지 않는다 — 이 함수로 넓혀서 비교해야 한다.
// 실제로 이 넓히기를 빠뜨려 PDS 목록의 파일 요약이 항상 공란이었고(LOG_ID 20260728_2350),
// 목록에서 곧장 받는 DN 즉시다운로드도 항상 실패했다(LOG_ID 20260729_0215).
//
// 빈 boardId는 [](어떤 소스와도 매칭 안 됨)를 돌려준다 — 종전엔 ['']를 돌려줘서 호출처마다
// .filter(Boolean)을 덧붙여야 했고, 실제로 드라이버별로 붙은 곳과 안 붙은 곳이 갈렸다.
function getMergedBoardSourceIds(boardId) {
  const normalized = normalizeBoardId(boardId);
  const sources = MERGED_BOARD_SOURCES[normalized];
  if (sources) return sources.slice();
  return normalized ? [normalized] : [];
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
