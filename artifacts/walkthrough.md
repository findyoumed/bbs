# 전체 오류 감사 walkthrough

## 현재까지 수정

- `/memo/write`에서 `P`는 작성 취소, `ME`/`MEMO`는 받은 쪽지함 명령으로 동작하도록 수정했다.
- 비동기 raw 입력 핸들러가 해결한 `false`를 일반 명령 라우터까지 전달하도록 입력 이벤트 처리를 수정했다.
- 전역 명령 라우터의 `findBoardByCode` 의존성 누락을 보완했다.

## 검증

- 변경 JavaScript 문법 검사 통과
- `npm run loop:verify`: 9/9 통과
- `npm run check`: `ok: true`, Supabase live probes와 chat room contract 통과
- `npm run smoke:full-traversal`: 전체 라우트/전역 명령/채팅 흐름 통과, 콘솔 오류 0건
- `npm test`: `archive/dev-only/tests/unit` 디렉터리가 없어 테스트 러너가 시작되지 않음. 이는 현재 코드 실행 오류가 아니라 누락된 테스트 자산 문제로 별도 기록한다.

## 다음 점검

- 주요 HTTP/API 응답과 서버 로그 확인 완료
- 브라우저 직접 순회에서 page error/console error 0건 확인
- 재현 오류 수정 후 전체 회귀 재실행 완료
## 2026-08-28 PC communication mail semantics

- `GO ME` and `GO MEMO` now open the received memo inbox, matching `ME` and `RMAIL`.
- `GO MAIL` continues to open the top-level electronic-mail menu.
- `GO CMAIL` continues to open sent memos.
- Regression checks cover calls and inbox/sent state; all verification gates passed.
## 2026-08-28 Cross-service GO compatibility

- Added the documented Chollian `GO WORD` compatibility path to the existing `PLAZA` board.
- Canonical alias values now flow through the same menu/board resolver as native commands.
- Regression and full traversal checks passed without console errors.
## 2026-08-28 Korean/cross-provider board aliases

- `GO 유머란` opens the existing `HUMOR(우스개)` board.
- `GO WORD` opens the existing `PLAZA(열린광장)` board.
- Unsupported historical services remain unmapped; all verification gates passed.

## 2026-08-28 Small-notice restoration

- The main menu now reads one latest `notice` title through the existing API, with a 30-second cache and silent fallback when the endpoint is unavailable.
- The title is passed to the existing ANSI `[작은공지]` renderer, which keeps the fixed-width truncation and `(GO NOTICE)` token.
- The token continues to use the existing hotspot and keyboard activation path; no new interaction mechanism or modern card UI was introduced.

## 2026-08-28 Root hotspot regression

- Added a Playwright check to the full traversal smoke that reloads `/` and clicks all 12 generated root hotspots.
- The check requires each click to change the route or screen state and specifically verifies `GO NOTICE` reaches `/notice`.
- The live traversal reported `Verified 12 top-menu hotspots by browser click` and completed without console/page errors.

## 2026-08-28 Direct guide route coverage

- Added `/guide/tosysop` to the shared Playwright route set so the bookmarked suggestion path is checked on every full traversal.
- Guest protection remains intact; the route renders the guide screen cleanly until a logged-in user opens the editor.
- Full traversal passed with the new route and no console/page errors.

## 2026-08-28 Authenticated suggestion editor

- The full traversal now opens an isolated GUIDE page with a QA member fixture and clicks `건의하기`.
- It confirms the editor fields render with the fixed recipient and the send/cancel/navigation hint.
- Ctrl+S on an empty editor produces `제목을 입력해주세요.` inside the editor, keeps the hint unchanged, and focuses the subject field.

## 2026-08-28 Nested-menu click audit

- Chromium enumerated and clicked 40 child-menu hotspots across GUIDE, BBS, GAME, and LOG (AGORA currently has no rendered child hotspot because its list is empty).
- Every click produced a route or screen transition; guest TOSYSOP correctly returned to GUIDE and Google/Kakao entries handed off to their external provider paths.

## 2026-08-28 AGORA route semantics

- `/agora` now restores the 여론광장 parent menu, matching the legacy menu map instead of unexpectedly opening a vote list.
- The vote-list state now owns `/agora/vote`; existing `/agora/create` and `/agora/:voteId` paths remain unchanged.
- Full traversal browser checks directly reload both routes and confirm `board-select` versus `vote-list` state.
- Mobile viewport smoke (390/360/320px), `npm run loop:verify` (10/10), `npm test`, `npm run check` (`liveReady: true`), and `git diff --check` also passed.

## 2026-08-28 AGORA command contract

