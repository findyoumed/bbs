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
      throw createHttpError(502, `이메일 발송 실패: ${error.message || error}`);
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
