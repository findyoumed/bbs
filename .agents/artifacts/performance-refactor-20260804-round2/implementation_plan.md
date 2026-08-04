# Performance Refactor Round 2 Implementation Plan

LOG_ID: 20260804_1305

## Scope

Reduce the browser's initial dependency graph without changing routes, commands, screen APIs, business logic, or the Vanilla JS architecture. Do not add packages or push Git commits.

## Current Baseline

- Cold page requests: 101.
- Cold JavaScript requests: 88.
- Cold transfer: approximately 3.49 MB.
- Median initial-screen readiness: 150 ms across three cold runs.
- Initial static JavaScript graph: 87 modules and approximately 970.7 KB of source.
- Optional screen and builder code reachable during startup: approximately 293 KB.

## Bottleneck

`appFactoryScreens.js`, `appFactoryServices.js`, and `ansiServiceBuilders.js` eagerly import optional feature screens and ANSI builders. Stable method references are required during routing and command wiring, but the concrete implementations are not needed until those features are opened.

## Implementation

1. Define explicit lazy facade method contracts in `appFactory.js` for amusement/arcade, vote, conference, member search, menu index, and contact-sysop features.
2. Compose feature-specific ANSI builders inside their lazy factory so `appFactoryServices.js` and `ansiServiceBuilders.js` contain only startup-critical services.
3. Inject the lazy factories through `appFactoryScreens.js` while keeping the existing screen object shape unchanged for routing and command handlers.
4. Add static graph, transfer-size, and WOFF2 assertions to the performance harness so regressions are caught without relying only on browser timing.
5. Convert the two startup WOFF fonts to glyph-equivalent WOFF2 while retaining WOFF fallback.
6. Run at most five measure-correct-verify iterations, then finish with the full repository gates.

## Exit Criteria

- Initial JavaScript requests are 74 or fewer.
- At least 280 KB is removed from the initial static JavaScript graph.
- Cold startup transfer is no more than 2.25 MiB and modern Chromium uses WOFF2.
- Median initial-screen readiness is 142 ms or less.
- Direct routes and command flows for every deferred feature remain covered by smoke tests.
- `npm run loop:verify` passes; `npm test` is audited separately because the tracked repository contains no unit-test directory or files.
