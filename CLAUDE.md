# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and its subagents when working in this repository.

> **CRITICAL**: All shared project rules, architecture details, and coding standards are defined in **[AGENTS.md](file:///d:/work/bbs/www-bbs/AGENTS.md)**. Claude MUST follow AGENTS.md at all times.

---

## 1. Claude Specific Workflow

### 1.1 Permission & Approval
- This repository uses a **YOLO-friendly** policy.
- `Bash`, `Edit`, and `Write` tools are pre-approved for most tasks.
- **NEVER** `git push`. This is a hard restriction for all AI tools.
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
- State: a plain `state` object in `app.js`, keyed by `state.screen` (routing driver). No class store.
- ~140 modules in `core/`, split by feature via naming convention:
  - `command*` — input pipeline: `commandDispatcher*` → `commandRouter*` (one router per domain: Chat, Memo, Vote, Vfs, Ranking, PostView…).
  - `*Screens.js` / `*AnsiBuilders.js` — render a screen vs. build its ANSI text.
  - `ansiEngine.js`, `terminalUiCore.js`, `terminal*` — 80x24 grid renderer + interactive overlay.
  - `signup*` — multi-step signup flow.

### Server (`src/server/`)
- Boot: `server.js` → `createAppRuntime` → `createAppServices` (wires repositories via `RepositoryRegistry`) + `createRequestHandler`.
- Routing: `routeHandlers/*Routes.js` extend `BaseRouter` (boardRoutes, authRoutes, chatServiceRoutes…).
- Repository dual-mode (Memory vs Supabase, chosen from env), naming convention:
  `XRepository.js` (base/facade) + `XRepositoryMemory.js` + `XRepositorySupabase.js` + `XRepositoryShared.js`.
- Shared server/tool utils in `src/core/`: `AssetManager.js`, `TemplateEngine.js`.
