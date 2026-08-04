'use strict';

const { handleApiRequest } = require('./apiRequestRouter');
const { respondWithRequestError } = require('./requestErrorResponder');
const {
  createRouteContext,
  createRequestHandlerRuntime
} = require('./requestHandlerRuntime');
const {
  createRequestGuards,
  handleCorsPreflight,
  handleRateLimit,
  initializeRequest
} = require('./requestGuards');
const { createStaticAssetIndex, handleStaticRequest } = require('./staticRequestHandler');

function createRequestHandler(options = {}) {
  const runtime = createRequestHandlerRuntime(options);
  // [LOG_ID: 20260804_1114] Index public-file metadata once instead of probing
  // the filesystem for every module request.
  runtime.staticAssetIndex = options.staticAssetIndex || createStaticAssetIndex(runtime.projectRoot);
  const guards = createRequestGuards(runtime.env);

  return async function handleRequest(req, res) {
    const requestId = initializeRequest(req, res);
    const requestUrl = new URL(req.url, 'http://localhost');

    if (handleCorsPreflight(req, res, requestUrl, guards)) {
      return;
    }

    if (handleRateLimit(req, res, requestUrl, guards)) {
      return;
    }

    const routeContext = createRouteContext(runtime, req, res, requestUrl, requestId);

    if (runtime.errorTracker && runtime.errorTracker.addBreadcrumb) {
      runtime.errorTracker.addBreadcrumb({
        category: 'http',
        message: `${req.method} ${req.url}`,
        data: {
          requestId,
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent']
        }
      });
    }

    try {
      if (await handleApiRequest(routeContext)) {
        return;
      }

      // [LOG_ID: 20260804_1114] Static responses need request cache validators.
      await handleStaticRequest(runtime, req, res, requestUrl);
    } catch (error) {
      await respondWithRequestError(error, {
        env: runtime.env,
        errorTracker: runtime.errorTracker,
        req,
        res,
        requestId
      });
    }
  };
}

module.exports = createRequestHandler;
