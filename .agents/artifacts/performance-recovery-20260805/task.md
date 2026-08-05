# BBS Performance Recovery Checklist

LOG_ID: 20260805_1435

- [x] Capture the failing startup-performance baseline from the current staged worktree.
- [x] Identify startup requests introduced outside the static dependency graph.
- [x] Remove only counterproductive startup work while preserving lazy-loaded behavior.
- [x] Re-run the startup harness until request-count and readiness budgets pass.
- [x] Run syntax checks and `npm run loop:verify`.
- [x] Record final evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
