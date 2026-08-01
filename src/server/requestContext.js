'use strict';

const { buildManualRequestIdentity } = require('./RequestIdentityHelpers');

/**
 * [LOG: 20260426_2355] requestContext Evolution
 * - Enhanced buildTrackedContext to extract action hints from URL
 * - Support for additional activity metadata in touch()
 */

async function buildContext(req, body, authBridge) {
  if (authBridge?.resolveContext) {
    return authBridge.resolveContext(req, body);
  }

  return buildManualRequestIdentity(req, body, {
    env: process.env,
    fallback: {
      userId: 'guest',
      nickName: '\uC190\uB2D8',
      level: 1,
      isAdmin: false,
      isGuest: true,
      email: ''
    }
  });
}

function resolveActionHint(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  if (parts.length === 0) return 'home';
  
  const root = parts[0];
  if (root === 'api') {
    const apiAction = parts[1];
    if (apiAction === 'boards') {
      if (parts[3] === 'posts') return parts[4] ? 'read_post' : 'list_posts';
      return 'list_boards';
    }
    if (apiAction === 'chat') return 'chatting';
    if (apiAction === 'members') return 'member_activity';
    return apiAction;
  }
  
  return root;
}

async function buildTrackedContext(req, body, authBridge, activityRepository, pathname = '/') {
  const context = await buildContext(req, body, authBridge);
  if (activityRepository && context?.userId) {
    const action = resolveActionHint(pathname);

    // [LOG: 20260802_0100] activityRepository.touch()는 fire-and-forget 설계 — API 응답을
    // 활동 추적 완료까지 기다리게 하면 안 된다.
    // 단, Supabase 드라이버(ActivityRepositorySupabase)의 touch()는 async라 실패 시
    // rejected Promise를 반환한다. await·.catch() 없이 방치하면 UnhandledPromiseRejection이
    // 발생해 ErrorTracker가 이를 "Fatal" 이벤트로 기록하는 문제가 있었다(Node.js 22에서 재현).
    // 반면 메모리 드라이버(ActivityRepository)의 touch()는 동기 반환이라 Promise가 아니므로
    // .catch()를 직접 붙이면 TypeError가 난다 — Promise.resolve() 감싸기로 양쪽을 통일한다.
    Promise.resolve(activityRepository.touch(context, {
      path: pathname,
      action: action,
      remoteAddress: req?.socket?.remoteAddress || '',
      // Extra hint: If boardId is in body or query, it could be extracted here
      // but keeping it simple for now to avoid side effects.
    })).catch(() => {
      // fire-and-forget: 활동 추적 실패는 API 응답에 영향을 주지 않는다.
    });
  }
  return context;
}

module.exports = {
  buildContext,
  buildTrackedContext
};
