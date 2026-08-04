# Performance Refactor Round 2 Checklist

LOG_ID: 20260804_1305

- [x] Measure the current browser startup baseline.
- [x] Identify optional modules that remain in the initial static import graph.
- [x] Move amusement and arcade screens plus their ANSI builders behind one retry-safe lazy facade.
- [x] Move vote, conference, member-search, menu-index, and contact-sysop screens behind lazy facades.
- [x] Preserve direct URL restoration and synchronous method-reference wiring.
- [x] Reduce cold-start JavaScript requests from 88 to 74 or fewer.
- [x] Remove at least 280 KB from the initial static JavaScript graph.
- [x] Keep median initial-screen readiness at or below 142 ms.
- [x] Compress the two startup fonts to glyph-equivalent WOFF2 and retain WOFF fallback.
- [x] Run syntax checks for every changed JavaScript file.
- [x] Pass targeted smoke tests and `npm run loop:verify`.
- [x] Run `npm test` and record the pre-existing missing-test-directory failure.
- [x] Record final evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
