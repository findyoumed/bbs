'use strict';

global.BbsApi = class BbsApiStub {};

const ChatBridge = require('../public/js/core/ChatBridge');
const StateManager = require('../public/js/core/BbsStateBootstrap');
const { assert } = require('./lib/scriptUtils');

function makeEngine() {
  return {
    cols: 80,
    buffer: Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => ({ char: ' ' }))),
    clearScreen() {},
    setCursor() {}
  };
}

function createFakeRealtimeClient() {
  const handlers = { broadcast: [], presence: [] };
  const tracked = [];
  const sent = [];

  const channel = {
    _presenceState: {},
    on(type, filter, handler) {
      if (type === 'broadcast') handlers.broadcast.push(handler);
      if (type === 'presence') handlers.presence.push(handler);
      return this;
    },
    subscribe(callback) {
      setTimeout(() => callback('SUBSCRIBED'), 0);
      return this;
    },
    async track(payload) {
      tracked.push(payload);
      this._presenceState = { [payload.userId]: [payload] };
      handlers.presence.forEach((handler) => handler());
      return 'ok';
    },
    async untrack() {
      this._presenceState = {};
      handlers.presence.forEach((handler) => handler());
      return 'ok';
    },
    async send(payload) {
      sent.push(payload);
      handlers.broadcast.forEach((handler) => handler({ payload: payload.payload }));
      return 'ok';
    },
    presenceState() {
      return this._presenceState;
    }
  };

  return {
    sent,
    tracked,
    client: {
      channel() {
        return channel;
      },
      async removeChannel() {
        return 'ok';
      }
    }
  };
}

