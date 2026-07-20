'use strict';

const handleSystemRoutes = require('./routeHandlers/systemRoutes');
const handleAuthRoutes = require('./routeHandlers/authRoutes');
const handleMemberRoutes = require('./routeHandlers/memberRoutes');
const handleMemoRoutes = require('./routeHandlers/memoRoutes');
const handleChatServiceRoutes = require('./routeHandlers/chatServiceRoutes');
const handleBoardRoutes = require('./routeHandlers/boardRoutes');
// [LOG: 20260623_0013] origin/main에서 vote/ranking 라우트 포팅
const handleVoteRoutes = require('./routeHandlers/voteRoutes');
const handleRankingRoutes = require('./routeHandlers/rankingRoutes');
// [LOG_ID: 20260719_1600] 토론의 광장(CONF) 라우트
const handleConfRoutes = require('./routeHandlers/confRoutes');
// [LOG_ID: 20260720_2300] 건의하기 → 시삽 이메일 발송 라우트
const handleContactRoutes = require('./routeHandlers/contactRoutes');

const API_ROUTE_HANDLERS = [
  handleSystemRoutes,
  handleAuthRoutes,
  handleMemberRoutes,
  handleMemoRoutes,
  handleChatServiceRoutes,
  handleBoardRoutes,
  handleVoteRoutes,
  handleRankingRoutes,
  handleConfRoutes,
  handleContactRoutes
];

async function handleApiRequest(routeContext) {
  const startTime = Date.now();
  const { logger, req } = routeContext;
  
  // Skip URL prefix check if req is missing (unit test mock) or if it starts with /api/
  if (req && req.url && !req.url.startsWith('/api/')) {
    return false;
  }

  for (const handler of API_ROUTE_HANDLERS) {
    try {
      if (await handler(routeContext)) {
        const duration = Date.now() - startTime;
        if (logger) {
          logger.debug(`API request processed`, { 
            duration,
            handler: handler.name || 'anonymous'
          });
        }
        return true;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = Number(error?.status || 0);
      if (logger) {
        if (!status || status >= 500) {
          if (error && typeof error === 'object') {
            error._apiHandlerLogged = true;
          }
          logger.error(`API handler error`, {
            duration,
            handler: handler.name || 'anonymous',
            error
          });
        } else {
          logger.debug(`API handler rejected request`, {
            duration,
            handler: handler.name || 'anonymous',
            status
          });
        }
      }
      throw error; // Re-throw to be handled by createRequestHandler
    }
  }
  return false;
}

module.exports = {
  API_ROUTE_HANDLERS,
  handleApiRequest
};
