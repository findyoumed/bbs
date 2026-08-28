'use strict';

const BaseRouter = require('./BaseRouter');

// [LOG_ID: 20260828_1630] GUIDE '건의하기' stores a durable internal memo
// before attempting optional external email delivery.
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

    // [LOG_ID: 20260828_1630] Internal memo persistence is authoritative;
    // external Resend delivery is best-effort and must not discard the memo.
    let result = null;
    let emailDeliveryWarning = null;
    if (!mailService || typeof mailService.sendToSysop !== 'function') {
      emailDeliveryWarning = 'External email service is not configured.';
    } else {
      try {
        result = await mailService.sendToSysop({
          subject: body.subject,
          content: body.content,
          fromUserId: context.userId
        });
      } catch (error) {
        // The internal memo is already durable; do not turn a Resend outage
        // into a failed suggestion submission. Keep details in server logs.
        emailDeliveryWarning = 'External email delivery failed.';
        console.warn('[ContactSysop] Internal memo saved but external email failed:', error?.message || error);
      }
    }

    return this.send(200, {
      ...(result || {}),
      memoId: internalMemo?.id || null,
      internalMemoSaved: Boolean(internalMemo?.id),
      emailSent: Boolean(result?.id),
      emailDeliveryWarning
    });
  }
}

async function handleContactRoutes(deps) {
  const router = new ContactRouter(deps);
  return await router.handle();
}

module.exports = handleContactRoutes;
