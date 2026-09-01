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
// [LOG_ID: 20260901_0635] 서버 저장소의 Supabase 설정은 service-role 키가 있을 때만 유효하다.
function hasSupabaseConfig(env = {}) {
  // Server repositories perform privileged reads/writes and must never use
  // publishable/anon credentials. Those keys are reserved for AuthBridge's
  // browser client; using them here causes RLS-denied requests to surface as
  // opaque 5xx responses in production.
  return Boolean(env.SUPABASE_URL && hasUsableServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY));
}

// Supabase's browser credentials use explicit sb_publishable_/sb_anon_ prefixes
// (legacy anon JWTs are also commonly stored in this variable). Reject those
// when they are accidentally copied into the server-only service-role slot.
function hasUsableServiceRoleKey(value) {
  const key = String(value || '').trim();
  if (!key) return false;
  if (/^(sb_(publishable|anon)_|anon_)/i.test(key)) return false;

  // Legacy Supabase keys are JWTs. Decode only the non-sensitive role claim;
  // never log or return the token/payload. Anon and authenticated JWTs are
  // client credentials, while service_role JWTs remain valid here.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload?.role === 'anon' || payload?.role === 'authenticated') return false;
    } catch {
      // Let Supabase report malformed/unknown credentials at connection time.
    }
  }
  return true;
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
  hasUsableServiceRoleKey,
  normalizeDriverName,
  shouldUseSupabaseDriver
};
