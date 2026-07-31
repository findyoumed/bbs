'use strict';

const { 
  sendJson, 
  sendApiResponse, 
  sendApiError, 
  createError, 
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createConflictError
} = require('../httpUtils');
const logger = require('../logger');
const { parsePagination, parseSort } = require('../queryUtils');
const { getRouterBody, getRouterContext, ensureAuthenticatedContext, ensureAdminContext } = require('./BaseRouterContext');
const { matchRoute } = require('./BaseRouterMatch');
const { validateObjectAgainstSchema, validateRequestSchema } = require('./BaseRouterValidation');

/**
 * [LOG: 20260425_2245] Enhanced BaseRouter with advanced declarative validation and semantic errors.
 */
class BaseRouter {
  constructor(deps) {
    this.deps = deps;
    this.req = deps.req;
    this.res = deps.res;
    this.requestUrl = deps.requestUrl;
    this.pathname = deps.requestUrl.pathname;
    this.method = deps.req.method;
    this._context = null;
    this._body = null;
  }

  /**
   * Standardized helper to extract pagination and sorting options from the request URL.
   */
  getQueryOptions(defaults = {}) {
    const pagination = parsePagination(this.requestUrl.searchParams, defaults);
    const sort = parseSort(this.requestUrl.searchParams, defaults);
    
    return {
      ...pagination,
      ...sort
    };
  }

  /**
   * Subclasses should override this to provide a routing table.
   * Format: [
   *   { 
   *     method: 'GET', 
   *     pattern: '/path/:id', 
   *     handler: 'methodName', 
   *     needContext: true, 
   *     needBody: true,
   *     validate: {
   *       body: { 
   *         userId: { required: true, minLength: 3, maxLength: 20 },
   *         role: { enum: ['user', 'admin'] }
   *       },
   *       query: { page: { type: 'number' } }
   *     },
   *     middlewares: [this.someMiddleware]
   *   }
   * ]
   */
  get routes() {
    return [];
  }

  /**
   * Main entry point to process the request against defined routes.
   */
  async handle() {
    for (const route of this.routes) {
      const matchResult = this.match(route.method, route.pattern);
      if (matchResult) {
        logger.debug(`Matched route: ${route.method} ${this.pathname} -> ${this.constructor.name}.${route.handler}`, {
          component: 'BaseRouter',
          method: this.method,
          pathname: this.pathname,
          handler: route.handler,
          params: matchResult
        });

        try {
          // 1. Pre-process body if requested
          if (route.needBody || (route.validate && route.validate.body)) {
            await this.getBody();
          }

          // 2. Pre-process context if requested
          if (route.needContext) {
            await this.getContext(route.needBody);
          }

          // 3. Execute middlewares if defined
          // [LOG_ID: 20260725_1900] 원래 유효성 검사(400)가 미들웨어(401/403)보다 먼저 실행됐다 —
          // 비로그인 요청도 body 형식만 틀리면 인증 검사 전에 400과 상세 유효성 메시지를 받아,
          // 인증 없이 스키마 정보를 탐색할 수 있었고 smoke-full-traversal의 "게스트 비밀번호
          // 변경은 401" 기대와도 어긋났다. 인증/권한 가드를 먼저 태우고 나서 유효성을 검사한다.
          if (Array.isArray(route.middlewares)) {
            let middlewareContext = this._context;
            for (const middleware of route.middlewares) {
              const fn = typeof middleware === 'string' ? this[middleware] : middleware;
              if (typeof fn === 'function') {
                if (typeof middleware === 'string') {
                  // [LOG: 20260429_0010] Auth/admin guards must receive the resolved request context,
                  // not route params such as :userId or :memoId.
                  if (!middlewareContext) {
                    middlewareContext = await this.getContext(route.needBody);
                  }
                  await fn.call(this, middlewareContext, matchResult);
                  continue;
                }

                await fn.call(this, matchResult, middlewareContext);
              }
            }
          }

          // 4. Declarative validation
          if (route.validate) {
            this.validateRequest(route.validate);
          }

          // 5. Execute final handler
          const result = await this[route.handler](matchResult);
          
          if (result !== false) return true;
        } catch (error) {
          if (error.status && error.status < 500) {
            if (error && typeof error === 'object') {
              error._routeHandlerLogged = true;
            }
            logger.warn(`Route handler error (${error.status}): ${error.message}`, {
              component: 'BaseRouter',
              path: this.pathname,
              handler: route.handler
            });
          }
          throw error;
        }
      }
    }
    return false;
  }

