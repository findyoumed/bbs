# BBS Performance Recovery Walkthrough

LOG_ID: 20260805_1435

## Result

Startup performance is back within budget. Counterproductive preloads were removed, optional policy text and ANSI builder families now load with their corresponding lazy screens, and the font/zero-delay render paths no longer impose avoidable waits on first content.

## Measured Change

| Metric | Before | After |
| --- | ---: | ---: |
| Median cold ready | 271ms | 119ms |
| Script requests | 75 | 59 |
| Total requests | 88 | 72 |
| Cold transfer | 1,771,232 bytes | 1,635,609 bytes |
| Static module graph | 72 modules | 58 modules |
| Static source | 668,783 bytes | 523,932 bytes |
| Repeat ready | 162ms | 103ms |
| Repeat transfer | 40,931 bytes | 36,131 bytes |

## Changes

- Kept entry-module preload hints while removing eager preload hints for lazy routers and already-discovered static dependencies.
- Moved signup policy text behind the existing signup/policy lazy factories.
- Moved weather, news, chat, memo, and system ANSI builders behind their screen/handler lazy factories.
- Deferred the deep-link URL state restorer until the first non-root navigation or history restore.
- Deferred entry, vote, and conference command routers until their first screen-local command.
- Allowed authentication and bootstrap rendering to proceed while preloaded fonts finish in the background.
- Removed an unnecessary animation-frame wait from the zero-delay `DocumentFragment` renderer path.
- Added slow-resource evidence and tightened request, transfer, graph, and deferred-module performance assertions.
- Increased cold samples from three to five and uses a 200ms median budget so isolated local I/O spikes do not make the gate nondeterministic; the 271ms baseline still fails.

## Verification

- Changed JavaScript files passed `node --check`.
- `node scripts/performance-startup.js --assert` passed with the tightened budgets.
- `npm run smoke:full-traversal` passed without browser console errors.
- `npm run loop:verify` passed all 9 gates.
- `npm test` was unavailable because `archive/dev-only/tests/unit` is absent from this worktree.
