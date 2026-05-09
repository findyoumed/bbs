'use strict';

const { createBridgeError, normalizeAuthEmail } = require('./AuthBridgeUtils');

async function requestPasswordRecovery(bridge, email, options = {}) {
  if (!bridge.recoveryClient) {
    throw createBridgeError(503, '비밀번호 찾기 기능이 설정되지 않았습니다.');
  }

  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) {
    throw createBridgeError(400, '비밀번호 재설정용 이메일 주소가 필요합니다.');
  }

  const redirectTo = String(options.redirectTo || '').trim();
  const { error } = await bridge.recoveryClient.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo
  });
  if (error) {
    throwRecoveryError(error);
  }

  return { success: true, email: normalizedEmail };
}

function throwRecoveryError(error) {
  const message = String(error?.message || '').trim() || '비밀번호 재설정 메일을 전송하지 못했습니다.';
  const errorCode = String(error?.code || '').trim().toLowerCase();

  if (errorCode === 'email_address_invalid' || /email address .* is invalid/i.test(message)) {
    throw createBridgeError(400, '현재 저장된 이메일 주소는 사용할 수 없습니다. 메일을 받을 수 있는 정확한 이메일 주소로 변경해 주세요.');
  }
  if (errorCode === 'over_email_send_rate_limit' || /security purposes/i.test(message)) {
    throw createBridgeError(429, '비밀번호 재설정 메일 요청이 너무 잦습니다. 잠시 후 다시 시도해 주십시오.');
  }
  if (/redirect/i.test(message)) {
    throw createBridgeError(400, '비밀번호 재설정 이동 주소가 Supabase 허용 목록과 일치하지 않습니다.');
  }

  throw createBridgeError(502, `비밀번호 재설정 메일 전송 실패: ${message}`);
}

module.exports = {
  requestPasswordRecovery,
  throwRecoveryError
};
