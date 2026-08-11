'use strict';

const BaseRouter = require('./BaseRouter');

// [LOG_ID: 20260720_2300] GUIDE '건의하기' — 게시판 대신 시삽에게 이메일을 발송한다.
class ContactRouter extends BaseRouter {
  get routes() {
    return [
      {
        method: 'POST',
        pattern: '/api/contact-sysop',
        handler: 'sendToSysop',
        middlewares: ['ensureAuthenticated'],
        needBody: true,
        validate: {
          body: {
            subject: { required: true, maxLength: 200 },
            content: { required: true }
          }
        }
      }
    ];
  }

  async sendToSysop() {
    const { mailService, memoRepository } = this.deps;
    if (!mailService || typeof mailService.sendToSysop !== 'function') {
      this.error(503, '이메일 발송 서비스가 준비되지 않았습니다.');
    }

    if (!memoRepository || typeof memoRepository.createMemo !== 'function') {
      this.error(503, 'Sysop memo storage is not configured.');
    }

    const body = await this.getBody() || {};
    const context = await this.getContext();

    // [LOG_ID: 20260811_1300] Keep a copy in the sysop user's internal inbox
    // as well as sending the existing external Resend email. Do not create a
    // sender-side copy because this is a one-way sysop suggestion flow.
    const internalMemo = await memoRepository.createMemo({
      recipientUserId: 'sysop',
      title: `[건의하기] ${body.subject}`,
      content: body.content,
      saveToSent: false
    }, context);

    const result = await mailService.sendToSysop({
      subject: body.subject,
      content: body.content,
      fromUserId: context.userId
    });

    return this.send(200, {
      ...result,
      memoId: internalMemo?.id || null,
      internalMemoSaved: Boolean(internalMemo?.id)
    });
  }
}

async function handleContactRoutes(deps) {
  const router = new ContactRouter(deps);
  return await router.handle();
}

module.exports = handleContactRoutes;
