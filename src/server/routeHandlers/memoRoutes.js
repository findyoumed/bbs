'use strict';

const BaseRouter = require('./BaseRouter');
const { parseRecipients } = require('../MemoRepositoryShared');
const { isMemberAbsentNow } = require('../MemberRepositoryShared');

// [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — 한 번에 보낼 수 있는 수신자 수 상한.
// 상한이 없으면 쪽지 한 통 요청으로 임의 개수의 행을 만들 수 있다.
const MEMO_MAX_RECIPIENTS = 20;

/**
 * [LOG: 20260426_1900] Modularized MemoRoutes from MemberRouter (Evolution Mode: Structural Optimization)
 */
class MemoRouter extends BaseRouter {
  get routes() {
    return [
      { method: 'GET', pattern: '/api/memos', handler: 'listMemos', middlewares: ['ensureAuthenticated'] },
      { method: 'GET', pattern: '/api/memos/unread/count', handler: 'unreadMemoCount', middlewares: ['ensureAuthenticated'] },
      { 
        method: 'POST', 
        pattern: '/api/memos', 
        handler: 'createMemo', 
        middlewares: ['ensureAuthenticated'],
        needBody: true
      },
      { method: 'GET', pattern: '/api/memos/:memoId', handler: 'getMemo', middlewares: ['ensureAuthenticated'] },
      { method: 'POST', pattern: '/api/memos/:memoId/read', handler: 'markMemoRead', middlewares: ['ensureAuthenticated'] },
      { method: 'PATCH', pattern: '/api/memos/:memoId/read', handler: 'markMemoRead', middlewares: ['ensureAuthenticated'] },
      // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — 보관/보관해제.
      { method: 'POST', pattern: '/api/memos/:memoId/archive', handler: 'archiveMemo', middlewares: ['ensureAuthenticated'], needBody: true },
      { method: 'DELETE', pattern: '/api/memos/:memoId', handler: 'deleteMemo', middlewares: ['ensureAuthenticated'] }
    ];
  }

  async listMemos() {
    const { memoRepository } = this.deps;
    const context = await this.getContext();
    // [LOG_ID: 20260713_1000] box 쿼리 파라미터(inbox / sent)를 읽어 레포지토리에 전달
    const box = this.requestUrl.searchParams.get('box') || 'inbox';
    return this.send(200, await memoRepository.listForUser({ ...context, box }));
  }

  async unreadMemoCount() {
    const { memoRepository } = this.deps;
    const context = await this.getContext();
    return this.send(200, await memoRepository.countUnread(context));
  }

  // [LOG: 20260428_2339] Browser memo compose sends recipientUserId/title, while
  // older clients may still send to/subject. Normalize both after auth middleware.
  async getCreateMemoBody() {
    const body = await this.getBody();
    const payload = body && typeof body === 'object' ? body : {};
    const recipientUserId = typeof payload.recipientUserId === 'string'
      ? payload.recipientUserId
      : (typeof payload.to === 'string'
        ? payload.to
        : (typeof payload.recipient === 'string' ? payload.recipient : ''));
    const title = typeof payload.title === 'string'
      ? payload.title
      : (typeof payload.subject === 'string' ? payload.subject : '');
    const content = typeof payload.content === 'string' ? payload.content : '';

    if (!recipientUserId.trim()) {
      this.validationError('body parameter "recipientUserId" is required.');
    }

    if (!title.trim()) {
      this.validationError('body parameter "title" is required.');
    }

    if (title.length > 200) {
      this.validationError('body parameter "title" must be no more than 200 characters.');
    }

    if (!content.trim()) {
      this.validationError('body parameter "content" is required.');
    }

    return {
      ...payload,
      recipientUserId,
      title,
      content
    };
  }