async function main() {
  const fakeRealtime = createFakeRealtimeClient();
  const authUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    nickName: '회원',
    isAdmin: false
  };
  const authBridge = {
    ready: Promise.resolve(),
    getCurrentUser: () => ({ ...authUser }),
    getSupabaseClient: () => fakeRealtime.client
  };

  const bridge = new ChatBridge({ authBridge });
  const messages = [];
  let presence = null;

  await bridge.joinRoom('lobby', {
    onMessage: (message) => messages.push(message),
    onPresence: (snapshot) => { presence = snapshot; }
  });
  await bridge.sendMessage('안녕하세요', authBridge.getCurrentUser());

  assert(messages.length === 1, 'chat bridge should receive self-broadcast');
  assert(messages[0].text === '안녕하세요', 'chat bridge message text mismatch');
  assert(presence && presence.userCount === 1, 'chat bridge presence mismatch');
  assert(presence.presenceCount === 1, 'chat bridge should expose realtime presence count');
  assert(presence.countMode === 'realtime-sessions', 'chat bridge presence should expose realtime session mode');
  const presenceUsers = presence.userCount;
  await bridge.leaveRoom();

  const originalWindow = global.window;
  const originalFetch = global.fetch;

  try {
    global.window = {
      BbsRuntimeServices: { authBridge },
      history: { pushState() {}, replaceState() {} },
      location: { pathname: '/', search: '' }
    };
    global.fetch = async () => ({
      ok: true,
      text: async () => '▶ 예절을 지켜주세요.\n▶ Enter로 전송합니다.\n※ [/Q] 나가기'
    });

    const sent = [];
    const leftRooms = [];
    let left = false;
    const manager = new StateManager(makeEngine(), { render() {} }, { parse() {} });
    manager.api = {
      getMenuTree: async () => ({ go: 'top', children: [{ go: 'chat', type: 'chatt', accessLevel: 1 }] }),
      listChatRooms: async () => ([{
        no: 1,
        roomId: 'lobby',
        title: '실시간 대화방',
        greeting: '어서 오세요.',
        owner: 'system',
        ownerName: '운영자',
        userCount: 0,
        authUserCount: 0,
        guestSessionCount: 0,
        sessionCount: 0,
        countMode: 'hybrid-occupancy',
        maxUser: 99,
        visibility: '공개',
        requiresPassword: false
      }]),
      joinChatRoom: async (roomNo, payload) => ({
        no: roomNo,
        roomId: 'lobby',
        title: '실시간 대화방',
        greeting: '어서 오세요.',
        owner: 'system',
        ownerName: '운영자',
        userCount: 1,
        authUserCount: 1,
        guestSessionCount: 0,
        sessionCount: 1,
        countMode: 'hybrid-occupancy',
        maxUser: 99,
        visibility: '공개',
        requiresPassword: false,
        sessionKey: payload.sessionKey
      }),
      leaveChatRoom: async (roomNo, payload) => {
        leftRooms.push({ roomNo, sessionKey: payload.sessionKey });
        return { ok: true };
      }
    };
    manager.setChatBridge({
      async joinRoom(roomId, handlers) {
        this.handlers = handlers;
        return {
          roomId,
          participants: [
            { userId: authUser.userId, nickName: authUser.nickName },
            { userId: authUser.userId, nickName: authUser.nickName }
          ],
          userCount: 2,
          presenceCount: 2,
          countMode: 'realtime-sessions'
        };
      },
      async sendMessage(text, user) {
        sent.push({ text, user });
        this.handlers.onMessage({
          id: 'message-1',
          roomId: 'lobby',
          userId: user.userId,
          nickName: user.nickName,
          text,
          type: 'message',
          createdAt: '2026-03-21T12:00:00+09:00'
        });
      },
      async leaveRoom() {
        left = true;
      }
    });

    await manager.openChat({ pushStack: false });
    await manager.handleCommand('1');
    assert(manager.currentChat && manager.currentChat.userCount === 1, 'state manager should keep auth occupancy count after join');
    assert(manager.currentChat && manager.currentChat.authUserCount === 1, 'state manager should keep auth occupancy metadata');
    assert(manager.currentChat && manager.currentChat.presenceCount === 2, 'state manager should store live realtime sessions separately');
    manager._handleChatPresence({
      participants: [
        { userId: authUser.userId, nickName: authUser.nickName },
        { userId: authUser.userId, nickName: authUser.nickName },
        { userId: 'guest', nickName: '손님' }
      ],
      presenceCount: 3
    });
    assert(manager.currentChat && manager.currentChat.userCount === 1, 'presence sync should not overwrite occupancy count');
    assert(manager.currentChat && manager.currentChat.presenceCount === 3, 'presence sync should refresh live session count');
    await manager.handleCommand('첫 채팅 메시지');
    await manager._teardownChatIfActive();

    assert(manager.currentState === 'chat_room', 'state manager should enter chat state');
    assert(sent.length === 1, 'state manager should send chat message');
    assert(sent[0].text === '첫 채팅 메시지', 'state manager sent message mismatch');
    assert(left === true, 'state manager should leave chat room');
    assert(leftRooms.length === 1 && leftRooms[0].roomNo === 1, 'state manager should release chat room slot');

    let blockedSendCount = 0;
    manager.setChatBridge({
      async sendMessage() {
        blockedSendCount += 1;
      }
    });
    manager.currentState = 'chat_room';
    manager.currentChat = {
      view: 'room',
      roomId: 'lobby',
      roomNo: 1,
      title: '실시간 대화방',
      messages: [],
      userCount: 1,
      maxUser: 99,
      status: 'connecting',
      unavailable: false
    };
    await manager.handleCommand('성급한 메시지');
    assert(blockedSendCount === 0, 'state manager should block chat message while room is connecting');
    assert(String(manager.footerMessage).includes('\uC5F0\uACB0 \uC911'), 'state manager should explain connecting state');

    manager.setChatBridge({
      async sendMessage() {
        throw new Error('Realtime channel is not connected.');
      }
    });
    manager.currentChat.status = 'connected';
    await manager.handleCommand('재시도 메시지');
    assert(manager.currentChat.status === 'connecting', 'state manager should reset chat status after bridge disconnect');
    assert(String(manager.footerMessage).includes('\uC5F0\uACB0 \uC911'), 'state manager should surface reconnect guidance');
  } finally {
    global.window = originalWindow;
    global.fetch = originalFetch;
  }

  console.log(JSON.stringify({
    ok: true,
    bridgeMessages: messages.length,
    presenceUsers,
    sentCount: fakeRealtime.sent.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
