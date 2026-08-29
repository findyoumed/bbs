# 전체 오류 감사 체크리스트

작업일: 2026-08-11

- [x] `/memo/write` 상태바의 `P` 취소 및 `ME`/`MEMO` 명령 전달 수정
- [x] 비동기 raw 입력 핸들러의 `false` 결과가 일반 라우터로 전달되도록 수정
- [x] `findBoardByCode` 의존성 누락 오류 수정
- [x] 전체 회귀 게이트 및 변경 파일 문법 검사
- [x] `npm test` 단위 테스트 실행 불가 원인 확인 및 별도 처리 결정
- [x] 서버/API 및 브라우저 콘솔 오류 순회

## 종료 기준

- 변경 JavaScript 파일 `node --check` 통과
- `npm run loop:verify` 9/9 통과
- `npm run check` Supabase liveReady/ok 통과
- `npm run smoke:full-traversal` 콘솔 오류 없이 통과
- HTTP/API 점검에서 재현 가능한 오류 0건 또는 원인·범위 기록
- 결과를 `walkthrough.md`와 `WORK_LOG.md`에 기록
- [x] Align GO ME and GO MEMO with the received memo inbox, matching RMAIL
- [x] Preserve GO MAIL as the top-level mail menu and GO CMAIL as sent memos
- [x] Add regression coverage for GO mail semantics and run full verification

## Current iteration: 2026-08-28 17:00

- [x] Evidence review: HITEL.MNU, NOW_MENU-derived routes, and current routers
- [x] Implementation: menuNavigationActions.js mail command split
- [x] Verification: command parity, GO/ANSI smoke, loop gate 10/10, full traversal, Supabase readiness
- [x] Audit cross-service GO keywords against live menu targets
- [x] Add verified Chollian WORD -> current PLAZA compatibility alias
- [x] Ensure canonical alias targets reach menu and board resolvers
- [x] Run command, traversal, loop, and Supabase verification

## Current iteration: 2026-08-28 17:15

Exit criteria met: only verified targets were added; unsupported historical targets remain unmapped.
- [x] Add verified Nownuri Korean GO 유머란 -> HUMOR alias
- [x] Add verified Chollian GO WORD -> PLAZA alias and resolver coverage

## Current iteration: 2026-08-28 17:30

All exit criteria met: syntax, GO smoke, command parity, loop gate, traversal, and Supabase readiness passed.

## Current iteration: 2026-08-28 18:00

- [x] Compare the 01410 UI reference's small-notice requirement with the current main-menu renderer
- [x] Load the latest notice without blocking the main menu and preserve a 30-second client cache
- [x] Reuse the existing `(GO NOTICE)` hotspot/keyboard activation path
- [x] Run the complete verification gates and record the live menu result

## Current iteration: 2026-08-28 18:30

- [x] Browser-probe every top-menu and small-notice hotspot from the live root screen
- [x] Promote the hotspot click probe into `smoke-full-traversal.js`
- [x] Confirm all 12 root hotspots transition without console/page errors

## Current iteration: 2026-08-28 18:45

- [x] Include `/guide/tosysop` in direct-route traversal coverage
- [x] Verify guest protection renders a usable guide screen without a route/page error

## Current iteration: 2026-08-28 19:00

- [x] Browser-test the authenticated 건의하기 editor through the GUIDE hotspot
- [x] Confirm empty 제목 validation stays inline and preserves the Ctrl+S/취소 hint
- [x] Isolate the authenticated probe page so the anonymous traversal state is unchanged

## Current iteration: 2026-08-28 19:30

- [x] Probe GUIDE/BBS/AGORA/GAME/LOG child menus in Chromium
- [x] Click all 40 rendered child-menu hotspots and confirm route or screen transitions
- [x] Confirm guest TOSYSOP protection and external OAuth handoffs remain intentional

## Current iteration: 2026-08-28 20:00

