# BBS Startup Latency Optimization Plan

LOG_ID: 20260804_1405

## Scope

Reduce user-visible startup latency without changing authentication or menu behavior. Keep the existing Vanilla JS architecture, preserve fallback behavior when auth/font/bootstrap requests fail, and avoid unsafe immutable caching for unversioned JavaScript.

## Implementation

1. Bound the primary-font gate to the preloaded-font path and preserve terminal glyph metrics, preventing the previous 2.5-second wait from blocking slow sessions.
2. Start the public bootstrap request as soon as the main screen begins loading, so it overlaps auth configuration/session work; reuse the in-flight response in menu navigation.
3. Increase public stats cache freshness and serve the last known stats while one background refresh updates the cache.
4. Make startup repository health checks opt-in, retaining explicit diagnostics through the system info path.
5. Add content negotiation compression to the Node static handler and use longer SWR cache headers for stable static assets in Vercel; keep HTML/API behavior unchanged.
6. Verify syntax, smoke suites, request behavior, cache/compression headers, and startup performance.

## Exit Criteria

- Initial font readiness is not awaited before auth/bootstrap rendering.
- `/api/bootstrap` has no duplicate request when the preloaded response is consumed.
- Public stats can be served from a fresh/stale cache without blocking bootstrap on every request.
- Startup health probes do not compete with the first request by default.
- Node static responses negotiate Brotli/gzip and Vercel sends longer SWR cache headers for static assets.
- `npm run smoke:vercel-ready`, `npm run smoke:boards`, and `node scripts/performance-startup.js --assert` pass.

## Verification Evidence

- All changed JavaScript files passed `node --check`.
- `npm run smoke:vercel-ready` passed.
- `npm run smoke:boards` passed.
- `npm run smoke:full-traversal` passed without console errors.
- `node scripts/performance-startup.js --assert` passed with 123ms median ready time, 1.75MB cold transfer, and no duplicate API calls.
- Static compression assertion passed with Brotli response negotiation.
- Bootstrap preload assertion passed with one shared in-flight request.
- Vercel cache-header assertion passed with 24-hour freshness and 7-day stale revalidation.
