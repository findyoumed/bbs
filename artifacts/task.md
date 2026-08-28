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
