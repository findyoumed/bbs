# BBS Performance Follow-up Checklist

LOG_ID: 20260804_1359

- [x] Confirm command-router lazy loading already exists in `appFactory.js` and `lazyModuleFactory.js`.
- [x] Replace Supabase paged-list `select('*')` with a capability-aware summary projection.
- [x] Replace hit increment `select('*').single()` with a single counter-column projection without losing the loaded post.
- [x] Add one-page background prefetch with cache/in-flight deduplication and no visible-state mutation.
- [x] Run `node --check` on every changed JavaScript file.
- [x] Pass `npm run smoke:vercel-ready` and `npm run smoke:boards`.
- [x] Record implementation and verification evidence in `WORK_LOG.md` and `walkthrough.md`.

Maximum loop iterations: 5.
