'use strict';

const path = require('path');
const { pickExistingFile, safeResolve, sendText, streamFile } = require('./httpUtils');

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io",
  "img-src 'self' data: http: https:",
  "font-src 'self' https://cdn.jsdelivr.net",
  "object-src 'none'",
  "frame-ancestors 'none'"
].join('; ');

function applyHtmlSecurityPolicy(res) {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
}

async function handleStaticRequest(runtime, res, requestUrl) {
  const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const hasExtension = Boolean(path.extname(pathname));

  if (!hasExtension) {
    applyHtmlSecurityPolicy(res);
    return streamFile(res, path.join(runtime.projectRoot, 'public', 'index.html'));
  }

  const publicPath = safeResolve(path.join(runtime.projectRoot, 'public'), pathname);
  const finalPath = pickExistingFile(publicPath);

  if (!finalPath) {
    sendText(res, 404, `Not Found: ${pathname}`);
    return;
  }

  if (finalPath.endsWith('.html')) {
    applyHtmlSecurityPolicy(res);
  }

  await streamFile(res, finalPath);
}

module.exports = {
  CSP_POLICY,
  applyHtmlSecurityPolicy,
  handleStaticRequest
};
