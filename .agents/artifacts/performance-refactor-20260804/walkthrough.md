# Performance Refactor Walkthrough

LOG_ID: 20260804_1114

## Completed Changes

- Consolidated main-screen boards, menu, and statistics reads under `/api/bootstrap`.
- Removed unused notice traffic and the duplicate initial authentication refresh.
- Added validators and conditional `304` responses for static assets.
- Deferred optional screens and command routers with native dynamic imports.
- Extracted post attachment operations into `postAttachmentService.js` and dynamically
  import them on first use, reducing `postService.js` from 281 to 234 lines without
  changing its public API.

## Performance Evidence

- Initial API requests: 7 to 4.
- Initial JavaScript requests: 124 to 88 (29.0% reduction).
- Median initial readiness: 178ms to 120ms (32.6% reduction).
- Repeat readiness: 101ms.
- Repeat transfer: approximately 4.03MB to 45KB.
- Conditional static request: `304`.

The current container does not include the Playwright Chromium executable, so the
final performance assertion could not be rerun here. The last recorded successful
assertion above remains the evidence for the completed performance implementation.

## Verification

- `node --check public/js/core/postService.js`: passed.
- `node --check public/js/core/postAttachmentService.js`: passed.
- `npm run qa:final`: passed.
- `npm run loop:verify`: passed all 9 gates.
- `git diff --check`: passed.
- `npm run smoke:full-traversal`: completed through its HTTP fallback; it reported
  two environment/data findings (zero chat rooms and incomplete system-info repository
  metrics) unrelated to the attachment extraction.
- `node scripts/performance-startup.js --assert`: blocked because the Playwright
  Chromium executable is not installed in this container.

## Residual Risk

- A browser-backed traversal and performance assertion should be rerun in an
  environment with the repository's Playwright Chromium executable installed.
