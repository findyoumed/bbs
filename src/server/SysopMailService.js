'use strict';

const { Resend } = require('resend');
const { createHttpError } = require('./httpUtils');

// [LOG_ID: 20260720_2300] GUIDE '건의하기'를 시삽 이메일 발송으로 바꾸면서 추가.
// Resend API로 postnews@daum.net에 건의 내용을 전달한다.
class SysopMailService {
  constructor({ apiKey, sysopEmail, fromEmail } = {}) {
    this.enabled = Boolean(apiKey && sysopEmail);
    this.sysopEmail = sysopEmail || '';
    this.fromEmail = fromEmail || 'onboarding@resend.dev';
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async sendToSysop({ subject, content, fromUserId }) {
    if (!this.enabled || !this.client) {
      throw createHttpError(503, '이메일 발송 기능이 설정되어 있지 않습니다.');
    }

    const safeSubject = String(subject || '').trim().slice(0, 200) || '(제목 없음)';
    const safeContent = String(content || '').trim();
    const safeUserId = String(fromUserId || 'guest').trim();

    if (!safeContent) {
      throw createHttpError(400, '내용을 입력해주세요.');
    }

    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to: this.sysopEmail,
      subject: `[01410 건의하기] ${safeSubject}`,
      text: `보낸 사람: ${safeUserId}\n\n${safeContent}`
    });

    if (error) {
      const errorMessage = typeof error === 'string'
        ? error
        : (error?.message || JSON.stringify(error));
      throw createHttpError(502, `이메일 발송 실패: ${errorMessage}`);
    }

    return { id: data?.id || null };
  }

  // [LOG_ID: 20260807_1435] 듀얼 메일/쪽지 시스템용 외부 인터넷 이메일 발송 메서드
  async sendExternalEmail({ to, subject, content, fromUserId }) {
    const safeTo = String(to || '').trim().toLowerCase();
    const safeSubject = String(subject || '').trim().slice(0, 200) || '(제목 없음)';
    const safeContent = String(content || '').trim();
    const safeUserId = String(fromUserId || 'guest').trim();

    if (!safeTo || !safeTo.includes('@')) {
      throw createHttpError(400, '올바른 이메일 주소를 입력해주세요.');
    }
    if (!safeContent) {
      throw createHttpError(400, '내용을 입력해주세요.');
    }

    if (!this.enabled || !this.client) {
      // API 키가 미설정된 테스트/로컬 환경에서는 시뮬레이션 성공 반환
      console.log(`[MailSimulate] External email to ${safeTo} from ${safeUserId}: ${safeSubject}`);
      return { id: `sim_${Date.now()}`, simulated: true };
    }

    const { data, error } = await this.client.emails.send({
      from: this.fromEmail,
      to: safeTo,
      subject: `[01410 PC통신] ${safeSubject}`,
      text: `발신자: ${safeUserId}\n\n${safeContent}`
    });

    if (error) {
      const errorMessage = typeof error === 'string'
        ? error
        : (error?.message || JSON.stringify(error));
      throw createHttpError(502, `이메일 발송 실패: ${errorMessage}`);
    }

    return { id: data?.id || null };
  }
}

function createSysopMailServiceFromEnv(env = process.env) {
  return new SysopMailService({
    apiKey: env.RESEND_API_KEY,
    sysopEmail: env.SYSOP_EMAIL,
    fromEmail: env.SYSOP_MAIL_FROM
  });
}

module.exports = {
  SysopMailService,
  createSysopMailServiceFromEnv
};
