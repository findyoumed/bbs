'use strict';

const http = require('http');
const path = require('path');
const AssetManager = require('../src/core/AssetManager');
const MenuResolver = require('../src/server/MenuResolver');
const RssService = require('../src/server/RssService');
const { createAttachmentRepository } = require('../src/server/AttachmentRepository');
const { createChatRoomRepository } = require('../src/server/ChatRoomRepository');
const { resolveLegacyPaths } = require('../src/server/projectPaths');
const { createBoardRepositoryFromEnv } = require('../src/server/BoardRepository');
const createRequestHandler = require('../src/server/createRequestHandler');
const { assert } = require('./lib/scriptUtils');

async function request(base, pathname, options = {}) {
  const response = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = text;
  }

  if (!response.ok) {
    const failure = new Error(`${response.status} ${pathname} -> ${JSON.stringify(payload)}`);
    failure.status = response.status;
    throw failure;
  }

  // [LOG: 20260425_2102] Extract data from standard API envelope
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return payload.data;
  }

  return payload;
}

function requestRaw(base, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, base);
    const body = options.body || '';
    const req = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(options.headers || {})
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let payload = raw;
        try {
          payload = JSON.parse(raw);
        } catch (error) {
          payload = raw;
        }
        resolve({
          status: res.statusCode || 0,
          payload
        });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  process.env.BOARD_REPOSITORY_DRIVER = 'memory';

  const projectRoot = path.resolve(__dirname, '..');
  const legacyPaths = resolveLegacyPaths(process.env, projectRoot);
  const boardRepository = createBoardRepositoryFromEnv(process.env);
  const chatRoomRepository = createChatRoomRepository();

  const requestHandler = createRequestHandler({
    projectRoot,
    assetManager: new AssetManager(legacyPaths.legacyTxtPath),
    boardRepository,
    attachmentRepository: createAttachmentRepository(projectRoot, {
      baseDir: path.join(projectRoot, 'data', 'tmp', `smoke-chat-attach-${process.pid}-${Date.now()}`)
    }),
    chatRoomRepository,
    menuResolver: new MenuResolver(legacyPaths.menuFilePath),
    rssService: new RssService({
      newsMenuPath: legacyPaths.newsMenuPath,
      weatherMenuPath: legacyPaths.weatherMenuPath
    })
  });

  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    const initialRooms = await request(base, '/api/chat/rooms');
    const createdRoom = await request(base, '/api/chat/rooms', {
      method: 'POST',
      body: {
        title: '비밀 방',
        greeting: '환영합니다.',
        visibility: 'private',
        password: '1234',
        maxUser: 2,
        userId: 'guest\r\nowner',
        nickName: '손님\r\n관리자'
      }
    });
    const invalidJsonResponse = await requestRaw(base, '/api/chat/rooms', {
      body: '{"title":"broken"'
    });
    const oversizedBodyResponse = await requestRaw(base, '/api/chat/rooms', {
      body: JSON.stringify({
        title: `room-${'x'.repeat(1024 * 1024 + 32)}`,
        greeting: 'too large'
      })
    });
    let joinErrorStatus = 0;
    let invalidSessionStatus = 0;
    try {
      await request(base, `/api/chat/rooms/${createdRoom.no}/join`, {
        method: 'POST',
        body: { sessionKey: 'session-1', userId: 'guest', nickName: '손님' }
      });
    } catch (error) {
      joinErrorStatus = error.status || 0;
    }
    try {
      await request(base, `/api/chat/rooms/${createdRoom.no}/join`, {
        method: 'POST',
        body: { sessionKey: 'bad session', password: '1234', userId: 'guest', nickName: '손님' }
      });
    } catch (error) {
      invalidSessionStatus = error.status || 0;
    }
    const joinedRoomA = await request(base, `/api/chat/rooms/${createdRoom.no}/join`, {
      method: 'POST',
      body: { sessionKey: 'session-1', password: '1234', userId: 'guest', nickName: '손님' }
    });
    const joinedRoomB = await request(base, `/api/chat/rooms/${createdRoom.no}/join`, {
      method: 'POST',
      body: { sessionKey: 'session-2', password: '1234', userId: 'guest-2', nickName: '손님2' }
    });
    const sentMessage = await request(base, `/api/chat/rooms/${createdRoom.no}/messages`, {
      method: 'POST',
      body: { content: '안녕하세요 채팅 스모크' }
    });
    const listedMessages = await request(base, `/api/chat/rooms/${createdRoom.no}/messages`);

    let fullErrorStatus = 0;
    try {
      await request(base, `/api/chat/rooms/${createdRoom.no}/join`, {
        method: 'POST',
        body: { sessionKey: 'session-3', password: '1234', userId: 'guest-3', nickName: '손님3' }
      });
    } catch (error) {
      fullErrorStatus = error.status || 0;
    }

    await request(base, `/api/chat/rooms/${createdRoom.no}/leave`, {
      method: 'POST',
      body: { sessionKey: 'session-1' }
    });
    const listedAfterOneLeave = await request(base, '/api/chat/rooms');
    await request(base, `/api/chat/rooms/${createdRoom.no}/leave`, {
      method: 'POST',
      body: { sessionKey: 'session-2' }
    });
    const listedAfterAllLeave = await request(base, '/api/chat/rooms');

    assert(Array.isArray(initialRooms) && initialRooms.length === 1, 'default chat room should exist');
    assert(createdRoom.requiresPassword === true, 'created room should be private');
    assert(createdRoom.visibility === '비밀방', 'created room visibility label mismatch');
    assert(!/[\r\n]/.test(createdRoom.owner), 'created room owner should strip control characters');
    assert(!/[\r\n]/.test(createdRoom.ownerName), 'created room ownerName should strip control characters');
    assert(invalidJsonResponse.status === 400, 'chat room create should reject malformed JSON body');
    assert(oversizedBodyResponse.status === 413, 'chat room create should reject oversized JSON body');
    assert(joinErrorStatus === 403, 'private room should reject missing password');
    assert(invalidSessionStatus === 400, 'private room should reject malformed session keys');
    assert(joinedRoomA.userCount === 1, 'first join should increment room count');
    assert(joinedRoomA.authUserCount === 0, 'guest-only room should not count auth users');
    assert(joinedRoomA.guestSessionCount === 1, 'first guest join should increment guest session count');
    assert(joinedRoomA.sessionCount === 1, 'first guest join should increment session count');
    assert(joinedRoomA.countMode === 'hybrid-occupancy', 'chat rooms should expose hybrid occupancy mode');
    assert(joinedRoomB.userCount === 2, 'second join should fill room count');
    assert(joinedRoomB.guestSessionCount === 2, 'second guest join should increment guest session count');
    assert(joinedRoomB.sessionCount === 2, 'second guest join should increment session count');
    assert(sentMessage.content === '안녕하세요 채팅 스모크', 'chat message create should preserve content');
    assert(Array.isArray(listedMessages) && listedMessages.length === 1, 'chat message list should return sent messages');
    assert(listedMessages[0].content === '안녕하세요 채팅 스모크', 'chat message list should preserve message content');
    assert(fullErrorStatus === 409, 'full room should reject extra users');
    assert(listedAfterOneLeave.some((room) => room.no === createdRoom.no && room.userCount === 1 && room.guestSessionCount === 1), 'room should remain while users stay');
    assert(!listedAfterAllLeave.some((room) => room.no === createdRoom.no), 'empty ephemeral room should be removed');

    console.log(JSON.stringify({
      ok: true,
      initialRoomCount: initialRooms.length,
      createdRoomNo: createdRoom.no,
      joinErrorStatus,
      fullErrorStatus,
      finalRoomCount: listedAfterAllLeave.length
    }, null, 2));
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