- [x] Compare the legacy AGORA parent/child menu semantics with current direct URL restoration
- [x] Keep `/agora` as the 여론광장 container and map vote-list state to `/agora/vote`
- [x] Preserve existing vote detail and create routes
- [x] Add browser regression checks for both direct routes and update mobile smoke coverage
- [x] Run syntax and full traversal verification

## Current iteration: 2026-08-28 20:15

- [x] Add GO AGORA regression for the parent menu container
- [x] Add GO VOTE regression for the nested vote-list feature
- [x] Assert `/agora` and `/agora/vote` semantics in the routing contract smoke
- [x] Run GO/ANSI smoke and the 10-step completion gate

## Current iteration: 2026-08-28 20:30

- [x] Re-read the Hitel plan and compare Phase 1~3 claims with current code
- [x] Add an authoritative implementation-status synchronization section
- [x] Preserve the historical plan text and record CAP as intentionally excluded
- [x] Log the documentation-only correction without changing runtime behavior

## Current iteration: 2026-08-28 20:45

- [x] Confirm `SOS [메시지]` is documented by the historical command guide but absent from the global router
- [x] Route SOS into the existing authenticated sysop-contact editor with a prefilled emergency draft
- [x] Keep guest users blocked and require explicit Ctrl+S confirmation before sending
- [x] Add command, browser, full-loop, Supabase, unit-test, and diff verification

## Current iteration: 2026-08-28 21:10

- [x] Compare documented long-form commands with the current normalizer and screen-local routers
- [x] Normalize PREV/MAIN/QUIT/NEXT/BACK/WRITE/ANSWER and screen-safe READ forms to existing canonical commands
- [x] Add direct post-list R/READ and RE/ANSWER behavior without bypassing existing auth/write guards
- [x] Add memo-list R/READ and S/SEND recipient behavior using the existing memo screens
- [x] Add command-parity regression coverage for the new historical forms

## Current iteration: 2026-08-28 21:25

- [x] Compare member and PDS long forms from the three-service command guide
- [x] Normalize FINGER to PF, INFO to HI, and PDS FL to the existing list command
- [x] Extend command-parity assertions for the added aliases

## Current iteration: 2026-08-28 22:05

- [x] Compare common and provider-specific GO keywords with the live menu tree
- [x] Map the verified `BLUEHOUSE` suggestion intent to the existing TOSYSOP screen
- [x] Record unsupported historical destinations without inventing replacement boards
- [x] Run GO smoke, full loop, Supabase readiness, unit, and diff checks
- [x] Add canonical GO CHAT/HUMOR coverage for the common 3사 destinations
- [x] Synchronize the documented DN protocol and ABSENT implementations with the status section
- [x] Route plain and slash-prefixed GO commands from an active chat room
- [x] Keep unsupported chat-room GO targets in the current room with a local hint

## Current iteration: 2026-08-28 16:55

- [x] Audit game input validation paths that previously called `setHint()` directly
- [x] Render date/MBTI validation messages in a body-level inline error row
- [x] Preserve the existing command hint while invalid game input is corrected
- [x] Add browser regression coverage for bio/fortune/tojeong/compat/MBTI validation
- [x] Run full traversal, loop gate, Supabase readiness, unit tests, and diff checks

Exit criteria: invalid game input remains visible beside its prompt, the bottom hint is unchanged, and successful input continues to render the existing result screens.

## Current iteration: 2026-08-28 17:20

- [x] Compare the documented `FW 번호 아이디` mail command with the memo-list router
- [x] Reuse the existing forward-body prefill and memo compose flow from the list screen
- [x] Keep invalid memo numbers in the current list with the existing selection hint
- [x] Add command-parity coverage for recipient and forwarded body preservation
- [x] Run syntax, command parity, full traversal, loop, Supabase, unit, and diff verification

Exit criteria: `FW 번호 아이디` opens the existing compose flow for the selected recipient without duplicating memo persistence or changing read-screen behavior.
## Current iteration: 2026-08-29 10:35

