'use strict';

const { eventBus, Events } = require('../EventBus');
const mutation = require('../SupabaseBoardRepositoryMutation');

// [LOG: 20260621_2238] 중복 등록 방지용 플래그
let isRegistered = false;

// [LOG: 20260621_2238] auditLogListener 구현 — EventBus를 통해 CRUD 감사 로그 처리
function registerAuditLogListener() {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  // 게시글 생성 이벤트 구독
  eventBus.on(Events.POST_CREATED, async ({ repo, post, context, boardId }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'create',
        resourceType: 'post',
        resourceId: post.id,
        boardId: boardId,
        metadata: { title: post.title }
      });
    } catch (err) {
      console.warn('[EventBus:POST_CREATED] 감사 로그 기록 실패:', err.message);
    }
  });

  // 게시글 수정 이벤트 구독
  eventBus.on(Events.POST_UPDATED, async ({ repo, post, context, before }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'update',
        resourceType: 'post',
        resourceId: post.id,
        boardId: post.boardId,
        metadata: {
          title: post.title,
          before: { title: before.title, content: before.content },
          after: { title: post.title, content: post.content }
        }
      });
    } catch (err) {
      console.warn('[EventBus:POST_UPDATED] 감사 로그 기록 실패:', err.message);
    }
  });

  // 게시글 삭제 이벤트 구독
  eventBus.on(Events.POST_DELETED, async ({ repo, post, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'delete',
        resourceType: 'post',
        resourceId: post.id,
        boardId: post.boardId,
        metadata: { title: post.title }
      });
    } catch (err) {
      console.warn('[EventBus:POST_DELETED] 감사 로그 기록 실패:', err.message);
    }
  });

  // 게시글 추천 이벤트 구독
  eventBus.on(Events.POST_RECOMMENDED, async ({ repo, post, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'recommend',
        resourceType: 'post',
        resourceId: post.id,
        boardId: post.boardId,
        metadata: { title: post.title }
      });
    } catch (err) {
      console.warn('[EventBus:POST_RECOMMENDED] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 회원 로그인 이벤트 구독
  eventBus.on(Events.MEMBER_LOGIN, async ({ repo, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'login',
        resourceType: 'member',
        resourceId: context.userId,
        metadata: { ip: context.ip || '' }
      });
    } catch (err) {
      console.warn('[EventBus:MEMBER_LOGIN] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 회원 로그아웃 이벤트 구독
  eventBus.on(Events.MEMBER_LOGOUT, async ({ repo, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'logout',
        resourceType: 'member',
        resourceId: context.userId,
        metadata: {}
      });
    } catch (err) {
      console.warn('[EventBus:MEMBER_LOGOUT] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 쪽지 발송 이벤트 구독
  eventBus.on(Events.MEMO_SENT, async ({ repo, memo, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'send_memo',
        resourceType: 'memo',
        resourceId: String(memo.id),
        metadata: { recipientUserId: memo.recipientUserId, title: memo.title }
      });
    } catch (err) {
      console.warn('[EventBus:MEMO_SENT] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 채팅방 생성 이벤트 구독
  eventBus.on(Events.CHAT_ROOM_CREATED, async ({ repo, room, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'create_room',
        resourceType: 'chat',
        resourceId: String(room.roomId || room.id || ''),
        metadata: { title: room.title }
      });
    } catch (err) {
      console.warn('[EventBus:CHAT_ROOM_CREATED] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 투표 생성 이벤트 구독
  eventBus.on(Events.VOTE_CREATED, async ({ repo, vote, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'create_vote',
        resourceType: 'vote',
        resourceId: String(vote.id),
        metadata: { title: vote.title }
      });
    } catch (err) {
      console.warn('[EventBus:VOTE_CREATED] 감사 로그 기록 실패:', err.message);
    }
  });

  // [LOG: 20260622_2301] 투표 참여 이벤트 구독
  eventBus.on(Events.VOTE_CAST, async ({ repo, voteRecord, context }) => {
    try {
      await mutation.insertAuditLog(repo, {
        actorId: context.userId,
        actorNick: context.nickName,
        action: 'cast_vote',
        resourceType: 'vote',
        resourceId: String(voteRecord.voteId),
        metadata: { optionIndex: voteRecord.optionIndex }
      });
    } catch (err) {
      console.warn('[EventBus:VOTE_CAST] 감사 로그 기록 실패:', err.message);
    }
  });
}

module.exports = {
  registerAuditLogListener
};