  // [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — 받는 사람을 쉼표/공백으로 여러 명 적으면
  // 수신자 수만큼 쪽지를 만든다. 쪽지 1건 = 1행이라 스키마 변경 없이 된다.
  // [LOG_ID: 20260716_2000] 하이텔 (10)-6 단체편지 — 받는 사람을 쉼표/공백으로 여러 명 적으면
  // 수신자 수만큼 쪽지를 만든다. 쪽지 1건 = 1행이라 스키마 변경 없이 된다.
  // [LOG_ID: 20260807_1435] 듀얼 발송 시스템: 이메일 형태(@)와 BBS 회원 아이디 분기 처리
  async createMemo() {
    const { memoRepository, memberRepository, mailService } = this.deps;
    const body = await this.getCreateMemoBody();
    const context = await this.getContext();

    const rawRecipients = parseRecipients(body.recipientUserId);
    const recipients = rawRecipients.map(r => String(r || '').trim().toLowerCase()).filter(Boolean);
    if (!recipients.length) {
      this.validationError('body parameter "recipientUserId" is required.');
    }
    if (recipients.length > MEMO_MAX_RECIPIENTS) {
      this.validationError(`단체편지는 한 번에 최대 ${MEMO_MAX_RECIPIENTS}명까지 보낼 수 있습니다.`);
    }

    const isEmailFormat = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    const emailRecipients = recipients.filter(isEmailFormat);
    const memberRecipients = recipients.filter(r => !isEmailFormat(r));

    // BBS 회원 수신자 사전 검증
    const recipientMembersMap = new Map();
    if (memberRepository) {
      for (const recipientUserId of memberRecipients) {
        const recipientMember = await memberRepository.getMember(recipientUserId);
        if (!recipientMember) {
          this.validationError(`존재하지 않는 회원 아이디입니다: ${recipientUserId}`);
        }
        recipientMembersMap.set(recipientUserId, recipientMember);
      }
    }

    const results = [];
    const absentRecipients = [];

    // 1) BBS 회원 수신자 처리 (내부 쪽지함 DB 저장 + 회원 가입 이메일로 동시 알림 전송)
    for (const recipientUserId of memberRecipients) {
      const created = await memoRepository.createMemo({ ...body, recipientUserId }, context);
      results.push(created);
      const recipientMember = recipientMembersMap.get(recipientUserId) || null;
      if (isMemberAbsentNow(recipientMember)) {
        absentRecipients.push({
          userId: recipientUserId,
          absentMsg: recipientMember.absentReason
        });
      }

      // [LOG_ID: 20260807_1436] 회원 가입 시 등록된 이메일이 있을 경우 외부 메일로도 동시 알림 전송!
      if (recipientMember?.email && mailService && typeof mailService.sendExternalEmail === 'function') {
        try {
          await mailService.sendExternalEmail({
            to: recipientMember.email,
            subject: body.title || `[01410 PC통신] ${context.userId}님이 보낸 쪽지/편지`,
            content: body.content,
            fromUserId: context.userId
          });
        } catch (mailErr) {
          console.warn(`[MemberEmailNotice] Failed to send email to ${recipientMember.email}:`, mailErr.message);
        }
      }
    }

    // 2) 외부 이메일 수신자 처리 (Resend 외부 메일 전송 + 기록 저장)
    for (const emailAddr of emailRecipients) {
      if (mailService && typeof mailService.sendExternalEmail === 'function') {
        await mailService.sendExternalEmail({
          to: emailAddr,
          subject: body.title,
          content: body.content,
          fromUserId: context.userId
        });
      }
      const createdLog = await memoRepository.createMemo({ ...body, recipientUserId: emailAddr }, context);
      results.push(createdLog);
    }

    const first = absentRecipients[0] || null;
    return this.send(201, {
      ...(results[0] || {}),
      recipientAbsent: Boolean(first),
      absentMsg: first ? first.absentMsg : null,
      recipients,
      sentCount: results.length,
      emailSentCount: emailRecipients.length,
      absentRecipients
    });
  }

  _parseMemoId(params) {
    return this.parsePositiveIntParam(params?.memoId, '유효하지 않은 쪽지 번호입니다.');
  }

  async getMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = this._parseMemoId(params);
    const context = await this.getContext();
    return this.send(200, await memoRepository.getMemo(memoId, context));
  }

  // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — body.archived(기본 true)로 보관/해제.
  async archiveMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = this._parseMemoId(params);
    const body = await this.getBody();
    const archived = body && body.archived === false ? false : true;
    const context = await this.getContext();
    return this.send(200, await memoRepository.setArchived(memoId, archived, context));
  }

  async markMemoRead(params) {
    const { memoRepository } = this.deps;
    const memoId = this._parseMemoId(params);
    const context = await this.getContext();
    return this.send(200, await memoRepository.markRead(memoId, context));
  }

  async deleteMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = this._parseMemoId(params);
    const context = await this.getContext();
    return this.send(200, await memoRepository.deleteMemo(memoId, context));
  }
}

async function handleMemoRoutes(deps) {
  const router = new MemoRouter(deps);
  return await router.handle();
}

module.exports = handleMemoRoutes;
