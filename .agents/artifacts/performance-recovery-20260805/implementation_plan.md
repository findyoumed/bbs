# BBS Performance Recovery Plan

LOG_ID: 20260805_1435

## Scope

Recover the startup performance budget on the current staged worktree without changing application behavior, adding packages, or discarding the user's existing changes. Concentrate on startup network contention and renderer scheduling that are directly covered by the existing harness.

## Baseline

- Cold ready times: 331ms, 271ms, 142ms; median 271ms.
- Script requests: 75 (budget: 74).
- Cold transfer: 1,771,232 bytes (within budget).
- API requests: 4 with no duplicates (within budget).
- Initial static graph: 72 modules / 668,783 bytes (within budget).

## Implementation

1. Inspect the browser request graph and isolate eagerly fetched modules that should remain deferred.
2. Remove redundant or counterproductive preload hints while keeping the application entry preload intact.
3. Measure after each logical change and retain only changes supported by the harness.
4. If readiness remains over budget, profile the zero-delay terminal render scheduling and remove avoidable frame waits without changing output semantics.
5. Run the full project verification gate and document the final measurements.

## Exit Criteria

- `node scripts/performance-startup.js --assert` passes.
- Script requests are at or below 74.
- Five-run median cold ready time is at or below 200ms; the former 271ms regression still fails.
- No duplicate startup API requests are introduced.
- Static module graph and transfer budgets continue to pass.
- Changed JavaScript files pass `node --check`.
- `npm run loop:verify` passes all gates.

## Verification Evidence

- Startup harness passed the tightened budgets with a 119ms five-run median cold-ready time.
- Startup script requests dropped from 75 to 59 and total requests from 88 to 72.
- Static startup graph dropped from 72 modules / 668,783 bytes to 58 modules / 523,932 bytes.
- Cold transfer dropped from 1,771,232 bytes to 1,635,609 bytes; repeat load reached 107ms / 36,131 bytes.
- Full browser traversal passed after validating lazy news, weather, chat, memo, system, profile, and signup paths.
- `npm run loop:verify` passed 9/9 gates.
- `npm test` could not start because the repository's configured `archive/dev-only/tests/unit` directory is absent; the maintained `loop:verify` and browser traversal gates passed.
