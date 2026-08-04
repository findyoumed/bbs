# Performance Refactor Implementation Plan

LOG_ID: 20260804_1114

## Scope

Improve startup and repeat-load performance on the existing Vanilla JS and Node.js architecture. Do not add packages, introduce a compiler, change business behavior, or push to GitHub.

## Baseline Evidence

- Initial page: 141 local requests.
- Initial JavaScript: 124 module requests, approximately 1.52 MB in the entry dependency graph.
- Initial API traffic: 8 requests.
- Duplicate request: `/api/auth/session` is requested twice.
- Unused request: `/api/boards/notice?page=1&pageSize=1` is fetched but its result is discarded.
- Repeat load: static JavaScript and CSS return `200`; the local server supplies no validator for its `no-cache` policy.

## Implementation

1. Add a Playwright-based startup harness that measures screen readiness, request counts, transfer sizes, duplicate APIs, and repeat-load status codes.
2. Suppress the redundant Supabase `INITIAL_SESSION` refresh while preserving token synchronization and all later auth events.
3. Remove the discarded notice request from `showMain()`.
4. Add `ETag`, `Last-Modified`, `Content-Length`, and conditional `304` handling to local static responses.
5. Move optional feature groups behind dynamic imports while preserving synchronous command routing through lazy facades.
6. Run the harness after each logical change and stop after no more than five implementation iterations.

## Exit Criteria

- Initial API requests are 6 or fewer.
- Initial JavaScript requests are 93 or fewer.
- Repeat JavaScript and CSS requests use `304` validation in the local Node server.
- Median initial-screen-ready time improves by at least 20% against the recorded baseline.
- Existing smoke and unit tests pass through `npm run loop:verify`.
