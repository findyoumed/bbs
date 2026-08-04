# Performance Refactor Checklist

LOG_ID: 20260804_1114

- [ ] Add a repeatable startup performance harness and capture the baseline.
- [ ] Remove duplicate authentication bootstrap traffic.
- [ ] Remove the unused main-menu notice request.
- [ ] Add conditional static-asset responses for the local Node server.
- [ ] Reduce initial JavaScript module requests by at least 25% without adding a compiler or package.
- [ ] Improve median initial-screen-ready time by at least 20% in the local harness.
- [ ] Run syntax checks for every changed JavaScript file.
- [ ] Pass `npm run loop:verify`.
- [ ] Record implementation and verification evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
