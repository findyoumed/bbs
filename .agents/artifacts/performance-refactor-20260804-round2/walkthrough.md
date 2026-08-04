# Performance Refactor Round 2 Walkthrough

LOG_ID: 20260804_1305

## Outcome

The initial browser path now loads only startup-critical screen and builder modules. Optional amusement/arcade, vote, conference, member-search, menu-index, and contact-sysop implementations are resolved through retry-safe lazy facades on first use. Two self-hosted startup fonts now prefer glyph-equivalent WOFF2 assets with their original WOFF files retained as fallback.

## Performance Evidence

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Cold requests | 101 | 87 | -13.9% |
| JavaScript requests | 88 | 74 | -15.9% |
| Cold transfer | 3,492,765 bytes | 2,164,243 bytes | -38.0% |
| Static JS modules | 87 | 73 | -16.1% |
| Static JS source | 970.7 KB | 677.5 KB | -30.2% |
| Median initial readiness | 150 ms | 126 ms | -16.0% |
| Repeat transfer | 44,831 bytes | 40,631 bytes | -9.4% |

The final assertion also confirmed that no deferred module entered the initial static graph and Chromium requested only `/fonts/Sam3KRFont.woff2` and `/fonts/DungGeunMo.woff2`.

## Font Integrity

- `DungGeunMo`: 17,433 glyphs and 17,426 cmap entries before and after conversion; 1,614,668 to 862,308 bytes.
- `Sam3KRFont`: 12,298 glyphs and 12,295 cmap entries before and after conversion; 477,788 to 205,284 bytes.

## Verification

- Syntax checks passed for all five changed JavaScript files.
- `node scripts/performance-startup.js --assert`: passed all request, transfer, timing, static-graph, WOFF2, duplicate-API, and conditional-cache budgets.
- `npm run smoke:full-traversal`: passed without console errors.
- `node scripts/smoke-mobile-viewports.js`: 27 routes across 390px, 360px, and 320px viewports passed with zero errors, including deferred games, index, vote, and conference routes.
- Direct browser checks for `/game/bio`, `/member`, and `/tosysop`: completed without page or console errors.
- `npm run smoke:ui-geometry`, `npm run smoke:ui-layout`, and `npm run smoke:vercel-ready`: passed.
- `npm run loop:verify`: passed 9 of 9 gates.
- `git diff --check`: passed.

## Existing Verification Limitation

`npm test` cannot start on the current tracked repository because `scripts/run-unit-tests.js` requires `archive/dev-only/tests/unit`, while `archive/` and all `*.test.js`/`*.spec.js` files are absent from `HEAD`. No empty or fabricated tests were added to mask that pre-existing repository condition.
