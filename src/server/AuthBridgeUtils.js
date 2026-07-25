'use strict';

function createBridgeError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// [LOG_ID: 20260725_2100] 전수검사 재확인 중 재현: 인증된 비밀번호 변경(및 다른 auth.admin.*
// 호출)이 로컬에서도 5회 중 2~3회꼴로 502 "invalid JWT: unrecognized JWT kid ... for algorithm
// ES256"를 냈다 — 같은 서비스 롤 키로 만든 같은 클라이언트 인스턴스인데도 재시도하면 대부분
// 바로 성공해, Supabase GoTrue 쪽 JWKS 조회의 일시적 지연/캐시 미스로 보인다(요청 자체는
// 정상). 이전 세션에서는 "재현 불가, 일시 오류"로 넘겼지만 실제로는 매번 재현되는 빈도 높은
// 결함이었다 — 실사용자의 비밀번호/이메일 변경·탈퇴가 그만큼 자주 실패했을 것. 짧은 지연을 둔
// 재시도로 완화한다(영구 실패는 그대로 502로 표면화됨 — 숨기지 않음).
function isTransientAuthAdminError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unrecognized jwt kid') || message.includes('invalid jwt');
}

async function withAuthAdminRetry(fn, { retries = 2, delayMs = 250 } = {}) {
  let result;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    result = await fn();
    if (!result?.error || !isTransientAuthAdminError(result.error) || attempt === retries) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
  }
  return result;
}

module.exports = {
  createBridgeError,
  normalizeAuthEmail,
  isTransientAuthAdminError,
  withAuthAdminRetry
};
