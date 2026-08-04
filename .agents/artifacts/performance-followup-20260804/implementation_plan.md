# BBS Performance Follow-up Implementation Plan

LOG_ID: 20260804_1359

## Scope

Apply only the three still-missing optimizations from the requested performance review. Preserve the existing dual Memory/Supabase repository contract, search behavior, list response shape, and screen state semantics. Do not add packages or change public service method signatures.

## Existing Evidence

- `appFactory.js` already lazy-loads `commandRouterBrowse.js`, `commandRouterChat.js`, `commandRouterMemo.js`, and `commandRouterService.js` through `createLazyHandlerFactory`.
- `SupabaseBoardRepositoryPostReads.fetchPagedPosts()` still selects `*`, including large `content` values for list rows.
- `getPost()` increments hits with `select('*').single()` and remaps the partial concern incorrectly if the projection is reduced without preserving the already-loaded post.
- `postService.loadPosts()` caches the current page but does not prefetch the next page.

## Implementation

1. Build a capability-aware summary projection for paged post lists. Include only identifiers, ordering fields, author/title metadata, counters, timestamps, and optional category; never include `content`.
2. Project only the detected hit column during hit increment and merge the returned counter into the already-loaded post object.
3. Split list fetching from visible-state application. Schedule at most one next-page cache fill during idle/microtask time, deduplicate in-flight requests, and keep prefetch from mutating `state.posts`.
4. Verify syntax and the requested Vercel/board smoke tests.

## Exit Criteria

- No `select('*')` remains in `fetchPagedPosts()` or hit increment.
- List queries never request `content`.
- A successful page load schedules exactly one cache-only next-page request when available.
- Existing list state and response contracts remain unchanged.
- Required syntax and smoke commands pass.
