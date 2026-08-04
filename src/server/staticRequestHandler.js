'use strict';

const fs = require('fs');
const path = require('path');
const { pickExistingFile, safeResolve, sendText, streamFile } = require('./httpUtils');

// [LOG_ID: 20260721_1400] Supabase JS SDK를 public/vendor/에 자체 호스팅으로 옮기면서
// script-src/font-src의 cdn.jsdelivr.net 허용이 필요 없어졌다(폰트는 이미 /fonts/*.woff로
// 자체 호스팅 중이었음). 더는 쓰지 않는 외부 출처를 CSP에서 제거해 허용 범위를 좁힌다.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io",
  "img-src 'self' data: http: https:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'"
].join('; ');

function applyHtmlSecurityPolicy(res) {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
}

function createStaticAssetIndex(projectRoot) {
  if (!projectRoot) return new Map();
  const publicRoot = path.join(projectRoot, 'public');
  const index = new Map();
  if (!fs.existsSync(publicRoot)) return index;

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = path.relative(publicRoot, filePath).split(path.sep).join('/');
      index.set(`/${relativePath}`, { filePath, stats: fs.statSync(filePath) });
    }
  }

  // [LOG_ID: 20260804_1114] Build once at local server startup. Vercel serves
  // public assets directly, while Node avoids repeated filesystem probes.
  visit(publicRoot);
  return index;
}

async function handleStaticRequest(runtime, req, res, requestUrl) {
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const hasExtension = Boolean(path.extname(pathname));

  if (!hasExtension) {
    applyHtmlSecurityPolicy(res);
    // [LOG_ID: 20260804_1114] Forward request validators so repeat navigation can use 304.
    const indexEntry = runtime.staticAssetIndex?.get('/index.html');
    return streamFile(
      res,
      indexEntry?.filePath || path.join(runtime.projectRoot, 'public', 'index.html'),
      { req, stats: indexEntry?.stats }
    );
  }

  const indexedEntry = runtime.staticAssetIndex?.get(pathname);
  const publicPath = indexedEntry?.filePath || safeResolve(path.join(runtime.projectRoot, 'public'), pathname);
  const finalPath = indexedEntry?.filePath || pickExistingFile(publicPath);

  if (!finalPath) {
    sendText(res, 404, `Not Found: ${pathname}`);
    return;
  }

  if (finalPath.endsWith('.html')) {
    applyHtmlSecurityPolicy(res);
  }

  await streamFile(res, finalPath, { req, stats: indexedEntry?.stats });
}

module.exports = {
  CSP_POLICY,
  applyHtmlSecurityPolicy,
  createStaticAssetIndex,
  handleStaticRequest
};
