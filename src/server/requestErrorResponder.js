'use strict';

const { toClientErrorMessage } = require('./errorDetailPolicy');
const { sendApiError } = require('./httpUtils');
const logger = require('./logger');

async function respondWithRequestError(error, requestState) {
  const status = error?.status || 500;
  const { req, res, requestId, errorTracker, env } = requestState;
  const apiHandlerLogged = Boolean(error && typeof error === 'object' && error._apiHandlerLogged);
  const routeHandlerLogged = Boolean(error && typeof error === 'object' && error._routeHandlerLogged);

  if (!error?.status || status >= 500) {
    if (!apiHandlerLogged) {
      logger.error(error.message || 'Internal Server Error', {
        requestId,
        status,
        method: req.method,
        url: req.url,
        stack: error.stack
      });
    }

    if (errorTracker?.captureException) {
      await errorTracker.captureException(error, {
        component: 'createRequestHandler',
        requestId,
        status,
        method: req.method,
        url: req.url
      });
    }
  } else if (!routeHandlerLogged) {
    logger.warn(error.message, {
      requestId,
      status,
      method: req.method,
      url: req.url
    });
  }

  const clientMessage = toClientErrorMessage(error, status, env || process.env);
  sendApiError(res, status, clientMessage, error);
}

module.exports = {
  respondWithRequestError
};
