'use strict';

// [LOG_ID: 20260731_2200] ConfRepositoryMemory.js와 ConfRepositorySupabase.js가 normUserId를
// 바이트 단위로 동일하게 복제해 갖고 있었다(normText도 마찬가지였는데, 그건 이미 httpUtils.js의
// normalizeText와 완전히 같은 로직이라 그쪽으로 대체했다 — 여기 별도로 둘 필요가 없다). 다른
// 도메인(Memo/Chat/Attachment/Member/Board)의 XRepositoryShared.js 관례를 그대로 따른다.
const { createHttpError } = require('./httpUtils');

// [LOG: 20260731_1725] 사용자 ID의 안전한 대소문자 일관성 정형화 헬퍼
function normUserId(value, fallback = 'guest') {
  const s = String(value ?? '').trim().toLowerCase();
  return s || fallback;
}

module.exports = {
  createHttpError,
  normUserId
};