  /**
   * Matches the current request against a method and pattern.
   * Supports:
   * 1. Exact strings: "/api/health"
   * 2. Named parameters: "/api/members/:userId"
   * 3. Regular expressions: /^\/api\/members\/([^/]+)$/
   */
  match(method, pattern) {
    return matchRoute(this.method, this.pathname, method, pattern);
  }

  /**
   * Validates request body and query parameters based on a schema.
   */
  validateRequest(schema) {
    validateRequestSchema(this.requestUrl, this._body, schema);
  }

  _validateObject(obj, schema, source) {
    validateObjectAgainstSchema(obj, schema, source);
  }

  /**
   * Lazily reads and parses JSON body.
   */
  async getBody() {
    return getRouterBody(this);
  }

  /**
   * Alias for getBody() for backward compatibility.
   */
  async readBody() {
    return await this.getBody();
  }

  /**
   * Lazily builds the request context (auth, activity, etc.)
   */
  async getContext(includeBody = false) {
    return getRouterContext(this, includeBody);
  }

  /**
   * Sends a standard API success response.
   */
  send(statusCode, data, message = 'Success') {
    sendApiResponse(this.res, statusCode, data, message);
    return true;
  }

  /**
   * Sends a standard API error response.
   */
  sendError(statusCode, message, error = null) {
    sendApiError(this.res, statusCode, message, error);
    return true;
  }

  /**
   * Sends a raw JSON response (backward compatibility or special cases).
   */
  sendRaw(statusCode, payload) {
    sendJson(this.res, statusCode, payload);
    return true;
  }

  /**
   * Semantic error helpers for routers
   */
  validationError(message) { throw createValidationError(message); }
  unauthorized(message) { throw createUnauthorizedError(message); }
  forbidden(message) { throw createForbiddenError(message); }
  notFound(message) { throw createNotFoundError(message); }
  conflict(message) { throw createConflictError(message); }

  // [LOG_ID: 20260731_1830] confRoutes/memoRoutes/voteRoutes가 각자 `_parseRoomNo`/
  // `_parseAgendaId`/`_parseMemoId`/`_parseVoteId`라는 이름으로 "양의 정수 하나 파싱, 아니면
  // validationError" 로직을 문자 그대로 복제해 갖고 있었다(파라미터 이름과 에러 메시지만
  // 다름) — 그 로직 자체를 여기 하나로 모은다. 각 라우터의 로컬 `_parseXxx(params)` 메서드는
  // 이름과 도메인별 에러 메시지를 유지한 채 이 헬퍼에 위임한다(호출부 코드는 변경 없음).
  parsePositiveIntParam(rawValue, message) {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
      this.validationError(message);
    }
    return value;
  }

  /**
   * Throws a structured HTTP error.
   */
  error(statusCode, message) {
    throw createError(statusCode, message);
  }

  // --- Common middleware/guard helpers ---

  /**
   * Guard: Ensure the user is authenticated.
   */
  async ensureAuthenticated(context) {
    return ensureAuthenticatedContext(this, context);
  }

  /**
   * Guard: Ensure the user has admin privileges.
   */
  async ensureAdmin(context) {
    return ensureAdminContext(this, context);
  }
}

module.exports = BaseRouter;
