'use strict';

// [LOG_ID: 20260730_0710] 저장소 드라이버(Supabase vs Memory/Local) 선택 판정식이 7개 파일
// (BoardRepository/MemberRepository/MemoRepository/ChatRoomRepository/VoteRepository/
// ConfRepository/AttachmentRepository)에 문자 그대로 복제돼 있었다 — 앱 전체가 실제 DB로
// 붙을지 휘발성 메모리로 떨어질지를 정하는 가장 근본적인 판정인데도, 정책을 바꾸려면 7곳을
// 손으로 맞춰야 했고 하나만 빠뜨려도 아무것도 실패하지 않아 조용히 갈렸다(이번 세션에서
// 이미 같은 계열 결함을 여러 번 발견했다: resolveTrustedVirtualBoardId 2벌 복제,
// isPdsBoard의 startsWith('pds_') 재정의 등 — 여기가 그중 가장 blast radius가 크다).
//
// 판정 자체("supabase가 명시됐거나, 명시가 없고 설정이 갖춰져 있으면 supabase")만 이 모듈이
// 소유한다. 어느 env 변수 이름을 볼지(BOARD_REPOSITORY_DRIVER 단독인지, CHAT_ROOM_REPOSITORY_
// DRIVER를 우선하고 BOARD_REPOSITORY_DRIVER로 폴백하는지 등)는 도메인마다 실제로 다르므로
// 호출부에 남겨둔다 — 그 차이는 버그가 아니라 의도된 도메인별 오버라이드다.
function hasSupabaseConfig(env = {}) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeDriverName(value) {
  return String(value || '').trim().toLowerCase();
}

function shouldUseSupabaseDriver(requestedDriver, hasSupabase) {
  const normalized = normalizeDriverName(requestedDriver);
  return (normalized === 'supabase' || (!normalized && hasSupabase)) && hasSupabase;
}

module.exports = {
  hasSupabaseConfig,
  normalizeDriverName,
  shouldUseSupabaseDriver
};
