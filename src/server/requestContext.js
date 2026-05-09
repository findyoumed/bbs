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
    
    activityRepository.touch(context, {
      path: pathname,
      action: action,
      remoteAddress: req?.socket?.remoteAddress || '',
      // Extra hint: If boardId is in body or query, it could be extracted here
      // but keeping it simple for now to avoid side effects.
    });
  }
  return context;
}

module.exports = {
  buildContext,
  buildTrackedContext
};