- [x] Compare the documented chat-room `/l` and `/list` commands with the active-room router
- [x] Reuse the existing `/p` leave-and-lobby flow for both historical list spellings
- [x] Add command-parity coverage for room cleanup and lobby rendering
- [x] Run the full browser, loop, Supabase, unit, and diff gates

Exit criteria: `/l` and `/list` leave the active room through the existing endpoint and render the chat lobby without changing ordinary chat messages.
## Current iteration: 2026-08-29 11:10

- [x] Compare the documented common `WHO`/`U` member lookup with the global router
- [x] Preserve post-list `U` write and post-view `U` attachment semantics
- [x] Route `U` to active-user lookup on other screens and add parity coverage
- [x] Run the full browser, loop, Supabase, unit, and diff gates

Exit criteria: the historical `U` shortcut works where no screen-local `U` meaning exists, with existing board and attachment flows unchanged.
## Current iteration: 2026-08-29 11:35

- [x] Compare documented `RE`, `A`, and `ANSWER` reply forms with the post-list router
- [x] Reuse the existing reply target resolver and authentication guard for `A 번호`
- [x] Add command-parity coverage for the list-local `A` form
- [x] Run the full browser, loop, Supabase, unit, and diff gates

Exit criteria: `A 번호` replies to the selected post only from post lists, while post-view `A` navigation remains unchanged.
## Current iteration: 2026-08-29 12:05

- [x] Compare the command-help metadata with the implemented historical aliases
- [x] Document context-sensitive `A`, the `WHO`/`U` pair, and list-form `FW`
- [x] Add parity assertions so help text cannot regress independently of routing
- [x] Run the full browser, loop, Supabase, unit, and diff gates

Exit criteria: command help describes the same forms that the screen-local routers accept, without changing runtime behavior.
## Current iteration: 2026-08-29 12:40

- [x] Compare active-room historical commands with the visible chat footer
- [x] Expose only working `/L` and `/W` shortcuts as clickable chat-room tokens
- [x] Run the full browser, loop, Supabase, unit, and diff gates

Exit criteria: chat-room hint tokens reveal the historical room-list and participant commands and dispatch them through the existing handlers.

## Current iteration: 2026-08-29 13:10

- [x] Compare implemented `NEW/NW` post-list routing with the visible list footers
- [x] Expose the no-argument `NEW` shortcut in ordinary and unified PDS lists
- [x] Run syntax and command-parity verification

Exit criteria: the existing recent-post filter is discoverable as a clickable footer token without changing list routing or search behavior.

## Current iteration: 2026-08-29 13:45

- [x] Compare Nownuri `CHATIN` with the existing chat-lobby route
- [x] Normalize `CHATIN` to the canonical `CHAT` command
- [x] Reuse the existing lobby renderer and preserve active-room message priority
- [x] Run syntax and command-parity verification

Exit criteria: `CHATIN` enters the existing chat lobby for authenticated users without creating a second chat flow or intercepting ordinary room messages.

## Current iteration: 2026-08-29 14:10

- [x] Compare the documented `F [번호]` form with current list navigation
- [x] Normalize numeric `F` only on post lists to the existing `LS [번호]` handler
- [x] Preserve bare `F` pagination and post-view `F` behavior
- [x] Run syntax and command-parity verification

Exit criteria: numeric `F` supports direct list positioning without changing ordinary next-page behavior.

## Current iteration: 2026-08-29 14:30

- [x] Compare Nownuri menu code `CHATIN` with the historical GO resolver
- [x] Add `CHATIN → CHAT` to the canonical GO alias catalog
- [x] Verify `GO CHATIN` reuses the existing chat-lobby action
- [x] Run syntax and GO/ANSI parity verification

Exit criteria: both direct `CHATIN` and `GO CHATIN` preserve the same existing chat-lobby destination.

## Current iteration: 2026-08-28 17:52

