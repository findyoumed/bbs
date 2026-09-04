'use strict';

const fs = require('fs');
const path = require('path');
const { assert } = require('./lib/scriptUtils');

function exists(relPath) {
  return fs.existsSync(path.join(path.resolve(__dirname, '..'), relPath));
}

function readText(relPath) {
  return fs.readFileSync(path.join(path.resolve(__dirname, '..'), relPath), 'utf-8');
}

function listFileNames(relDir) {
  return fs.readdirSync(path.join(path.resolve(__dirname, '..'), relDir))
    .filter((name) => fs.statSync(path.join(path.resolve(__dirname, '..'), relDir, name)).isFile())
    .sort();
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  // [LOG: 20260417_1104] api/index.js로 통합됨
  const handler = require('../api/index.js');
  const indexHtml = readText('public/index.html');
  // [LOG: 20260406_1730] main.js → app.js (단일 파일 아키텍처로 전환됨)
  const appJs = readText('public/js/app.js');
  const sharedCoreFiles = listFileNames('src/core');

  assert(typeof handler === 'function', 'Vercel API handler should export a function');
  assert(exists('package.json'), 'package.json should exist for Vercel install/build');
  const packageJson = JSON.parse(readText('package.json'));
  assert(packageJson.engines?.node === '>=22.0.0', 'package.json should pin Node >=22.0.0 for current Supabase client support');
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
  assert(Number.isInteger(nodeMajor) && nodeMajor >= 22, `build runtime must use Node >=22 (current ${process.versions.node})`);
  assert(exists('vercel.json'), 'vercel.json should exist');

  // [LOG: 20260417_1104] 통합된 핸들러 및 구조 확인
  assert(exists('src/server/api_handler.js'), 'consolidated Vercel API handler should exist in src/server');
  assert(exists('api/index.js'), 'API entry point should exist');

  assert(exists('legacy/txt/top.txt'), 'legacy top.txt should be vendored');
  assert(exists('legacy/hanulso.mnu'), 'legacy hanulso.mnu should be vendored');
  assert(exists('public/bootstrap-shell.json'), 'public bootstrap shell should be generated for cold-start TOP rendering');
  assert(exists('public/js/app.js'), 'public/js/app.js should exist (단일 파일 엔트리)');
  assert(/<script\s[^>]*src="\/js\/app\.js"[^>]*><\/script>/i.test(indexHtml), 'public/index.html should load /js/app.js as the browser entry');
  assert(appJs.includes('updateURL'), 'public/js/app.js should contain updateURL (History API)');
  assert(appJs.includes('restoreStateFromURL'), 'public/js/app.js should contain restoreStateFromURL (URL 복구)');
  assert(!appJs.includes('window.setInterval(() => renderer.render(), 100)'), 'public/js/app.js should not use the legacy 100ms render polling loop');
  assert(!exists('public/src'), 'public/src should not exist anymore');
  assert(!exists('src/app.js'), 'src/app.js should not exist anymore');
  assert(
    JSON.stringify(sharedCoreFiles) === JSON.stringify(['AssetManager.js', 'TemplateEngine.js']),
    'src/core should only keep AssetManager.js and TemplateEngine.js as server-shared utilities'
  );

  const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf-8'));
  assert(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.length >= 4, 'vercel rewrites should be configured');
  // [LOG: 20260417_1104] 함수 개수 조건 완화 (통합되었으므로 1개 이상이면 됨)
  assert(vercelConfig.functions && Object.keys(vercelConfig.functions).length >= 1, 'vercel functions should be configured');

  console.log(JSON.stringify({
    ok: true,
    apiHandler: true,
    rewrites: vercelConfig.rewrites.length,
    publicJsReady: true,
    nodeEngine: packageJson.engines.node,
    nodeRuntime: process.versions.node,
    vendoredAssets: true,
    sharedCoreFiles
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
