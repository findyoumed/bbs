'use strict';

// [LOG: 20260621_2238] EventBus 정의 — 비즈니스 로직과 감사 로그의 디커플링 실현
class EventBus {
  constructor() {
    this.handlers = new Map();
    this.anyHandlers = [];
  }

  on(eventType, handler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  onAny(handler) {
    this.anyHandlers = [...this.anyHandlers, handler];
  }

  offAny(handler) {
    this.anyHandlers = this.anyHandlers.filter(h => h !== handler);
  }

  async emit(eventType, payload) {
    const handlers = this.handlers.get(eventType) ?? [];
    await Promise.allSettled([
      ...handlers.map(h => {
        try {
          return Promise.resolve(h(payload));
        } catch (err) {
          return Promise.reject(err);
        }
      }),
      ...this.anyHandlers.map(h => {
        try {
          return Promise.resolve(h(eventType, payload));
        } catch (err) {
          return Promise.reject(err);
        }
      })
    ]);
  }

  off(eventType, handler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, existing.filter(h => h !== handler));
  }
}

const eventBus = new EventBus();

const Events = {
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',
  POST_RECOMMENDED: 'post:recommended',
  // [LOG: 20260622_2301] 완전체 BBS를 위한 신규 이벤트 확장
  MEMBER_LOGIN: 'member:login',
  MEMBER_LOGOUT: 'member:logout',
  MEMO_SENT: 'memo:sent',
  MEMO_READ: 'memo:read',
  CHAT_MESSAGE: 'chat:message',
  CHAT_ROOM_CREATED: 'chat:room_created',
  BOARD_VISITED: 'board:visited',
  VOTE_CREATED: 'vote:created',
  VOTE_CAST: 'vote:cast'
};

module.exports = {
  eventBus,
  Events
};