- [x] Run the common-flow smoke checks for chat, boards, menus, renderer, security, and recovery
- [x] Reproduce the chat occupancy failure where two sessions of one authenticated member filled a room twice
- [x] Preserve `authUserId` in the memory chat driver and align the occupancy smoke fixture with the shared contract
- [x] Re-run focused syntax and chat-count verification
- [x] Run `loop:verify`, Supabase readiness, unit tests, full browser traversal, and diff checks

Exit criteria: memory and Supabase chat drivers use the same authenticated-user occupancy semantics, and the common-flow smoke checks pass without adding a parallel feature path.

## Current iteration: 2026-08-29 01:28

- [x] Re-run the Supabase-backed chat member persistence smoke
- [x] Reproduce the fixture mismatch where the selected profile omitted `authUserId`
- [x] Align the profile fixture with the AuthBridge request context without changing runtime routing
- [x] Verify authenticated multi-session occupancy and member-row cleanup

Exit criteria: the Supabase common-flow smoke represents an authenticated member correctly and passes the same occupancy contract as production requests.

## Current iteration: 2026-08-29 01:42

- [x] Reproduce the `/memo` → `W` editor flow in a real Chromium page
- [x] Verify Enter and row-click focus transitions for recipient, subject, and body
- [x] Verify empty-body validation stays inline and preserves the command hint
- [x] Add the scenario to full traversal and rerun the release gates

Exit criteria: the common memo editor interaction is covered by browser regression checks without changing memo persistence or routing behavior.

## Current iteration: 2026-08-29 10:46

- [x] Add a browser fixture for one received memo without writing to Supabase
- [x] Verify the memo-list hotspot click opens the memo-view screen
- [x] Keep the existing keyboard/editor assertions and rerun full traversal
- [x] Rerun the 24-check loop gate

Exit criteria: both the common memo-list click and memo-editor keyboard flows are covered by a deterministic browser regression path.

## Current iteration: 2026-08-29 11:28

- [x] Fix hint-bar `Tab` token so it performs editor focus movement instead of filling `TAB` into the command line
- [x] Preserve the last editor field when the browser focuses the clickable hint token before dispatch
- [x] Add migration coverage for memo archive flags and chat member upsert identity
- [x] Correct the Nurie `.NRE` catalog to document `@[`/encoding conversion and unsupported Nurie extensions
- [x] Run focused browser, Supabase, and full loop verification after the changes

Exit criteria: clicking or keyboard-activating `Tab` follows the same next-field behavior as the physical Tab key, and fresh Supabase schemas contain the columns/indexes used by runtime repositories.

## Current iteration: 2026-08-29 11:45

- [x] Add role/tabindex semantics and Enter/Space activation for blood-type hotspots
- [x] Remove duplicate blood hotspot mousedown/click activation paths
- [x] Repair the click-fill command harness to import real ES modules and model required browser stubs
- [x] Add browser regression coverage for blood hotspot keyboard activation
- [x] Run the repaired harness and full browser traversal

Exit criteria: blood-type choices support mouse and keyboard activation without duplicate navigation, and the click-fill regression harness runs instead of failing during module loading.

## Current iteration: 2026-08-29 12:05

- [x] Make the readonly `sysop` recipient field advance to the subject on direct click
- [x] Add a permanent browser assertion for that fixed-recipient click path
- [x] Add read-only `.NRE` sentinel conversion coverage to the ANSI smoke
- [x] Keep legacy byte decoding and Nurie-only extensions outside the web renderer claim
- [x] Rerun the full 24-check loop after the final NRE assertion

Exit criteria: fixed-recipient mouse flow and the documented `.NRE` conversion boundary are regression-tested without changing mail routing or adding a runtime NRE loader.

## Current iteration: 2026-08-29 12:18

- [x] Add Enter/ArrowDown/Tab handling to the readonly `sysop` recipient field
- [x] Verify direct recipient click and Enter both advance to the subject
- [x] Confirm NRE sentinel parsing and all release gates remain green

