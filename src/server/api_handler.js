// [LOG: 20240417_1051] api/_handler.js -> src/server/api_handler.js 이전
const path = require('path');
const { createAppRequestHandler } = require('./createAppRuntime');
const { createErrorTrackerFromEnv } = require('./ErrorTracker');
const { toClientErrorMessage } = require('./errorDetailPolicy');

// rootDir은 프로젝트 루트 디렉토리 (src/server의 상위의 상위)
const rootDir = path.resolve(__dirname, '../..');
const errorTracker = createErrorTrackerFromEnv(process.env);

let requestHandler = null;
let initError = null;

try {
    requestHandler = createAppRequestHandler({
        rootDir,
        env: process.env
    });
} catch (error) {
    initError = error;
    // [LOG_ID: 20260806_1600] AI 코딩 주석화 — console.error 주석 처리
    // console.error('[api_handler] init failed:', error);
    void errorTracker.captureException(error, { component: 'src/server/api_handler', stage: 'init' });
}

module.exports = async function handler(req, res) {
    if (initError || !requestHandler) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: toClientErrorMessage(initError || new Error('Server init failed'), 500, process.env) }));
        return;
    }
    return requestHandler(req, res);
};