- GO regression coverage now proves `GO AGORA` opens the parent menu and `GO VOTE` opens the nested vote list.
- The smoke harness also checks the `/agora` and `/agora/vote` route source contracts, preventing the URL split from regressing.
- The authoritative `legacy/hanulso.mnu` comment now records the same parent/child route interpretation, so the source map and runtime no longer contradict each other.
- `npm run smoke:go-ansi` and `npm run loop:verify` (10/10) passed.

## 2026-08-28 Historical plan status synchronization

- Added a dated implementation-status section to `docs/hitel_upgrade_plan.txt`.
- PT/PR, mail, ST, LS/LD/KW, SET HOME, `/TO`, and small-notice entries now point to their verified current behavior.
- CAP remains explicitly excluded by the prior user decision; no runtime code was changed in this documentation pass.

## 2026-08-28 SOS emergency command

- Added the historical `SOS [메시지]` command to the global command catalog.
- Authenticated SOS input opens the existing sysop-contact editor with `[긴급 SOS] 시삽에게 보내는 메시지` and a prefilled body.
- Sending still requires the existing Ctrl+S flow, so internal memo persistence and Resend failure handling remain centralized.
- Guest SOS is rejected with a login hint; command parity and full browser traversal passed.

## 2026-08-28 Historical long-form command parity

- Added safe normalization for the documented long forms `PREV`, `MAIN`, `QUIT`, `NEXT`, `BACK`, `WRITE`, `ANSWER`, and list-screen `READ`.
- Added direct post-list `R/READ 번호` and `RE/ANSWER 번호` routing through the existing post resolver and auth guard.
- Added memo-list/menu `R/READ 번호` and `S/SEND 아이디` routing through the existing memo view and compose screens.
- Added regression assertions in `smoke-command-parity.js`; the command smoke gate passed.

## 2026-08-28 Member and PDS long-form aliases

- `FINGER [아이디]` now reaches the existing PF profile lookup.
- `INFO` now reaches the existing HI account-information screen.
- `FL` on a post/PDS list now uses the existing L list action.
- Command-parity coverage was extended before the full verification gates.

## 2026-08-28 Historical GO compatibility catalog

- Added the verified `GO BLUEHOUSE` mapping to the existing `/guide/tosysop` suggestion flow.
- Added `docs/PC통신_GO_호환성_카탈로그.md` with supported targets and an explicit list of historical destinations that have no current equivalent.
- Regression coverage asserts the unresolved list remains unresolved instead of being redirected to a semantically unrelated board.

## 2026-08-28 Historical common GO and status audit follow-up

- GO smoke now covers canonical `GO CHAT` and `GO HUMOR` in addition to their provider-specific aliases.
- The Hitel status section now records that DN protocol selection and ABSENT registration/removal are implemented.
- Chromium full traversal also passed with the existing 12 root hotspots, AGORA routes, authenticated TOSYSOP validation, chat flow, and no console/page errors.

## 2026-08-29 GO from active chat rooms

- Plain `GO HUMOR` and slash `/GO HUMOR` now use the global resolver from an active room instead of becoming chat messages.
- Successful navigation sends the existing room-leave notification; unresolved `GO PGF` stays in the room and displays a local hint.
- The new chat command harness and full Chromium traversal passed.

## 2026-08-28 Inline game validation

- Bio, Fortune, Tojeong, Compatibility, and MBTI validation errors now use a dedicated `game-inline-validation` row beside the active prompt host.
- Invalid input no longer calls `setHint()`, so the bottom command hint remains the same while the user corrects the value.
- A full Chromium check submits invalid values to all five paths and verifies the inline message, unchanged hint, and body placement.
- Full traversal, `loop:verify` (10/10), Supabase readiness (`liveReady: true`), unit tests, and `git diff --check` passed.

## 2026-08-28 Mail-list forward command

- `FW 번호 아이디` on a memo list now selects the visible memo, pre-fills the historical forwarding header/body, and opens the existing memo composer for the requested recipient.
- Unknown memo numbers remain on the list and show the existing selection prompt; memo-view `FW` behavior remains unchanged.
- Command-parity coverage confirms both recipient selection and forwarded body preservation.
## 2026-08-29 Historical chat-room list shortcut

- Added `/l` and `/list` handling inside an active chat room.
- Both spellings reuse the existing room leave endpoint and chat-lobby renderer used by `/p`.
- Added command-parity coverage to ensure the room is left once and the lobby is rendered once.
## 2026-08-29 Historical WHO/U member lookup

- Added the documented `U` short form for active-user lookup.
- Existing post-list `U` (write) and post-view `U` (attachment list) meanings remain unchanged.
- Command parity confirms the main-screen `U` path opens the active-user view.
## 2026-08-29 Historical post-list A reply shortcut

- Added `A 번호` as a post-list reply command alongside existing `RE`/`ANSWER` forms.
- The existing post resolver and guest guard are reused; post-view `A` navigation is unchanged.
- Command parity now verifies the selected post is preserved.
## 2026-08-29 Command-help parity