Exit criteria: the fixed recipient has mouse and keyboard parity, and NRE reference checks do not broaden runtime support claims.

## Current iteration: 2026-08-29 12:45

- [x] Reproduce the authenticated startup toast race where the first render clears the notification
- [x] Defer unread memo notification until the initial screen/footer render completes
- [x] Add module smoke coverage for toast visibility handoff and `/memo` click navigation
- [x] Hold the same notification window across interactive login before returning to the main screen
- [x] Run the full traversal and release gates

Exit criteria: an authenticated user with unread memos can see, hover, focus, and activate the toast after startup without changing memo or Supabase data.

## Current iteration: 2026-08-29 13:10

- [x] Audit GO and hint-bar parity against the recovered Nownuri menu-index behavior
- [x] Resolve hierarchical numeric paths such as `GO 1 3` and `GO 1.3` through `door` values
- [x] Preserve flat numeric GO compatibility such as `GO 13`
- [x] Add GO smoke coverage for GUIDE/HELP and GAME/SCRAMBLE paths
- [x] Run `smoke:go-ansi`, `loop:verify`, and full browser traversal

Exit criteria: hierarchical menu indices no longer collapse into an unrelated flat command, while existing aliases and flat numeric GO commands remain compatible.

## Current iteration: 2026-08-29 13:25

- [x] Add a read-only readiness probe for `receiver_archived`/`sender_archived`
- [x] Confirm the configured activity repository uses Supabase `user_activities`
- [x] Confirm remote memo archive columns through the service-role REST probe
- [x] Make readiness enumerate every numbered migration instead of a partial hard-coded list
- [x] Confirm the `(room_id, user_id)` unique index through Supabase SQL metadata
- [x] Confirm remote migration history; deployed history uses timestamped names and does not include local 0023/0024 names

Exit criteria: runtime readiness reports the schema fields required by memo archiving, and Supabase SQL metadata confirms the chat-member uniqueness contract despite remote migration-name drift.

## Current iteration: 2026-08-29 12:25

- [x] Reconcile the historical Hitel eight-type mail matrix with the compose flow
- [x] Add secret/reply-required/delayed combinations 1-8 without changing the memo schema
- [x] Encode the selected flags in the existing title tag and preserve delayed/reply handling
- [x] Add a deterministic smoke assertion for all eight type flags and tags
- [x] Run build, Supabase readiness, full traversal, qa:final, and loop:verify

Exit criteria: memo composition exposes all eight documented letter types, and all existing browser, API, and readiness gates remain green.

## Current iteration: 2026-08-29 13:40

- [x] Audit Supabase advisor findings against the server-only service-role architecture
- [x] Confirm anonymous Data API reads are blocked by RLS/no-policy tables
- [x] Reconcile command guides with current context-sensitive routing (TOP, chat `/Z`, SET/CAP, PRINT/XX/EAR)
- [x] Correct stale command and source-path references in the project documentation
- [x] Run `npm run check`, `npm run loop:verify`, syntax checks, and `git diff --check`
- [ ] Obtain an operations decision before changing public RPC grants, function `search_path`, password protection, or CORS origins

Exit criteria: documentation matches current behavior, runtime remains green, and security changes that could affect external clients are isolated as an explicit follow-up decision.

## Current iteration: 2026-08-29 14:05

- [x] Expose the already-working chat-room `/Z` replay command in the active-room footer
- [x] Keep global `Z` removed so unsupported ordinary-screen input is unchanged
- [x] Add command-parity coverage for the new room-only footer token
- [x] Re-run the command smoke and full 24-check loop

Exit criteria: chat-room replay is discoverable and clickable without broadening `Z` into a global command.

## Current iteration: 2026-08-29 14:20

- [x] Reproduce the missing chat footer `/Z` token in the browser traversal
- [x] Extend the hint-bar directive parser to retain optional slash prefixes
- [x] Verify `/L`, `/W`, and `/Z` remain clickable chat-room actions
- [x] Add browser regression coverage for `/Z` replay and rerun full traversal
- [x] Add ANSI/hint smoke assertions for `/L`, `/W`, and `/Z` data-cmd targets

