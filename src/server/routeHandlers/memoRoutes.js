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
  // (원전의 "그룹지정"=이름 붙인 수신자 그룹 저장은 별도 테이블이 필요해 구현하지 않았다.)
  // [LOG_ID: 20260728_1751] 단체편지 및 쪽지 발송 전 수신자가 실제로 가입된 회원인지 전수 사전 유효성 검사 추가
  async createMemo() {
    const { memoRepository, memberRepository } = this.deps;
    const body = await this.getCreateMemoBody();
    const context = await this.getContext();

    const recipients = parseRecipients(body.recipientUserId);
    if (!recipients.length) {
      this.validationError('body parameter "recipientUserId" is required.');
    }
    if (recipients.length > MEMO_MAX_RECIPIENTS) {
      this.validationError(`단체편지는 한 번에 최대 ${MEMO_MAX_RECIPIENTS}명까지 보낼 수 있습니다.`);
    }

    // [LOG_ID: 20260731_1445] 수신자 회원 정보 사전 검증 및 Map 캐싱 — 발송 루프에서의 중복 DB 조회를 제거한다.
    const recipientMembersMap = new Map();
    if (memberRepository) {
      for (const recipientUserId of recipients) {
        const recipientMember = await memberRepository.getMember(recipientUserId);
        if (!recipientMember) {
          this.validationError(`존재하지 않는 회원 아이디입니다: ${recipientUserId}`);
        }
        recipientMembersMap.set(recipientUserId, recipientMember);
      }
    }

    // [LOG_ID: 20260722_3000] global.absentMessages(프로세스 메모리 Map — 서버 재시작/서버리스
    // 인스턴스 교체마다 소실되던 것)를 대신해 members 테이블에 영속 저장된 부재통지를 조회한다.
    const results = [];
    const absentRecipients = [];
    for (const recipientUserId of recipients) {
      const created = await memoRepository.createMemo({ ...body, recipientUserId }, context);
      results.push(created);
      const recipientMember = recipientMembersMap.get(recipientUserId) || null;
      if (isMemberAbsentNow(recipientMember)) {
        absentRecipients.push({
          userId: recipientUserId,
          absentMsg: recipientMember.absentReason
        });
      }
    }

    // 수신자 1명이면 종전 응답 형태(쪽지 객체 + recipientAbsent/absentMsg)를 그대로 유지한다 —
    // 기존 클라이언트/스모크 테스트가 이 형태에 의존한다.
    const first = absentRecipients[0] || null;
    return this.send(201, {
      ...results[0],
      recipientAbsent: Boolean(first),
      absentMsg: first ? first.absentMsg : null,
      // 단체편지용 추가 필드 (수신자 1명일 때도 채워지므로 클라이언트가 일관되게 읽을 수 있다)
      recipients,
      sentCount: results.length,
      absentRecipients
    });
  }

  async getMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.getMemo(memoId, context));
  }

  // [LOG_ID: 20260716_1800] 하이텔 (10)-5 편지보관함(mbox) — body.archived(기본 true)로 보관/해제.
  async archiveMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const body = await this.getBody();
    const archived = body && body.archived === false ? false : true;
    const context = await this.getContext();
    return this.send(200, await memoRepository.setArchived(memoId, archived, context));
  }

  async markMemoRead(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.markRead(memoId, context));
  }

  async deleteMemo(params) {
    const { memoRepository } = this.deps;
    const memoId = Number(params.memoId);
    if (isNaN(memoId)) this.error(400, 'Invalid memo ID');
    const context = await this.getContext();
    return this.send(200, await memoRepository.deleteMemo(memoId, context));
  }
}

async function handleMemoRoutes(deps) {
  const router = new MemoRouter(deps);
  return await router.handle();
}

module.exports = handleMemoRoutes;
