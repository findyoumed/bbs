# Performance Refactor Checklist

LOG_ID: 20260804_1114

- [x] Add a repeatable startup performance harness and capture the baseline.
- [x] Remove duplicate authentication bootstrap traffic.
- [x] Remove the unused main-menu notice request.
- [x] Add conditional static-asset responses for the local Node server.
- [x] Reduce initial JavaScript module requests by at least 25% without adding a compiler or package.
- [x] Improve median initial-screen-ready time by at least 20% in the local harness.
- [x] Run syntax checks for every changed JavaScript file.
- [x] Pass `npm run loop:verify`.
- [x] Record implementation and verification evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