Exit criteria: slash-prefixed active-room shortcuts render as interactive tokens and replay does not leak into ordinary-screen global commands.

## Current iteration: 2026-08-29 15:00

- [x] Reconcile ME/MEMO/RMAIL help metadata with inbox routing
- [x] Document MAIL, CMAIL, WMAIL, TO, and sysop-contact command contexts
- [x] Verify 390/360/320px route coverage and hint expansion behavior
- [x] Confirm hidden mobile tokens remain reachable after hint expansion
- [x] Run command-parity and UI layout/geometry smoke checks

Exit criteria: user-facing command help matches the existing memo/chat routes, and mobile hint trimming remains intentional and recoverable.

## Current iteration: 2026-08-29 16:00

- [x] Expose expandable hint state through `role=button`, `tabindex`, and `aria-expanded`
- [x] Add Enter/Space keyboard toggling for the hint bar without intercepting child command tokens
- [x] Keep semantics cleared when a new non-expandable hint replaces the footer
- [x] Add static and synthetic-overflow UI smoke assertions and rerun browser traversal

Exit criteria: mobile users and keyboard users can discover and expand trimmed hints without changing existing token actions.

## Current iteration: 2026-08-29 16:45

- [x] Recheck CORS allowlist behavior and Supabase service-role boundary without changing production settings
- [x] Run the repository unit suite (`npm test`)
- [x] Run the Vercel asset/build smoke (`npm run build`)
- [x] Keep public RPC grants, Auth password protection, and production origins as explicit approval items

Exit criteria: operational checks are evidenced while no external database permission or deployment setting is changed implicitly.

## Current iteration: 2026-08-29 assets catalog audit

- [x] Enumerate every image in `docs/ref_images` and `docs/종료공지` with Sharp dimensions and SHA-256
- [x] Remove the four verified duplicate/downsized copies while retaining the larger or canonical notice copy
- [x] Confirm no remaining image is below the 160×100 minimum
- [x] Add per-folder inventory READMEs with provenance status and source-page links where known
- [x] Update `docs/PC통신_자료_학습카탈로그.md` with the audited counts and provenance boundary

Exit criteria: image archives contain 35 unique, readable files and their audit evidence is documented without inventing missing original URLs.
## Current iteration: 2026-08-29 — HITEL.MNU/NRE GO candidate audit

- [x] Compare both Nurie `HITEL.MNU` copies and count unique GO candidates
- [x] Add only proven safe aliases (`CHATTING`, `BLUEHS`) to the existing router
- [x] Keep ordinary-screen `Z` disabled per user decision
- [x] Add source-backed GO and NRE/ANSI smoke assertions
- [x] Update the GO compatibility catalog and work log
- [x] Run syntax, GO/ANSI, command-parity, unit, and diff checks

Exit criteria: historical candidates without a current destination remain documented as deferred; no speculative routes are introduced.

## 다음 세션 인수인계 (2026-08-29)

- [x] `HITEL.MNU` 양본과 `.NRE` 샘플 대조 완료
- [x] 근거가 확인된 `GO CHATTING`·`GO BLUEHS`만 기존 라우터에 추가
- [x] 참고 이미지 중복 4개 제거, `ref_images` 15개·`종료공지` 20개 인벤토리 작성
- [x] 기준선 전체 검증: unit/build/check/qa/full-traversal/loop(24/24)
- [ ] Supabase 운영 보안 변경은 명시적 승인 후 별도 적용

재개 시 첫 명령: `npm run loop:verify`
그 다음 `git status --short`와 위 카탈로그를 읽고, 실제 재현되는 누락만 작은 변경으로 처리한다. 현재 작업 트리는 의도적으로 dirty하며 기존 변경을 초기화하지 않는다.