- Clarified that `A` is list-local reply with a number and post-view previous-article navigation when used bare.
- Added `U` to the `WHO` help text and documented `FW 번호 아이디` for memo lists.
- Added assertions to keep help metadata aligned with the existing routers.
## 2026-08-29 Chat-room footer discoverability

- Added clickable `/L:목록` and `/W:참여자` tokens to the active chat-room footer.
- Both tokens dispatch to the already-verified room-list and participant handlers.
- No chat-lobby or room-creation footer behavior was changed.

## 2026-08-29 Recent-post filter discoverability

- Added a clickable `새글(NEW)` token to ordinary post lists and the unified PDS list.
- The token reuses the existing `NEW/NW` router and its three-day `recent=3` query.
- Command-parity assertions confirm both footer categories expose the same working command.

## 2026-08-29 Nownuri CHATIN compatibility

- Added the Nownuri `CHATIN` spelling as an alias of the existing `CHAT` command.
- Authenticated users reuse the current chat-lobby renderer; guests receive the existing login requirement.
- Active-room ordinary text remains handled by the chat domain before global navigation.

## 2026-08-29 Numeric F list positioning

- Numeric `F 번호` on post lists now reuses the existing `LS 번호` position lookup.
- Bare `F` remains the next-page command, and post-view `F` is unchanged.
- Command parity verifies both the new numeric form and the preserved bare form.

## 2026-08-29 Nownuri GO CHATIN alias

- Added `CHATIN` to the historical GO alias catalog as an alias of `CHAT`.
- `GO CHATIN` now reaches the same existing chat lobby as `GO CHAT`.
- GO/ANSI regression coverage confirms the route and existing unsupported-target behavior remain intact.

## 2026-08-28 Common-flow occupancy fix

- The common chat smoke suite exposed a real contract mismatch: the memory driver dropped `authUserId`, so two sessions from one authenticated member were counted as two occupants.
- The memory participant record now retains the normalized Auth UUID, matching the Supabase driver and shared hybrid occupancy summary.
- The smoke fixture now supplies the same `authUserId` field that the live AuthBridge context provides.
- Focused chat-count, board, menu, renderer, security, recovery, syntax, and existing release checks pass after the change.

## 2026-08-29 Supabase chat-member smoke alignment

- The Supabase chat-member smoke reproduced a capacity error because its profile fixture supplied only `userId`; live `AuthBridge` contexts also provide `authUserId`.
- The fixture now carries the profile UUID in both fields, so the test exercises the authenticated member persistence path instead of the guest path.
- Repository behavior was unchanged; the focused smoke now passes with one authenticated occupant across two sessions, one guest occupant, and clean member-row removal. The full browser traversal also completed without console/page errors.

## 2026-08-29 Browser memo-editor coverage

- Full traversal now opens the existing `/memo` screen in an isolated Chromium page, applies the QA-authenticated state, and enters the editor through the real `W` command.
- It verifies recipient Enter → subject, subject Enter → body, row-click focus delegation, and empty-body inline validation without replacing the `Ctrl+S` hint.
- The scenario passed without changing memo persistence, routing, or production UI code.

## 2026-08-29 Browser memo-list selection coverage

- The isolated browser page now supplies one in-memory received memo response and enters the existing `RMAIL` list.
- Clicking the generated memo hotspot is asserted to open `memo-view`; no Supabase row is created or changed.
- The same page then re-enters `W` and preserves the Enter/click/inline-validation assertions.

## 2026-08-29 Hint-bar Tab and schema reproducibility

- The visible `Tab` hint now carries a dedicated focus action. The browser regression confirms that clicking it from the subject field moves to the body field and does not fill `TAB` into `#cmd-input`.
- Added idempotent Supabase migrations for `memos.receiver_archived`/`sender_archived` and the `chat_room_members(room_id, user_id)` upsert key; readiness now checks both migration files.
- Corrected the Nurie `.NRE` catalog to document its `@[` sentinel/legacy encoding and intentionally unsupported Nurie-specific extensions.

## 2026-08-29 Blood hotspot and click harness coverage

- Blood-type choices now expose `role="button"`/`tabindex="0"` on both input and result screens; delegated click, Enter, and Space activation share one path.
- Removed the old per-element mousedown handler that could invoke the same result twice.
- Repaired `smoke-click-fill-command.mjs` to import the actual ES modules through file URLs and provide the browser timer/input stubs they require.

## 2026-08-29 Fixed sysop recipient and NRE smoke

- Clicking the readonly `sysop` recipient now advances to the subject field; full traversal asserts the final focused element.
- `smoke-go-ansi.js` reads all four Nurie samples, converts `@[` to `ESC[`, verifies every converted sentinel is parsed, and checks that supported CSI is consumed without claiming Nurie-only extensions.
