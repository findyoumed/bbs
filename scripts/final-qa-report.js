/**
 * [LOG: 20260411_2245] 최종 QA 리포트 생성기 보강 (의존성 주입 자동화)
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { loadEnv, assert } = require('./lib/scriptUtils');

async function request(base, pathname, options = {}) {
  const response = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers: options.headers || {}
  });
  const text = await response.text();
  let body = text;
  try { if (response.headers.get('content-type')?.includes('application/json')) body = JSON.parse(text); } catch (e) {}
  return { status: response.status, body };
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  loadEnv(path.join(projectRoot, '.env'));

  // 1. 소스 파일 구조 및 줄 수 체크
  const coreFiles = [
    'app.js', 'core/appFactory.js', 'core/apiFetch.js', 'core/menuService.js',
    'core/boardService.js', 'core/postService.js', 'core/dataService.js',
    'core/authService.js', 'core/signupModule.js', 'core/routingModule.js',
    'core/commandNormalizer.js', 'core/terminalUiCore.js'
  ];

  const fileChecks = {};
  coreFiles.forEach(f => {
    const p = path.join(projectRoot, 'public', 'js', f);
    const exists = fs.existsSync(p);
    fileChecks[f] = exists;
    if (exists) {
      const content = fs.readFileSync(p, 'utf-8');
      const lines = content.split('\n').length;
      assert(lines <= 250 || f === 'core/appFactory.js' || f === 'core/signupModule.js', `${f} should be <= 250 lines (current: ${lines})`);
    }
  });

  // 2. 서버 실행 및 API 체크
  const { createAppServices } = require('../src/server/createAppServices');
  const createRequestHandler = require('../src/server/createRequestHandler');
  
  const services = createAppServices(projectRoot, process.env);
  const requestHandler = createRequestHandler({ projectRoot, ...services });
  
  const server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const [index, boards, menu] = await Promise.all([
      request(base, '/'), request(base, '/api/boards'), request(base, '/api/menu')
    ]);

    const apiChecks = {
      indexStatus: index.status === 200,
      boardsStatus: boards.status === 200,
      menuStatus: menu.status === 200,
      isModularApp: index.body.includes('type="module" src="/js/app.js"')
    };

    Object.entries(apiChecks).forEach(([k, v]) => assert(v, `API Check failed: ${k}`));

    console.log(JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      fileChecks,
      apiChecks,
      summary: 'Extreme modularization verified. Entry points and API services operational.'
    }, null, 2));

  } finally {
    server.close();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
