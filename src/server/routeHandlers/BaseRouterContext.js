'use strict';

const { readJsonBody, createError, createUnauthorizedError, createForbiddenError } = require('../httpUtils');
const { buildTrackedContext } = require('../requestContext');

async function getRouterBody(router) {
  if (router._body === null) {
    try {
      router._body = await readJsonBody(router.req);
    } catch (error) {
      throw createError(error.status || 400, error.message || 'Invalid JSON body');
    }
  }

  return router._body;
}

async function getRouterContext(router, includeBody = false) {
  if (router._context === null) {
    const { authBridge, activityRepository } = router.deps;
    const body = includeBody ? await getRouterBody(router) : null;
    router._context = await buildTrackedContext(router.req, body, authBridge, activityRepository, router.pathname);
  }

  return router._context;
}

async function ensureAuthenticatedContext(router, context) {
  const ctx = (context && typeof context === 'object' && !Array.isArray(context))
    ? context
    : await getRouterContext(router);

  if (!ctx || ctx.isGuest) {
    throw createUnauthorizedError('로그인이 필요한 서비스입니다.');
  }

  return ctx;
}

async function ensureAdminContext(router, context) {
  const ctx = (context && typeof context === 'object' && !Array.isArray(context))
    ? context
    : await getRouterContext(router);

  if (!ctx || !ctx.isAdmin) {
    throw createForbiddenError('운영 권한이 없습니다.');
  }

  return ctx;
}

module.exports = {
  ensureAdminContext,
  ensureAuthenticatedContext,
  getRouterBody,
  getRouterContext
};
