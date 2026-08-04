# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and its subagents when working in this repository.

> **CRITICAL**: All shared project rules, architecture details, and coding standards are defined in **[AGENTS.md](file:///d:/work/bbs/www-bbs/AGENTS.md)**. Claude MUST follow AGENTS.md at all times.

---

## 1. Claude Specific Workflow

### 1.1 Permission & Approval
- This repository uses a **YOLO-friendly** policy.
- `Bash`, `Edit`, and `Write` tools are pre-approved for most tasks.
- Large architectural changes or new npm packages require explicit user confirmation.

### 1.2 Communication
- Keep responses concise and focused on the code.
- Always provide a summary of changes after completion.
- When finished, ensure you've recorded the work in `WORK_LOG.md`.

---

## 2. Commands & Verification

### 2.1 Essential Commands
```bash
npm run dev                    # Start local server (default http://localhost:3002, override with PORT)
npm run smoke:vercel-ready     # Full pre-deployment verification (also the `build` script)
npm run loop:verify            # Complete gate: all 9 smoke scripts + qa:final (sequential)
npm test                       # Run all unit tests
npm run qa:final               # Final QA report
node --check <file.js>         # JS syntax check — run after every edit
```

### 2.2 Running a Single Test
The `npm test` runner (`scripts/run-unit-tests.js`) executes **every** `*.test.js` in
`archive/dev-only/tests/unit/` with no filter flag. Test files are plain CommonJS, so to run
just one, invoke it directly:
```bash
node archive/dev-only/tests/unit/<name>.test.js
```

### 2.3 Domain-Specific Smoke Tests
If modifying specific modules, run the relevant test:
- `npm run smoke:menu-wiring`  # **Run after ANY `legacy/hanulso.mnu` or screen change.**
  Catches the recurring "menu does nothing when clicked" bug: `menuNavigationActions.js` has the
  `node.type` branch but `refs.showX` was never added to `appFactoryRuntime.js`, so
  `executeMenuNodeAction` silently `return false`s. Hit three times (showMemoList, showHelp, showPolicy).
- `npm run smoke:boards`       # Board API
- `npm run smoke:auth-bridge`   # Auth/Supabase Bridge
- `npm run smoke:chat-rooms`    # Chat API
- `npm run smoke:rss-services`  # News/Weather RSS
- `npm run smoke:renderer-ui`   # Terminal UI rendering

---

## 3. Reminders for Claude

1. **No Code Omission**: Claude often tries to be helpful by omitting unchanged code. **DO NOT DO THIS.** Always output the full file content as per the "No Code Omission" rule in AGENTS.md.
2. **Work Log**: After finishing a task, use the `/log` notification if available, but primarily ensure `WORK_LOG.md` is updated manually with the correct `LOG_ID` (YYYYMMDD_HHMM).
3. **Vanilla JS Only**: If Claude suggests a library or a framework (React/TS), immediately stop and revert to Vanilla JS.

---

## 4. Architecture Quick Reference
(Refer to [AGENTS.md](file:///d:/work/bbs/www-bbs/AGENTS.md) for full rules. Paths below are
verified against the working tree.)

### Browser (`public/js/`)
- Entry: `app.js` (ES modules) → `initApp()` in `core/appFactory.js` builds the app.
- Lazy-loading: `lazyModuleFactory.js` provides `createLazyObjectFactory` and `createLazyHandlerFactory` for deferring module load until first use. Example: `postAttachmentService.js` is loaded only when attachment features are accessed.
- State: a plain `state` object in `app.js`, keyed by `state.screen` (routing driver). No class store.
- ~140+ modules in `core/`, split by feature via naming convention:
  - `command*` — input pipeline: `commandDispatcher*` → `commandRouter*` (one router per domain: Chat, Memo, Vote, Vfs, Ranking, PostView…).
  - `*Screens.js` / `*AnsiBuilders.js` — render a screen vs. build its ANSI text.
  - `*AttachmentService.js` — detached attachment behaviors (lazy-loaded on first use).
  - `ansiEngine.js`, `terminalUiCore.js`, `terminal*` — 80x24 grid renderer + interactive overlay.
  - `signup*` — multi-step signup flow.

### Server (`src/server/`)
- **Two entry points, one runtime.** Both build the app via `createAppRuntime`:
  - Local dev: `server.js` (`node server.js`, `PORT` default **3002**) → raw `http.createServer`.
  - Vercel prod: `api/index.js` → `src/server/api_handler.js` (serverless function; all `/api/*` routes rewrite here per `vercel.json`, which also serves `public/` statically and SPA-rewrites clean URLs to `index.html`).
- Boot chain: `createAppRuntime` → `createAppServices` (wires repositories via `RepositoryRegistry`) + `createRequestHandler`.
- Routing: `routeHandlers/*Routes.js` extend `BaseRouter` (boardRoutes, authRoutes, chatServiceRoutes…).
- Repository **dual-mode**, chosen at boot by `RepositoryRegistry`: uses **Supabase** when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, otherwise falls back to in-memory/local. Naming convention:
  `XRepository.js` (base/facade) + `XRepositoryMemory.js` + `XRepositorySupabase.js` + `XRepositoryShared.js`.
- Shared server/tool utils in `src/core/`: `AssetManager.js`, `TemplateEngine.js`.
