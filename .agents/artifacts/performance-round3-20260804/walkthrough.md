# BBS Startup Latency Optimization Walkthrough

LOG_ID: 20260804_1405

## Changes

- Primary-font waiting is bounded to the preloaded-font path; the previous 2.5-second gate no longer blocks slow sessions.
- `preloadBootstrap()` starts `/api/bootstrap` before authentication finishes and shares the same promise with `showMain()`, preventing duplicate bootstrap requests.
- Public asset statistics use a 120-second freshness window and stale-while-revalidate refreshes so a stale snapshot does not block the first screen.
- Repository health checks are opt-in via `BBS_STARTUP_HEALTHCHECK=true`; ordinary cold starts do not fan out diagnostic calls.
- Node static assets negotiate Brotli first and gzip second for files at least 16KiB, avoiding compressor overhead for tiny native modules. Vercel static assets use 24-hour freshness with seven-day stale revalidation.

## Verification

- `node --check` passed for all changed JavaScript files.
- `npm run smoke:vercel-ready` passed.
- `npm run smoke:boards` passed.
- `npm run smoke:full-traversal` passed without console errors.
- `node scripts/performance-startup.js --assert` passed: 123ms median ready, 1.75MB cold transfer, 74 script requests, no duplicate API calls.
- Compression, preload deduplication, and Vercel cache-header assertions passed.

## Operational Note

`BBS_STARTUP_HEALTHCHECK=true` can be enabled for diagnostic environments. It is intentionally disabled by default for production cold-start latency.
