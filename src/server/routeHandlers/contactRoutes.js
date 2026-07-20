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
        needBody: true
      }
    ];
  }

  async sendToSysop() {
    const { mailService } = this.deps;
    const body = await this.getBody() || {};
    const context = await this.getContext();

    const result = await mailService.sendToSysop({
      subject: body.subject,
      content: body.content,
      fromUserId: context.userId
    });

    return this.send(200, result);
  }
}

async function handleContactRoutes(deps) {
  const router = new ContactRouter(deps);
  return await router.handle();
}

module.exports = handleContactRoutes;
